/** The claims the files route signs onto an upload so it cannot be forged. */
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Site from '../models/Site';
import FAQ from '../models/FAQ';
import Visitor from '../models/Visitor';
import Team from '../models/Team';
import User from '../models/User';
import Department from '../models/Department';
import TeamMessage from '../models/TeamMessage';
import TeamChat from '../models/TeamChat';
import Organization from '../models/Organization';
import { autoAssignConversation, checkAndReassign } from '../services/autoAssignment';
import { isWithinBusinessHours, getBusinessHoursMessage, shouldCalculateSLA } from '../services/businessHours';
import { sendSLAWarning, handleSLABreach } from '../services/escalation';
import { getEngine as getAutomationEngine } from '../services/automationEngine';
import type { Namespace, Server, Socket } from 'socket.io';
import type { CreateInput, Doc } from '../db/model';
import { SESSION_COOKIE } from '../config/session';
import { isOriginAllowed } from '../config/origins';
import { verifySession, verifyUploadProof } from '../config/tokens';
import type { AuthTokenPayload } from '../types/auth';
import type { ConversationDoc } from '../models/Conversation';
import type { MessageDoc } from '../models/Message';
import type { SiteDoc } from '../models/Site';
import type { TeamChatDoc } from '../models/TeamChat';
import type {
  AdminSocket,
  AssignConversationPayload,
  ConversationPayload,
  JoinSitePayload,
  PageViewPayload,
  SendMessagePayload,
  SetDepartmentPayload,
  SetPriorityPayload,
  TeamChatPayload,
  TeamChatSendPayload,
  UpdateStatusPayload,
  UploadedFilePayload,
  UpdateStatusPayload as StatusPayload,
  VerifiedFile,
  WidgetJoinPayload,
  WidgetSocket
} from './types';

interface UploadProof extends AuthTokenPayload {
  kind?: string;
  siteId?: string;
  filename?: string;
  url?: string;
  size?: number;
  mimeType?: string;
}


/** Cerez basligindan oturum cerezini ayiklar. Soket el sikismasinda Express'in
 *  cookie-parser'i calismaz, ham baslik gelir. */
function sessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

class SocketHandler {
  io: Server;
  widgetNamespace: Namespace;
  adminNamespace: Namespace;

  constructor(io: Server) {
    this.io = io;
    this.widgetNamespace = io.of('/widget');
    this.adminNamespace = io.of('/admin');

    this.setupAdminAuthentication();
    this.setupWidgetHandlers();
    this.setupAdminHandlers();
    
    this.startSLAMonitoring();
  }

  setupAdminAuthentication(): void {
    this.adminNamespace.use(async (rawSocket, next) => {
      const socket = rawSocket as AdminSocket;
      try {
        // Oturum httpOnly çerezde taşınıyor; tarayıcı el sıkışmasına onu
        // kendiliğinden ekler. handshake.auth yolu tarayıcı dışı istemciler
        // (testler, sunucu-sunucu) için duruyor.
        const cookieToken = sessionCookie(socket.handshake.headers?.cookie);
        const raw = socket.handshake.auth?.token
          || cookieToken
          || socket.handshake.headers?.authorization;
        // Cerezle gelen kimligi tarayici kendisi ekler; hangi site isteği
        // baslatirsa baslatsin. Bu yuzden cerezle dogrulanan bir el sikismasi
        // panelin izinli kokenlerinden birinden gelmek zorunda (Cross-Site
        // WebSocket Hijacking). handshake.auth ile gelen token'i tarayici
        // kendiliginden eklemez, o yol bu kontrole tabi degil.
        if (!socket.handshake.auth?.token && cookieToken && !isOriginAllowed(socket.handshake.headers?.origin)) {
          return next(new Error('Authentication required'));
        }
        const token = String(raw || '').replace(/^Bearer\s+/i, '');
        if (!token) return next(new Error('Authentication required'));

        const decoded = verifySession(token);
        const Account = decoded.userType === 'team' ? Team : User;
        const account = await Account.findOne({ _id: decoded.userId, isActive: true });
        if (!account || !account.organizationId) return next(new Error('Authentication required'));

        const organization = await Organization.findOne({
          _id: account.organizationId,
          isActive: true
        });
        if (!organization) return next(new Error('Authentication required'));

        if (decoded.organizationId && String(decoded.organizationId) !== String(account.organizationId)) {
          return next(new Error('Authentication required'));
        }

        socket.userId = String(account._id);
        socket.userName = account.name || 'Support';
        socket.organizationId = String(account.organizationId);
        socket.role = account.role;
        socket.userType = decoded.userType === 'team' ? 'team' : 'user';
        socket.allowedSiteIds = new Set((account.assignedSites || []).map(String));
        next();
      } catch (error) {
        next(new Error('Authentication required'));
      }
    });
  }

  async siteForSocket(socket: AdminSocket, siteId: unknown): Promise<Doc<SiteDoc> | null> {
    if (!siteId) return null;
    const site = await Site.findOne({
      _id: siteId,
      organizationId: socket.organizationId,
      isActive: true
    });
    if (!site) return null;
    if (!['owner', 'admin'].includes(socket.role) &&
        socket.allowedSiteIds.size > 0 &&
        !socket.allowedSiteIds.has(String(site._id))) {
      return null;
    }
    return site;
  }

  async conversationForSocket(
    socket: AdminSocket,
    conversationId: unknown,
    { populateDepartment = false }: { populateDepartment?: boolean } = {}
  ): Promise<Doc<ConversationDoc> | null> {
    if (!conversationId) return null;
    let query = Conversation.findOne({
      _id: conversationId,
      organizationId: socket.organizationId
    });
    if (populateDepartment) query = query.populate('department');
    const conversation = await query;
    if (!conversation) return null;
    return (await this.siteForSocket(socket, conversation.siteId)) ? conversation : null;
  }

