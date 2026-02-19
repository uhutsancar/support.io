const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Site = require('../models/Site');
const FAQ = require('../models/FAQ');
const Team = require('../models/Team');
const Department = require('../models/Department');
const TeamMessage = require('../models/TeamMessage');
const TeamChat = require('../models/TeamChat');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.widgetNamespace = io.of('/widget');
    this.adminNamespace = io.of('/admin');
    
    this.setupWidgetHandlers();
    this.setupAdminHandlers();
    
    this.startSLAMonitoring();
  }

  setupWidgetHandlers() {
    this.widgetNamespace.on('connection', async (socket) => {

      socket.on('join-conversation', async (data) => {
        try {
          const { siteKey, visitorId, visitorName, visitorEmail, currentPage, metadata } = data;

          const site = await Site.findOne({ siteKey, isActive: true });
          if (!site) {
            socket.emit('error', { message: 'Invalid site key' });
            return;
          }

          socket.siteId = site._id;
          socket.visitorId = visitorId;
          socket.visitorName = visitorName || 'Visitor';
          socket.visitorEmail = visitorEmail;
          socket.currentPage = currentPage;
          socket.metadata = metadata;

          let conversation = await Conversation.findOne({
            siteId: site._id,
            visitorId,
            status: { $in: ['open', 'assigned', 'pending'] }
          }).populate('department', 'name color icon');

          if (conversation) {
            socket.join(`conversation:${conversation._id}`);
            socket.conversationId = conversation._id;

            conversation.currentPage = currentPage;
            await conversation.save();

            const messages = await Message.find({ conversationId: conversation._id })
              .sort({ createdAt: 1 });

            conversation.calculateSLA();
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

        } catch (error) {
          console.error('Join conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('send-message', async (data) => {
        try {
          const { content, senderName, messageType, fileData } = data;
          let conversationId = socket.conversationId;

          if (!conversationId) {
            const site = await Site.findById(socket.siteId);
            if (!site) {
              socket.emit('error', { message: 'Site not found' });
              return;
            }

            let department = await Department.findOne({
              siteId: socket.siteId,
              isActive: true
            }).sort({ createdAt: 1 });

            const conversation = new Conversation({
              siteId: socket.siteId,
              visitorId: socket.visitorId,
              visitorName: socket.visitorName,
              visitorEmail: socket.visitorEmail,
              currentPage: socket.currentPage,
              metadata: socket.metadata,
              department: department?._id,
              status: 'open',
              channel: 'web-chat',
              priority: 'normal'
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

            await conversation.save();

            conversation.calculateSLA();
            await conversation.save();

            if (department) {
              department.stats.totalConversations++;
              department.stats.activeConversations++;
              await department.save();
            }

            socket.join(`conversation:${conversation._id}`);
            socket.conversationId = conversation._id;
            conversationId = conversation._id;

            this.adminNamespace.to(`site:${socket.siteId}`).emit('new-conversation', {
              conversation: await conversation.populate('department', 'name color icon')
            });
          }

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          const messageData = {
            conversationId,
            senderType: 'visitor',
            senderId: conversation.visitorId,
            senderName: senderName || conversation.visitorName,
            content,
            messageType: messageType || 'text',
            isRead: false
          };

          if (fileData && (messageType === 'file' || messageType === 'image')) {
            messageData.fileData = fileData;
          }

          const message = new Message(messageData);
          await message.save();

          conversation.lastMessageAt = new Date();
          await conversation.save();

          this.widgetNamespace.to(`conversation:${conversationId}`).emit('new-message', { message });

          // Admin interfaces (owners/admins) receive all messages for the site
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('new-message', {
            message,
            conversation
          });

          // If conversation is assigned to an agent, notify that agent specifically
          if (conversation.assignedAgent) {
            this.adminNamespace.to(`user:${conversation.assignedAgent}`).emit('new-message', {
              message,
              conversation
            });
          }

          // Notify admin dashboards scoped to the site room
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('notification', {
            type: 'new-message',
            message: `New message from ${conversation.visitorName}`,
            siteId: conversation.siteId,
            conversationId: conversation._id,
            timestamp: new Date()
          });

          await this.tryAutoResponse(conversation, content);

        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('typing', () => {
        if (socket.conversationId) {
          this.adminNamespace.to(`conversation:${socket.conversationId}`).emit('visitor-typing', {
            conversationId: socket.conversationId
          });
        }
      });

      socket.on('disconnect', () => {
      });
    });
  }

  setupAdminHandlers() {

    this.adminNamespace.on('connection', async (socket) => {
      console.log('[SOCKET] Yeni admin bağlantısı:', socket.id);
      console.log('[SOCKET] handshake.auth:', socket.handshake.auth);
      // Bağlantı anında userId'yi auth token'dan veya handshake'den al
      if (socket.handshake.auth && socket.handshake.auth.token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(socket.handshake.auth.token.replace('Bearer ', ''), process.env.JWT_SECRET);
          if (decoded && decoded.userId) {
            socket.userId = decoded.userId;
            socket.organizationId = decoded.organizationId || null;
            socket.role = decoded.role || null; // owner, admin, agent, etc.
            console.log('[SOCKET] Token ile userId bulundu:', socket.userId, 'org:', socket.organizationId, 'role:', socket.role);
          }
        } catch (err) {
          console.error('Socket auth token decode error:', err.message);
        }
      // Ensure personal room is joined so agents always receive personal emits
      try {
        if (socket.userId) {
          socket.join(`user:${socket.userId}`);
          console.log('[SOCKET] auto-joined personal room:', `user:${socket.userId}`);
        }
      } catch (e) {
        console.error('Failed to auto-join personal room:', e.message);
      }
      }

      socket.on('join-site', async (data) => {
        try {
          const { siteId, userId } = data;
          if (userId) socket.userId = userId;
          socket.siteId = siteId;
          console.log('[SOCKET] join-site çağrıldı:', { siteId, userId, role: socket.role });

          // Admin/Owner should join the site room to receive all site messages
          if (socket.role === 'owner' || socket.role === 'admin') {
            if (siteId) {
              socket.join(`site:${siteId}`);
              console.log('[SOCKET] admin/owner joined site room:', siteId);
            } else {
              console.log('[SOCKET] join-site called for admin without siteId; skipping site room join');
            }
          } else if (socket.role === 'agent' || socket.role === 'manager') {
            // Agents/managers should not auto-join the global site room.
            // They should join their personal room to receive assignment notifications.
            if (socket.userId) {
              socket.join(`user:${socket.userId}`);
              console.log('[SOCKET] agent/manager joined user room:', socket.userId);
            }
          }
        } catch (error) {
          console.error('Join site error:', error.message);
        }
      });

      socket.on('join-conversation', async (data) => {
        try {
          const { conversationId } = data;
          socket.join(`conversation:${conversationId}`);
          
          await Message.updateMany(
            { conversationId, isRead: false, senderType: 'visitor' },
            { isRead: true, readAt: new Date() }
          );

        } catch (error) {
          console.error('Join conversation error:', error);
        }
      });

      socket.on('send-message', async (data) => {
        try {
          const { conversationId, content, senderName, senderId, messageType, fileData } = data;
          
          const actualSenderId = senderId || socket.userId || 'support';
          const actualSenderName = senderName || 'Support';

          const conversation = await Conversation.findById(conversationId)
            .populate('department');
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          if (!conversation.assignedAgent && socket.userId) {
            conversation.assignedAgent = socket.userId;
            conversation.assignedAt = new Date();
            conversation.status = 'assigned';
          }

          if (!conversation.firstResponseAt) {
            conversation.firstResponseAt = new Date();
            
            conversation.calculateSLA();
            
            if (socket.userId) {
              const agent = await Team.findById(socket.userId);
              if (agent) {
                const responseTime = Math.floor((conversation.firstResponseAt - conversation.createdAt) / 1000 / 60);
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

          const messageData = {
            conversationId,
            senderType: 'agent',
            senderId: actualSenderId,
            senderName: actualSenderName,
            content,
            messageType: messageType || 'text',
            isRead: true
          };

          if (fileData && (messageType === 'file' || messageType === 'image')) {
            messageData.fileData = fileData;
          }

          const message = new Message(messageData);
          await message.save();

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
          console.error('Send message error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('typing', (data) => {
        const { conversationId } = data;
        this.widgetNamespace.to(`conversation:${conversationId}`).emit('agent-typing');
      });

      socket.on('update-status', async (data) => {
        try {
          const { status } = data;
          await Team.findByIdAndUpdate(socket.userId, { status });
          // Notify admins for the site (if joined) and also notify user room
          if (socket.siteId) {
            this.adminNamespace.to(`site:${socket.siteId}`).emit('agent-status-changed', {
              userId: socket.userId,
              status
            });
          } else {
            this.adminNamespace.emit('agent-status-changed', {
              userId: socket.userId,
              status
            });
          }
          this.adminNamespace.to(`user:${socket.userId}`).emit('agent-status-changed', {
            userId: socket.userId,
            status
          });
        } catch (error) {
          console.error('Update status error:', error);
        }
      });

      socket.on('assign-conversation', async (data) => {
        try {
          const { conversationId, agentId } = data;
          
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          // Only admin/owner can assign conversations
          if (!(socket.role === 'owner' || socket.role === 'admin')) {
            socket.emit('error', { message: 'Yetersiz yetki: atama işlemi için admin gerekli.' });
            return;
          }

          conversation.assignedAgent = agentId;
          conversation.assignedBy = socket.userId;
          conversation.assignedAt = new Date();
          conversation.status = 'assigned';
          await conversation.save();
          
          // Increment stats on the Team or User depending which exists
          try {
            const Team = require('../models/Team');
            const User = require('../models/User');
            const team = await Team.findById(agentId).select('_id');
            if (team) {
              await Team.findByIdAndUpdate(agentId, {
                $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
              }).catch(() => {});
            } else {
              const userDoc = await User.findById(agentId).select('_id');
              if (userDoc) {
                await User.findByIdAndUpdate(agentId, {
                  $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
                }).catch(() => {});
              }
            }
          } catch (e) {
            console.error('Assign stats update error:', e.message);
          }
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-assigned', {
            conversationId,
            agentId,
            assignedBy: socket.userId
          });

          // Notify the assigned agent in their personal room (team member or user)
          try {
            const Team = require('../models/Team');
            const User = require('../models/User');
            const team = await Team.findById(agentId).select('_id');
            if (team) {
              this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
                conversationId,
                agentId,
                assignedBy: socket.userId,
                siteId: conversation.siteId
              });
              console.log('[EMIT] conversation-assigned -> user:' + agentId + ' (team via socket)');
            } else {
              const userDoc = await User.findById(agentId).select('_id');
              if (userDoc) {
                this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
                  conversationId,
                  agentId,
                  assignedBy: socket.userId,
                  siteId: conversation.siteId
                });
                console.log('[EMIT] conversation-assigned -> user:' + agentId + ' (user via socket)');
              } else {
                this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
                  conversationId,
                  agentId,
                  assignedBy: socket.userId,
                  siteId: conversation.siteId
                });
                console.log('[EMIT] conversation-assigned -> user:' + agentId + ' (fallback via socket)');
              }
            }
          } catch (e) {
            console.error('Emit conversation-assigned (socket) error:', e.message);
            this.adminNamespace.to(`user:${agentId}`).emit('conversation-assigned', {
              conversationId,
              agentId,
              assignedBy: socket.userId,
              siteId: conversation.siteId
            });
          }
        } catch (error) {
          console.error('Assign conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('claim-conversation', async (data) => {
        try {
          const { conversationId } = data;
          
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          if (conversation.assignedAgent) {
            socket.emit('error', { message: 'Conversation is already assigned' });
            return;
          }
          
          const agent = await Team.findById(socket.userId);
          const maxConversations = agent.permissions?.maxActiveConversations || 10;
          if (agent.stats.activeConversations >= maxConversations) {
            socket.emit('error', { message: 'Maximum active conversations reached' });
            return;
          }
          
          conversation.assignedAgent = socket.userId;
          conversation.assignedBy = socket.userId;
          conversation.assignedAt = new Date();
          conversation.status = 'assigned';
          await conversation.save();
          
          await Team.findByIdAndUpdate(socket.userId, {
            $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
          });
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-claimed', {
            conversationId,
            agentId: socket.userId
          });

          // Notify the claiming agent (they are the claimer) in their personal room
          this.adminNamespace.to(`user:${socket.userId}`).emit('conversation-claimed', {
            conversationId,
            agentId: socket.userId
          });
        } catch (error) {
          console.error('Claim conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('set-department', async (data) => {
        try {
          console.log('[SOCKET] team-chat-send çağrıldı:', data);
          const { conversationId, departmentId } = data;
          
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          // Only admin/owner may change department
          if (!(socket.role === 'owner' || socket.role === 'admin')) {
            socket.emit('error', { message: 'Yetersiz yetki: departman ataması için admin gerekli.' });
            return;
          }

          const oldDepartmentId = conversation.department;
          conversation.department = departmentId;

          console.log('[SOCKET] team-chat-send sender userId:', socket.userId);
          if (departmentId) {
            const newDepartment = await Department.findById(departmentId);
            if (newDepartment && newDepartment.sla.enabled) {
              const priority = conversation.priority;
              conversation.sla.firstResponseTarget = newDepartment.sla.firstResponse[priority] || 30;
              conversation.sla.resolutionTarget = newDepartment.sla.resolution[priority] || 480;
          console.log('[SOCKET] team-chat-send sender bulundu:', sender);
              
              conversation.calculateSLA();
            }
            
            await Department.findByIdAndUpdate(departmentId, {
              $inc: { 'stats.activeConversations': 1 }
            });
          }
          
          await conversation.save();
          
          if (oldDepartmentId) {
            await Department.findByIdAndUpdate(oldDepartmentId, {
              $inc: { 'stats.activeConversations': -1 }
            });
          }
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-department-changed', {
            conversationId,
            departmentId,
            conversation
          });
        } catch (error) {
          console.error('Set department error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('set-priority', async (data) => {
        try {
          const { conversationId, priority } = data;
          
          const conversation = await Conversation.findById(conversationId)
            .populate('department');
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          conversation.priority = priority;
          
          if (conversation.department && conversation.department.sla.enabled) {
            conversation.sla.firstResponseTarget = conversation.department.sla.firstResponse[priority] || 30;
            conversation.sla.resolutionTarget = conversation.department.sla.resolution[priority] || 480;
            
            conversation.calculateSLA();
          }
          
          await conversation.save();
          
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-priority-changed', {
            conversationId,
            priority,
            conversation
          });
        } catch (error) {
          console.error('Set priority error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // ===== TEAM CHAT SOCKET EVENTS =====

      socket.on('team-chat-join', (data) => {
        const { chatId } = data;
        if (!socket.userId) {
          socket.emit('error', { message: 'Kimlik doğrulama hatası: userId yok.' });
          return;
        }
        socket.join(`team-chat:${chatId}`);
      });

      socket.on('team-chat-leave', (data) => {
        const { chatId } = data;
        socket.leave(`team-chat:${chatId}`);
      });

      socket.on('team-chat-send', async (data) => {
        try {
          if (!socket.userId) {
            console.error('team-chat-send: userId yok!');
            socket.emit('error', { message: 'Kimlik doğrulama hatası: userId yok.' });
            return;
          }
          const { chatId, content, chatType } = data;
          const mongoose = require('mongoose');
          let userId = socket.userId;
          if (typeof userId === 'string' && userId.length === 24 && userId.match(/^[a-fA-F0-9]+$/)) {
            userId = new mongoose.Types.ObjectId(userId);
          }
          let sender = await Team.findById(userId).select('name');
          if (!sender) {
            // Eğer Team'de yoksa User'da ara
            const User = require('../models/User');
            sender = await User.findById(userId).select('name');
          }
          if (!sender) {
            console.error('team-chat-send: sender bulunamadı! userId:', userId);
            socket.emit('error', { message: 'Kullanıcı bulunamadı.' });
            return;
          }

          const message = new TeamMessage({
            chatId,
            chatType: chatType || 'direct',
            senderId: sender._id,
            senderName: sender.name,
            content,
            readBy: [sender._id]
          });
          await message.save();

          await TeamChat.findOneAndUpdate(
            { chatId },
            {
              lastMessage: {
                content,
                senderId: sender._id,
                senderName: sender.name,
                createdAt: new Date()
              }
            }
          );

          this.adminNamespace.to(`team-chat:${chatId}`).emit('team-chat-message', {
            message
          });

          const chat = await TeamChat.findOne({ chatId });
          if (chat) {
            chat.participants.forEach(pId => {
              if (pId.toString() !== sender._id.toString()) {
                // Notify participant's personal room instead of global emit
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
          console.error('Team chat send error:', error);
        }
      });

      socket.on('team-chat-typing', (data) => {
        const { chatId, userName } = data;
        socket.to(`team-chat:${chatId}`).emit('team-chat-user-typing', {
          chatId,
          userName
        });
      });
      // ===== END TEAM CHAT =====

      socket.on('resolve-conversation', async (data) => {
        try {
          const { conversationId } = data;
          
          const conversation = await Conversation.findById(conversationId)
            .populate('department');
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          conversation.status = 'resolved';
          conversation.resolvedAt = new Date();
          
          conversation.calculateSLA();
          
          await conversation.save();
          
          if (conversation.department) {
            const dept = await Department.findById(conversation.department._id);
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
          console.error('Resolve conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('disconnect', () => {
      });
    });
  }

  startSLAMonitoring() {
    setInterval(async () => {
      try {
        const activeConversations = await Conversation.find({
          status: { $in: ['open', 'assigned', 'pending'] }
        })
        .populate('department', 'name color icon')
        .populate('assignedAgent', 'name email avatar');

        for (const conversation of activeConversations) {
          const previousFirstResponseStatus = conversation.sla.firstResponseStatus;
          const previousResolutionStatus = conversation.sla.resolutionStatus;
          const previousFirstResponseRemaining = conversation.sla.firstResponseTimeRemaining;
          const previousResolutionRemaining = conversation.sla.resolutionTimeRemaining;
          
          conversation.calculateSLA();
          await conversation.save();
          
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
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'first-response',
              conversation: conversation.toObject()
            });
            // also notify globally within the site rooms only (avoid broadcasting to agents globally)
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'first-response',
              conversation: conversation.toObject()
            });
          }
          
          if (previousResolutionStatus !== 'breached' && conversation.sla.resolutionStatus === 'breached') {
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'resolution',
              conversation: conversation.toObject()
            });
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'resolution',
              conversation: conversation.toObject()
            });
          }
        }
      } catch (error) {
        console.error('❌ SLA monitoring error:', error);
      }
    }, 30000);
  }

  async tryAutoResponse(conversation, userMessage) {
    try {
      const site = await Site.findById(conversation.siteId);
      
      const faqs = await FAQ.find({
        siteId: conversation.siteId,
        isActive: true,
        $text: { $search: userMessage }
      }, {
        score: { $meta: 'textScore' }
      }).sort({ score: { $meta: 'textScore' } }).limit(1);

      if (faqs.length > 0 && faqs[0].score > 0.5) {
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
      console.error('Auto-response error:', error);
    }
  }
}

module.exports = SocketHandler;