  async widgetConversationForSocket(
    socket: WidgetSocket,
    conversationId: unknown
  ): Promise<Doc<ConversationDoc> | null> {
    if (!conversationId || !socket.siteId || !socket.visitorId) return null;
    return Conversation.findOne({
      _id: conversationId,
      siteId: socket.siteId,
      visitorId: socket.visitorId
    });
  }

  validateUploadedFile(fileData: UploadedFilePayload | undefined, siteId: unknown): VerifiedFile | null {
    if (!fileData || typeof fileData !== 'object' || typeof fileData.uploadToken !== 'string') {
      return null;
    }
    try {
      const proof = verifyUploadProof(fileData.uploadToken);
      if (proof.kind !== 'chat-upload' || String(proof.siteId) !== String(siteId) ||
          proof.filename !== fileData.filename || proof.url !== fileData.url ||
          Number(proof.size) !== Number(fileData.size) || proof.mimeType !== fileData.mimeType) {
        return null;
      }
      const url = new URL(String(fileData.url));
      if (url.protocol !== 'https:') return null;
      return {
        filename: String(fileData.filename).slice(0, 500),
        originalName: String(fileData.originalName || 'attachment').slice(0, 255),
        mimeType: String(fileData.mimeType || 'application/octet-stream').slice(0, 150),
        size: Math.max(0, Math.min(Number(fileData.size) || 0, 10 * 1024 * 1024)),
        url: url.toString()
      };
    } catch (error) {
      return null;
    }
  }

  async chatForSocket(socket: AdminSocket, chatId: unknown): Promise<Doc<TeamChatDoc> | null> {
    if (!chatId) return null;
    return TeamChat.findOne({ chatId, participants: socket.userId });
  }

  /** Sends a failure to the client without its internals. Database errors
   *  name tables and constraints; the full error stays in the server log. */
  socketError(socket: Socket, error: unknown): void {
    console.error('[socket]', error);
    socket.emit('error', { message: 'Request failed' });
  }

  rejectSocketAction(socket: Socket): void {
    socket.emit('error', { message: 'Resource not found or access denied' });
  }

  setupWidgetHandlers(): void {
    this.widgetNamespace.on('connection', async (rawSocket: Socket) => {
      const socket = rawSocket as WidgetSocket;

      socket.on('join-conversation', async (data: WidgetJoinPayload | undefined) => {
        try {
          const { siteKey, visitorId, visitorName, visitorEmail, currentPage, metadata } = data || {};
          if (typeof siteKey !== 'string' || siteKey.length > 128 ||
              typeof visitorId !== 'string' || visitorId.length > 100 ||
              !/^[a-z0-9_.:-]+$/i.test(visitorId)) {
            return socket.emit('error', { message: 'Invalid widget session' });
          }

          const site = await Site.findOne({ siteKey, isActive: true });
          if (!site) {
            socket.emit('error', { message: 'Invalid site key' });
            return;
          }

          socket.siteId = site._id;
          socket.visitorId = visitorId;
          socket.visitorName = typeof visitorName === 'string' ? visitorName.trim().slice(0, 100) || 'Visitor' : 'Visitor';
          socket.visitorEmail = typeof visitorEmail === 'string' ? visitorEmail.trim().slice(0, 254) : null;
          socket.currentPage = typeof currentPage === 'string' ? currentPage.slice(0, 2048) : '/';
          const attributes: Record<string, string | number | boolean> = {};
          if (metadata?.attributes && typeof metadata.attributes === 'object' && !Array.isArray(metadata.attributes)) {
            for (const [key, value] of Object.entries(metadata.attributes).slice(0, 20)) {
              if (!/^[a-z0-9_.-]{1,64}$/i.test(key)) continue;
              if (['string', 'number', 'boolean'].includes(typeof value)) {
                attributes[key] = typeof value === 'string' ? value.slice(0, 500) : value;
              }
            }
          }
          socket.metadata = {
            browser: typeof metadata?.browser === 'string' ? metadata.browser.slice(0, 100) : null,
            os: typeof metadata?.os === 'string' ? metadata.os.slice(0, 100) : null,
            country: typeof metadata?.country === 'string' ? metadata.country.slice(0, 100) : null,
            referrer: typeof metadata?.referrer === 'string' ? metadata.referrer.slice(0, 2048) : null,
            language: typeof metadata?.language === 'string' ? metadata.language.slice(0, 30) : null,
            sessionId: typeof metadata?.sessionId === 'string' ? metadata.sessionId.slice(0, 100) : null,
            attributes
          };

          let conversation = await Conversation.findOne({
            siteId: site._id,
            visitorId,
            status: { $in: ['open', 'assigned', 'pending'] }
          }).populate('department', 'name color icon');

          if (conversation) {
            socket.join(`conversation:${conversation._id}`);
            socket.conversationId = conversation._id;

            conversation.currentPage = socket.currentPage;
            await conversation.save();

            // Ziyaretciye tum gecmis degil son 100 mesaj gonderilir; uzun
            // konusmalarda join yaniti aksi halde megabaytlara ciker ve
            // baglanti kurulmasi gecikir.
            const recent = await Message.find({ conversationId: conversation._id })
              .sort({ createdAt: -1 })
              .limit(100);
            const messages = recent.reverse();

            try {
              conversation.calculateSLA();
            } catch (slaErr) {

            }
            await conversation.save();

            socket.emit('conversation-joined', {
              conversation,
              messages
            });
          } else {
            socket.emit('conversation-joined', {
              conversation: null,
              messages: [],
              welcomeMessage: site.widgetSettings.welcomeMessage || 'Hi! How can we help you today?'
            });
          }

          const visitorDoc = await Visitor.findOneAndUpdate(
            { visitorId, siteId: site._id },
            {
              organizationId: site.organizationId,
              ip: socket.handshake.address || null,
              country: socket.metadata.country,
              browser: socket.metadata.browser,
              os: socket.metadata.os,
              currentPage: socket.currentPage,
              referrer: socket.metadata.referrer,
              isActive: true,
              lastActiveAt: new Date()
            },
            { new: true, upsert: true }
          );

          this.adminNamespace.to(`site:${site._id}`).emit('visitor-updated', visitorDoc);

        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('visitor-page-view', async (data: PageViewPayload | undefined) => {
        try {
          if (!socket.visitorId || !socket.siteId) return;
          const currentPage = typeof data?.currentPage === 'string' ? data.currentPage.slice(0, 2048) : '/';
          socket.currentPage = currentPage;

          const visitorDoc = await Visitor.findOneAndUpdate(
            { visitorId: socket.visitorId, siteId: socket.siteId },
            { currentPage: currentPage || '/', lastActiveAt: new Date(), isActive: true },
            { new: true }
          );

          if (visitorDoc) {
             this.adminNamespace.to(`site:${socket.siteId}`).emit('visitor-updated', visitorDoc);
          }
        } catch (error) {

        }
      });

      socket.on('send-message', async (data: SendMessagePayload | undefined) => {
        try {
          const { content, messageType, fileData, clientMessageId } = data || {};
          if (typeof content !== 'string' || !content.trim() || content.length > 10000) {
            return socket.emit('error', { message: 'Invalid message content' });
          }
          if (messageType && !['text', 'image', 'file'].includes(messageType)) {
            return socket.emit('error', { message: 'Invalid message type' });
          }
          if (clientMessageId != null &&
              (typeof clientMessageId !== 'string' || clientMessageId.length > 100 ||
               !/^[a-z0-9_.:-]+$/i.test(clientMessageId))) {
            return socket.emit('error', { message: 'Invalid client message id' });
          }
          let conversationId = socket.conversationId;

          if (!conversationId) {
            const site = await Site.findById(socket.siteId);
            if (!site) {
              socket.emit('error', { message: 'Site not found' });
              return;
            }
            
            if (!site.organizationId) {
              socket.emit('error', { message: 'Site organization not found' });
              return;
            }

            let department = await Department.findOne({
              siteId: socket.siteId,
              isActive: true
            }).sort({ createdAt: 1 });

            let businessHoursMessage = null;
            if (department && !isWithinBusinessHours(department)) {
              businessHoursMessage = getBusinessHoursMessage(department);
            }

            let matchedDepartment = null;
            const msgLower = content ? content.toLowerCase() : '';
            
            if (msgLower.includes('satış') || msgLower.includes('fiyat') || msgLower.includes('satın') || msgLower.includes('kampanya') || msgLower.includes('ödeme')) {

              matchedDepartment = await Department.findOne({ siteId: socket.siteId, isActive: true, name: { $regex: /satış|sales/i } });
            } else if (msgLower.includes('destek') || msgLower.includes('sorun') || msgLower.includes('hata') || msgLower.includes('çalışmıyor')) {

              matchedDepartment = await Department.findOne({ siteId: socket.siteId, isActive: true, name: { $regex: /destek|support/i } });
            }
            
            if (matchedDepartment) {
              department = matchedDepartment;
            }

            const conversation = new Conversation({
              siteId: socket.siteId,
              organizationId: site.organizationId,
              visitorId: socket.visitorId,
              visitorName: socket.visitorName,
              visitorEmail: socket.visitorEmail,
              currentPage: socket.currentPage,
              metadata: socket.metadata,
              department: department?._id,
              status: 'open',
              channel: 'web-chat',
              priority: 'normal',
              requiredSkills: department?.requiredSkills || []
            });

            const slaTargets = {
              urgent: { firstResponse: 5, resolution: 60 },
              high: { firstResponse: 10, resolution: 120 },
              normal: { firstResponse: 15, resolution: 240 },
              low: { firstResponse: 30, resolution: 480 }
            };
            
            const priority = conversation.priority;
            
            if (department && department.sla && department.sla.enabled) {
              conversation.sla.firstResponseTarget = department.sla.firstResponse?.[priority] || slaTargets[priority].firstResponse;
              conversation.sla.resolutionTarget = department.sla.resolution?.[priority] || slaTargets[priority].resolution;
            } else {
              conversation.sla.firstResponseTarget = slaTargets[priority].firstResponse;
              conversation.sla.resolutionTarget = slaTargets[priority].resolution;
            }

            if (shouldCalculateSLA(department)) {

              if (!conversation.createdAt) {
                conversation.createdAt = new Date();
              }
              try {
                conversation.calculateSLA();
              } catch (slaErr) {

              }
            } else {

              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(9, 0, 0, 0);
              conversation.nextSlaCheckAt = tomorrow;
            }

            await conversation.save();

            if (department) {
              department.stats.totalConversations++;
              department.stats.activeConversations++;
              await department.save();
            }

            socket.join(`conversation:${conversation._id}`);
            socket.conversationId = conversation._id;
            conversationId = conversation._id;

            const assignResult = await autoAssignConversation(conversation._id, site.organizationId);
            if (assignResult.success) {

              await conversation.populate('assignedAgent', 'name avatar status');
            }

            if (businessHoursMessage) {
              const botMessage = new Message({
                conversationId: conversation._id,
                senderType: 'bot',
                senderId: 'business-hours-bot',
                senderName: 'Support Bot',
                content: businessHoursMessage,
                isRead: true
              });
              await botMessage.save();
              
              this.widgetNamespace.to(`conversation:${conversation._id}`).emit('new-message', {
                message: botMessage
              });
            }

            this.adminNamespace.to(`site:${socket.siteId}`).emit('new-conversation', {
              conversation: await conversation.populate('department', 'name color icon')
            });

            this.runAutomation('conversation_created', conversation, { content });
          }

          const conversation = await this.widgetConversationForSocket(socket, conversationId);
          if (!conversation) {
            return this.rejectSocketAction(socket);
          }

          const verifiedFile = (messageType === 'file' || messageType === 'image')
            ? this.validateUploadedFile(fileData, conversation.siteId)
            : null;
          if ((messageType === 'file' || messageType === 'image') && !verifiedFile) {
            return socket.emit('error', { message: 'Invalid or expired file upload' });
          }

          const messageData: CreateInput<MessageDoc> = {
            conversationId,
            senderType: 'visitor',
            senderId: conversation.visitorId,
            senderName: conversation.visitorName,
            content: content.trim(),
            messageType: messageType || 'text',
            isRead: false
          };

          if (verifiedFile) {
            messageData.fileData = verifiedFile;
          }

          const message = new Message(messageData);
          await message.save();
          const emittedMessage = {
            ...message.toObject(),
            ...(clientMessageId ? { clientMessageId } : {})
          };

          conversation.unreadCount = (conversation.unreadCount || 0) + 1;
          conversation.lastMessageAt = new Date();
          await conversation.save();

          if (conversation.assignedAgent) {
            const agent = await Team.findById(conversation.assignedAgent);
            if (agent && (agent.status === 'offline' || agent.status === 'away')) {
              const site = await Site.findById(conversation.siteId);
              if (site && site.organizationId) {
                await checkAndReassign(conversation._id, site.organizationId);

                await conversation.populate('assignedAgent', 'name avatar status');
              }
            }
          }

          this.widgetNamespace.to(`conversation:${conversationId}`).emit('new-message', { message: emittedMessage });

          this.adminNamespace.to(`site:${conversation.siteId}`).emit('new-message', {
            message: emittedMessage,
            conversation
          });

          if (conversation.assignedAgent) {
            this.adminNamespace.to(`user:${conversation.assignedAgent}`).emit('new-message', {
              message,
              conversation
            });
          }

          this.adminNamespace.to(`site:${conversation.siteId}`).emit('notification', {
            type: 'new-message',
            message: `New message from ${conversation.visitorName}`,
            siteId: conversation.siteId,
            conversationId: conversation._id,
            timestamp: new Date()
          });

          this.runAutomation('message_received', conversation, { content, message });

          await this.tryAutoResponse(conversation, content);

        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('typing', () => {
        if (socket.conversationId) {
          this.adminNamespace.to(`conversation:${socket.conversationId}`).emit('visitor-typing', {
            conversationId: socket.conversationId
          });
        }
      });

      socket.on('disconnect', async () => {
        try {
          if (socket.visitorId && socket.siteId) {
             const visitorDoc = await Visitor.findOneAndUpdate(
               { visitorId: socket.visitorId, siteId: socket.siteId },
               { isActive: false, lastActiveAt: new Date() },
               { new: true }
             );
             if (visitorDoc) {
                this.adminNamespace.to(`site:${socket.siteId}`).emit('visitor-updated', visitorDoc);
             }
          }
        } catch (error) {

        }
      });
    });
  }

  setupAdminHandlers(): void {

    this.adminNamespace.on('connection', async (rawSocket: Socket) => {
      const socket = rawSocket as AdminSocket;
      try {
        socket.join(`user:${socket.userId}`);
        socket.join(`org:${socket.organizationId}`);
      } catch (e) {
      }

      socket.on('join-site', async (data: JoinSitePayload | undefined) => {
        try {
          const siteId = data?.siteId;
          // Team Chat opens without a selected site and only needs the user/org rooms.
          if (!siteId) return;
          const site = await this.siteForSocket(socket, siteId);
          if (!site) return this.rejectSocketAction(socket);
          if (socket.siteId && String(socket.siteId) !== String(site._id)) {
            socket.leave(`site:${socket.siteId}`);
          }
          socket.siteId = String(site._id);
          socket.join(`site:${site._id}`);
        } catch (error) {
          this.rejectSocketAction(socket);
        }
      });

      socket.on('join-conversation', async (data: ConversationPayload | undefined) => {
        try {
          const conversationId = data?.conversationId;
          const conversation = await this.conversationForSocket(socket, conversationId);
          if (!conversation) return this.rejectSocketAction(socket);
          socket.join(`conversation:${conversationId}`);
          
          await Message.updateMany(
            { conversationId, isRead: false, senderType: 'visitor' },
            { isRead: true, readAt: new Date() }
          );

        } catch (error) {
          this.rejectSocketAction(socket);
        }
      });

      socket.on('send-message', async (data: SendMessagePayload | undefined) => {
        try {
          const { conversationId, content, messageType, fileData } = data || {};
          if (typeof content !== 'string' || !content.trim() || content.length > 10000) {
            return socket.emit('error', { message: 'Invalid message content' });
          }
          if (messageType && !['text', 'image', 'file'].includes(messageType)) {
            return socket.emit('error', { message: 'Invalid message type' });
          }

          const actualSenderId = socket.userId;
          const actualSenderName = socket.userName;

          const conversation = await this.conversationForSocket(socket, conversationId, {
            populateDepartment: true
          });
          if (!conversation) {
            return this.rejectSocketAction(socket);
          }

          const verifiedFile = (messageType === 'file' || messageType === 'image')
            ? this.validateUploadedFile(fileData, conversation.siteId)
            : null;
          if ((messageType === 'file' || messageType === 'image') && !verifiedFile) {
            return socket.emit('error', { message: 'Invalid or expired file upload' });
          }

          if (!conversation.assignedAgent && socket.userId) {
            conversation.assignedAgent = socket.userId;
            conversation.assignedAt = new Date();
            conversation.status = 'assigned';
          }

          if (!conversation.firstResponseAt) {
            conversation.firstResponseAt = new Date();
            
            try {
              conversation.calculateSLA();
            } catch (slaErr) {

            }
            
            if (socket.userId) {
              const agent = await Team.findById(socket.userId);
              if (agent) {
                const responseTime = Math.floor(
                  (conversation.firstResponseAt.getTime() - conversation.createdAt.getTime()) / 1000 / 60
                );
                const totalResponses = agent.stats.totalResponses || 0;
                const avgResponseTime = agent.stats.averageResponseTime || 0;
                agent.stats.averageResponseTime = ((avgResponseTime * totalResponses) + responseTime) / (totalResponses + 1);
                agent.stats.totalResponses = totalResponses + 1;
                await agent.save();
              }
            }
            
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-update', {
              conversationId: conversation._id,
              conversation: conversation.toObject()
            });
          }

          await conversation.save();

          const messageData: CreateInput<MessageDoc> = {
            conversationId,
            senderType: 'agent',
            senderId: actualSenderId,
            senderName: actualSenderName,
            content: content.trim(),
            messageType: messageType || 'text',
            isRead: true
          };

          if (verifiedFile) {
            messageData.fileData = verifiedFile;
          }

          const message = new Message(messageData);
          await message.save();

          if (message.senderType === 'agent') {
            conversation.unreadCount = 0;
          }
          
          conversation.lastMessageAt = new Date();
          await conversation.save();

          this.widgetNamespace.to(`conversation:${conversationId}`).emit('new-message', {
            message
          });

          this.adminNamespace.to(`conversation:${conversationId}`).emit('new-message', {
            message,
            conversation
          });

          this.adminNamespace.to(`site:${conversation.siteId}`).emit('new-message', {
            message,
            conversation
          });

        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('typing', (data: ConversationPayload | undefined) => {
        const conversationId = data?.conversationId;
        this.conversationForSocket(socket, conversationId)
          .then((conversation) => {
            if (conversation) {
              this.widgetNamespace.to(`conversation:${conversationId}`).emit('agent-typing');
            }
          })
          .catch(() => {});
      });

      socket.on('update-status', async (data: UpdateStatusPayload) => {
        try {
          const { status } = data;

          // Gecerli durumlar disinda bir deger veritabanina yazilmamali;
          // gelen veri istemciden gelir.
          if (!status || !['online', 'away', 'busy', 'offline'].includes(status)) return;
          if (!socket.userId) return;

          // Hesap iki tablodan birinde olabilir: organizasyon sahibi ve
          // davet edilmeyen kullanicilar `users`, ekip uyeleri `teams`
          // tablosundadir. Eski kod YALNIZCA Team'e yaziyordu, yani sahip
          // hesabinin durum degisikligi sessizce kayboluyordu ve ziyaretcinin
          // gordugu "cevrimici" bilgisi guncellenmiyordu.
          const updated =
            (await Team.findOneAndUpdate(
              { _id: socket.userId, organizationId: socket.organizationId, isActive: true },
              { status },
              { new: true }
            )) ||
            (await User.findOneAndUpdate(
              { _id: socket.userId, organizationId: socket.organizationId, isActive: true },
              { status },
              { new: true }
            ));
          if (!updated) return;

          if (status === 'offline' || status === 'away') {
            const assignedConversations = await Conversation.find({
              assignedAgent: socket.userId,
              organizationId: socket.organizationId,
              status: { $in: ['assigned', 'pending'] }
            }).populate('siteId', 'organizationId');
            
            for (const conv of assignedConversations) {
              if (conv.siteId && conv.siteId.organizationId) {
                await checkAndReassign(conv._id, conv.siteId.organizationId);
              }
            }
          }

          if (socket.siteId) {
            this.adminNamespace.to(`site:${socket.siteId}`).emit('agent-status-changed', {
              userId: socket.userId,
              status
            });
          } else if (socket.organizationId) {
            // Eski kod burada `this.adminNamespace.emit(...)` cagiriyordu:
            // yayin TUM organizasyonlarin panellerine gidiyordu. Bir sitede
            // olmayan bir temsilcinin durumu, baska sirketlerin ekranlarina
            // dusuyordu. Yayin artik organizasyon odasiyla sinirli.
            this.adminNamespace.to(`org:${socket.organizationId}`).emit('agent-status-changed', {
              userId: socket.userId,
              status
            });
          }
          this.adminNamespace.to(`user:${socket.userId}`).emit('agent-status-changed', {
            userId: socket.userId,
            status
          });
        } catch (error) {

        }
      });

      socket.on('assign-conversation', async (data: AssignConversationPayload) => {
        try {
          const { conversationId, agentId } = data;
          
          const conversation = await this.conversationForSocket(socket, conversationId);
          if (!conversation) {
            return this.rejectSocketAction(socket);
          }

          if (!(socket.role === 'owner' || socket.role === 'admin')) {
            socket.emit('error', { message: 'Yetersiz yetki: atama işlemi için admin gerekli.' });
            return;
          }

          const targetAgent =
            (await Team.findOne({ _id: agentId, organizationId: socket.organizationId, isActive: true })) ||
            (await User.findOne({ _id: agentId, organizationId: socket.organizationId, isActive: true }));
          if (!targetAgent) return this.rejectSocketAction(socket);
          if ((targetAgent.assignedSites || []).length > 0 &&
              !(targetAgent.assignedSites || []).map(String).includes(String(conversation.siteId))) {
            return this.rejectSocketAction(socket);
          }

          conversation.assignedAgent = agentId;
          conversation.assignedBy = socket.userId;
          conversation.assignedAt = new Date();
          conversation.status = 'assigned';
          await conversation.save();

          try {
            const team = await Team.findOne({ _id: agentId, organizationId: socket.organizationId }).select('_id');
            if (team) {
              await Team.findByIdAndUpdate(agentId, {
                $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
              }).catch(() => {});
            } else {
              const userDoc = await User.findOne({ _id: agentId, organizationId: socket.organizationId }).select('_id');
              if (userDoc) {
                await User.findByIdAndUpdate(agentId, {
                  $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
                }).catch(() => {});
              }
            }
          } catch (e) {

          }
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-assigned', {
            conversationId,
            agentId,
            assignedBy: socket.userId
          });

          try {
            const team = await Team.findOne({ _id: agentId, organizationId: socket.organizationId }).select('_id');
            if (team) {
              this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
                conversationId,
                agentId,
                assignedBy: socket.userId,
                siteId: conversation.siteId
              });

            } else {
              const userDoc = await User.findOne({ _id: agentId, organizationId: socket.organizationId }).select('_id');
              if (userDoc) {
                this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
                  conversationId,
                  agentId,
                  assignedBy: socket.userId,
                  siteId: conversation.siteId
                });

              } else {
                this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
                  conversationId,
                  agentId,
                  assignedBy: socket.userId,
                  siteId: conversation.siteId
                });

              }
            }
          } catch (e) {

            this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
              conversationId,
              agentId,
              assignedBy: socket.userId,
              siteId: conversation.siteId
            });
          }
        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('claim-conversation', async (data: ConversationPayload) => {
        try {
          const { conversationId } = data;
          
          const conversation = await this.conversationForSocket(socket, conversationId);
          if (!conversation) {
            return this.rejectSocketAction(socket);
          }
          
          if (conversation.assignedAgent) {
            socket.emit('error', { message: 'Conversation is already assigned' });
            return;
          }
          
          const AgentModel = socket.userType === 'team' ? Team : User;
          const agent = await AgentModel.findOne({
            _id: socket.userId,
            organizationId: socket.organizationId,
            isActive: true
          });
          if (!agent) return this.rejectSocketAction(socket);
          // The account can come from either table and the two schemas name the
          // same limit differently, so each side is read where it exists.
          const maxConversations =
            ('maxCapacity' in agent ? agent.maxCapacity : undefined) ||
            ('preferences' in agent ? agent.preferences?.maxActiveConversations : undefined) || 10;
          const activeConversations =
            ('currentLoad' in agent ? agent.currentLoad : undefined) ||
            agent.stats?.activeConversations || 0;
          if (activeConversations >= maxConversations) {
            socket.emit('error', { message: 'Maximum active conversations reached' });
            return;
          }
          
          conversation.assignedAgent = socket.userId;
          conversation.assignedBy = socket.userId;
          conversation.assignedAt = new Date();
          conversation.status = 'assigned';
          await conversation.save();
          
          await AgentModel.findByIdAndUpdate(socket.userId, {
            $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
          });
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-claimed', {
            conversationId,
            agentId: socket.userId
          });

          this.adminNamespace.to(`user:${socket.userId}`).emit('conversation-claimed', {
            conversationId,
            agentId: socket.userId
          });
        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('set-department', async (data: SetDepartmentPayload) => {
        try {

          const { conversationId, departmentId } = data;
          
          const conversation = await this.conversationForSocket(socket, conversationId);
          if (!conversation) {
            return this.rejectSocketAction(socket);
          }

          if (!(socket.role === 'owner' || socket.role === 'admin')) {
            socket.emit('error', { message: 'Yetersiz yetki: departman ataması için admin gerekli.' });
            return;
          }

          const oldDepartmentId = conversation.department;
          const departmentChanged = String(oldDepartmentId || '') !== String(departmentId || '');
          const isActiveConversation = ['open', 'assigned', 'pending', 'unassigned'].includes(conversation.status);
          let newDepartment = null;
          if (departmentId) {
            newDepartment = await Department.findOne({
              _id: departmentId,
              siteId: conversation.siteId,
              isActive: true
            });
            if (!newDepartment) return this.rejectSocketAction(socket);
          }
          conversation.department = newDepartment?._id || null;

          if (newDepartment) {
            if (newDepartment.sla.enabled) {
              const priority = conversation.priority;
              conversation.sla.firstResponseTarget = newDepartment.sla.firstResponse[priority] || 30;
              conversation.sla.resolutionTarget = newDepartment.sla.resolution[priority] || 480;

              
              try {
                conversation.calculateSLA();
              } catch (slaErr) {

              }
            }
            
            if (departmentChanged) {
              await Department.findByIdAndUpdate(departmentId, {
                $inc: {
                  'stats.totalConversations': 1,
                  ...(isActiveConversation ? { 'stats.activeConversations': 1 } : {})
                }
              });
            }
          }
          
          await conversation.save();
          
          if (departmentChanged && oldDepartmentId && isActiveConversation) {
            const previousDepartment = await Department.findOne({
              _id: oldDepartmentId,
              siteId: conversation.siteId
            });
            if (previousDepartment) {
              previousDepartment.stats.activeConversations = Math.max(
                0,
                (previousDepartment.stats.activeConversations || 0) - 1
              );
              await previousDepartment.save();
            }
          }
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-department-changed', {
            conversationId,
            departmentId,
            conversation
          });
        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('set-priority', async (data: SetPriorityPayload) => {
        try {
          const { conversationId, priority } = data;
          
          if (!priority || !['low', 'normal', 'high', 'urgent'].includes(priority)) {
            return socket.emit('error', { message: 'Invalid priority' });
          }
          const conversation = await this.conversationForSocket(socket, conversationId, {
            populateDepartment: true
          });
          if (!conversation) {
            return this.rejectSocketAction(socket);
          }
          
          conversation.priority = priority;
          
          if (conversation.department && conversation.department.sla.enabled) {
            conversation.sla.firstResponseTarget = conversation.department.sla.firstResponse[priority] || 30;
            conversation.sla.resolutionTarget = conversation.department.sla.resolution[priority] || 480;
            
            try {
              conversation.calculateSLA();
            } catch (slaErr) {

            }
          }
          
          await conversation.save();
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-priority-changed', {
            conversationId,
            priority,
            conversation
          });
        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('team-chat-join', async (data: TeamChatPayload | undefined) => {
        const chatId = data?.chatId;
        try {
          const chat = await this.chatForSocket(socket, chatId);
          if (!chat) return this.rejectSocketAction(socket);
          socket.join(`team-chat:${chatId}`);
        } catch (error) {
          this.rejectSocketAction(socket);
        }
      });

      socket.on('team-chat-leave', (data: TeamChatPayload) => {
        const { chatId } = data;
        socket.leave(`team-chat:${chatId}`);
      });

      socket.on('team-chat-send', async (data: TeamChatSendPayload | undefined) => {
        try {
          const { chatId, content } = data || {};
          if (typeof content !== 'string' || !content.trim() || content.length > 10000) {
            return socket.emit('error', { message: 'Invalid message content' });
          }
          const chat = await this.chatForSocket(socket, chatId);
          if (!chat) return this.rejectSocketAction(socket);
          const userId = socket.userId;
          const sender = { _id: userId, name: socket.userName };

          const message = new TeamMessage({
            chatId,
            chatType: chat.chatType,
            senderId: sender._id,
            senderName: sender.name,
            content: content.trim(),
            readBy: [sender._id]
          });
          await message.save();

          await TeamChat.findOneAndUpdate(
            { chatId, participants: socket.userId },
            {
              lastMessage: {
                content: content.trim(),
                senderId: sender._id,
                senderName: sender.name,
                createdAt: new Date()
              }
            }
          );

          this.adminNamespace.to(`team-chat:${chatId}`).emit('team-chat-message', {
            message
          });

          if (chat) {
            chat.participants.forEach(pId => {
              if (pId.toString() !== sender._id.toString()) {
                // emit the same event to update chat list and message window globally
                this.adminNamespace.to(`user:${pId}`).emit('team-chat-message', {
                  message
                });
                
                // Keep notification for other UI systems
                this.adminNamespace.to(`user:${pId}`).emit('team-chat-notification', {
                  chatId,
                  message,
                  chatType: chat.chatType,
                  groupName: chat.groupName
                });
              }
            });
          }
        } catch (error) {

        }
      });

      socket.on('team-chat-typing', async (data: TeamChatPayload | undefined) => {
        const chatId = data?.chatId;
        try {
          const chat = await this.chatForSocket(socket, chatId);
          if (!chat) return;
          socket.to(`team-chat:${chatId}`).emit('team-chat-user-typing', {
            chatId,
            userName: socket.userName
          });
        } catch (error) {
        }
      });

      socket.on('resolve-conversation', async (data: ConversationPayload) => {
        try {
          const { conversationId } = data;
          
          const conversation = await this.conversationForSocket(socket, conversationId, {
            populateDepartment: true
          });
          if (!conversation) {
            return this.rejectSocketAction(socket);
          }
          const wasActive = ['open', 'assigned', 'pending', 'unassigned'].includes(conversation.status);
          if (!wasActive) {
            return socket.emit('conversation-resolved', { conversationId, conversation });
          }
          
          conversation.status = 'resolved';
          conversation.resolvedAt = new Date();
          
          conversation.calculateSLA();
          
          await conversation.save();
          
          if (conversation.department) {
            const dept = await Department.findOne({
              _id: conversation.department._id,
              siteId: conversation.siteId
            });
            if (!dept) return this.rejectSocketAction(socket);
            dept.stats.activeConversations = Math.max(0, dept.stats.activeConversations - 1);
            
            if (conversation.sla.firstResponseStatus === 'met') {
              dept.stats.slaMetrics.firstResponseMet++;
            } else if (conversation.sla.firstResponseStatus === 'breached') {
              dept.stats.slaMetrics.firstResponseBreached++;
            }
            
            if (conversation.sla.resolutionStatus === 'met') {
              dept.stats.slaMetrics.resolutionMet++;
            } else if (conversation.sla.resolutionStatus === 'breached') {
              dept.stats.slaMetrics.resolutionBreached++;
            }
            
            if (conversation.responseTime) {
              const total = dept.stats.slaMetrics.firstResponseMet + dept.stats.slaMetrics.firstResponseBreached;
              const currentAvg = dept.stats.slaMetrics.averageFirstResponseTime || 0;
              dept.stats.slaMetrics.averageFirstResponseTime = ((currentAvg * (total - 1)) + conversation.responseTime) / total;
            }
            
            if (conversation.resolutionTime) {
              const total = dept.stats.slaMetrics.resolutionMet + dept.stats.slaMetrics.resolutionBreached;
              const currentAvg = dept.stats.slaMetrics.averageResolutionTime || 0;
              dept.stats.slaMetrics.averageResolutionTime = ((currentAvg * (total - 1)) + conversation.resolutionTime) / total;
            }
            
            await dept.save();
          }
          
          if (conversation.assignedAgent) {
            await Team.findByIdAndUpdate(conversation.assignedAgent, {
              $inc: { 
                'stats.activeConversations': -1,
                'stats.resolvedConversations': 1
              }
            });
          }
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-resolved', {
            conversationId,
            conversation
          });
        } catch (error) {

          this.socketError(socket, error);
        }
      });

      socket.on('disconnect', () => {
      });
    });
  }

  startSLAMonitoring() {
    setInterval(async () => {
      try {
        const now = new Date();

        const conversationsToCheck = await Conversation.find({
          status: { $in: ['open', 'assigned', 'pending'] },
          $or: [
            { nextSlaCheckAt: { $lte: now } },
            { nextSlaCheckAt: null }
          ]
        })
        .populate('department', 'name color icon businessHours sla')
        .populate('assignedAgent', 'name email avatar status')
        .populate('siteId', 'organizationId')
        .limit(100);
        
        for (const conversation of conversationsToCheck) {

          if (conversation.department && !shouldCalculateSLA(conversation.department)) {

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            conversation.nextSlaCheckAt = tomorrow;
            await conversation.save();
            continue;
          }
          
          const previousFirstResponseStatus = conversation.sla.firstResponseStatus;
          const previousResolutionStatus = conversation.sla.resolutionStatus;
          const previousFirstResponseRemaining = conversation.sla.firstResponseTimeRemaining;
          const previousResolutionRemaining = conversation.sla.resolutionTimeRemaining;
          
          conversation.calculateSLA();
          await conversation.save();

          const warning = await sendSLAWarning(conversation, this.io);
          
          if (previousFirstResponseRemaining !== conversation.sla.firstResponseTimeRemaining ||
              previousResolutionRemaining !== conversation.sla.resolutionTimeRemaining ||
              previousFirstResponseStatus !== conversation.sla.firstResponseStatus ||
              previousResolutionStatus !== conversation.sla.resolutionStatus) {
            
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-update', {
              conversationId: conversation._id,
              conversation: conversation.toObject()
            });
          }

          if (previousFirstResponseStatus !== 'breached' && conversation.sla.firstResponseStatus === 'breached') {
            const site = await Site.findById(conversation.siteId);
            if (site && site.organizationId) {
              await handleSLABreach(conversation, site.organizationId, this.io);
            }
            
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'first-response',
              conversation: conversation.toObject()
            });

            if (!conversation.firstResponseAt) {
              const site = await Site.findById(conversation.siteId);
              if (site && site.organizationId) {
                await checkAndReassign(conversation._id, site.organizationId);
              }
            }
          }
          
          if (previousResolutionStatus !== 'breached' && conversation.sla.resolutionStatus === 'breached') {
            const site = await Site.findById(conversation.siteId);
            if (site && site.organizationId) {
              await handleSLABreach(conversation, site.organizationId, this.io);
            }
            
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'resolution',
              conversation: conversation.toObject()
            });
          }
        }
      } catch (error) {

      }
    }, 30000);
  }

  // Hands a conversation event to the automation rule engine. Deliberately not
  // awaited by callers: a rule must never delay delivery of the visitor's
  // message, and a broken rule must not break the chat. The engine is null
  // until server.js initialises it, so an unconfigured deployment is a no-op.
  runAutomation(
    triggerType: string,
    conversation: Doc<ConversationDoc>,
    { content = '', message = null }: { content?: string; message?: Doc<MessageDoc> | null } = {}
  ): void {
    const engine = getAutomationEngine();
    if (!engine) return;

    // Field names here are the ones offered by the rule editor's condition
    // builder (message.content, visitor.country); changing them silently breaks
    // every saved rule.
    const payload = {
      message: message
        ? { content, senderType: message.senderType, senderName: message.senderName, messageType: message.messageType }
        : { content },
      visitor: {
        id: conversation.visitorId,
        name: conversation.visitorName,
        email: conversation.visitorEmail,
        country: conversation.metadata?.country || null,
        currentPage: conversation.currentPage
      },
      conversation: {
        status: conversation.status,
        priority: conversation.priority,
        channel: conversation.channel,
        tags: conversation.tags || []
      }
    };

    engine.evaluateEvent({
      siteId: conversation.siteId,
      organizationId: conversation.organizationId,
      triggerType,
      targetId: conversation._id,
      payload
    }).catch(() => {
      // evaluateEvent already logs; swallowing keeps the chat path alive.
    });
  }

  async tryAutoResponse(conversation: Doc<ConversationDoc>, userMessage: string): Promise<void> {
    try {
      const site = await Site.findById(conversation.siteId);
      
      const faqs = await FAQ.find({
        siteId: conversation.siteId,
        isActive: true,
        $text: { $search: userMessage }
      }, {
        score: { $meta: 'textScore' }
      }).sort({ score: { $meta: 'textScore' } }).limit(1);

      if (faqs.length > 0 && (faqs[0].score ?? 0) > 0.5) {
        const faq = faqs[0];
        
        const autoMessage = new Message({
          conversationId: conversation._id,
          senderType: 'bot',
          senderId: 'auto-faq',
          senderName: 'Support Bot',
          content: faq.answer
        });
        await autoMessage.save();

        faq.viewCount++;
        await faq.save();

        this.widgetNamespace.to(`conversation:${conversation._id}`).emit('new-message', {
          message: autoMessage
        });

        this.adminNamespace.to(`conversation:${conversation._id}`).emit('new-message', {
          message: autoMessage,
          conversation
        });

        this.adminNamespace.to(`site:${conversation.siteId}`).emit('new-message', {
          message: autoMessage,
          conversation
        });
      }
    } catch (error) {

    }
  }
}

export default SocketHandler;