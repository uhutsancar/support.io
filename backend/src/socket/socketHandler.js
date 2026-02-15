const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Site = require('../models/Site');
const FAQ = require('../models/FAQ');
const Team = require('../models/Team');
const Department = require('../models/Department');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.widgetNamespace = io.of('/widget');
    this.adminNamespace = io.of('/admin');
    
    this.setupWidgetHandlers();
    this.setupAdminHandlers();
    
    // SLA takip için periyodik kontrol
    this.startSLAMonitoring();
  }

  setupWidgetHandlers() {
    this.widgetNamespace.on('connection', async (socket) => {

      // Join conversation room
      socket.on('join-conversation', async (data) => {
        try {
          const { siteKey, visitorId, visitorName, visitorEmail, currentPage, metadata } = data;

          // Verify site
          const site = await Site.findOne({ siteKey, isActive: true });
          if (!site) {
            socket.emit('error', { message: 'Invalid site key' });
            return;
          }

          // Store visitor info in socket
          socket.siteId = site._id;
          socket.visitorId = visitorId;
          socket.visitorName = visitorName || 'Visitor';
          socket.visitorEmail = visitorEmail;
          socket.currentPage = currentPage;
          socket.metadata = metadata;

          // Find existing active conversation
          let conversation = await Conversation.findOne({
            siteId: site._id,
            visitorId,
            status: { $in: ['open', 'assigned', 'pending'] }
          }).populate('department', 'name color icon');

          if (conversation) {
            // Existing conversation found - join it
            socket.join(`conversation:${conversation._id}`);
            socket.conversationId = conversation._id;

            // Update current page
            conversation.currentPage = currentPage;
            await conversation.save();

            // Send conversation data with messages
            const messages = await Message.find({ conversationId: conversation._id })
              .sort({ createdAt: 1 });

            // SLA'yı yeniden hesapla
            conversation.calculateSLA();
            await conversation.save();

            socket.emit('conversation-joined', {
              conversation,
              messages
            });
          } else {
            // No active conversation - send welcome message locally (not saved to DB)
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

      // Send message from visitor
      socket.on('send-message', async (data) => {
        try {
          const { content, senderName, messageType, fileData } = data;
          let conversationId = socket.conversationId;

          // If no conversation exists, create one NOW
          if (!conversationId) {
            const site = await Site.findById(socket.siteId);
            if (!site) {
              socket.emit('error', { message: 'Site not found' });
              return;
            }

            // Get default department
            let department = await Department.findOne({
              siteId: socket.siteId,
              isActive: true
            }).sort({ createdAt: 1 });

            // Create new ticket (conversation)
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

            // SLA hedeflerini priority'e göre ayarla
            const slaTargets = {
              urgent: { firstResponse: 5, resolution: 60 },
              high: { firstResponse: 10, resolution: 120 },
              normal: { firstResponse: 15, resolution: 240 },
              low: { firstResponse: 30, resolution: 480 }
            };
            
            const priority = conversation.priority;
            
            // Departman SLA ayarları varsa onları kullan, yoksa default'ları kullan
            if (department && department.sla && department.sla.enabled) {
              conversation.sla.firstResponseTarget = department.sla.firstResponse?.[priority] || slaTargets[priority].firstResponse;
              conversation.sla.resolutionTarget = department.sla.resolution?.[priority] || slaTargets[priority].resolution;
            } else {
              conversation.sla.firstResponseTarget = slaTargets[priority].firstResponse;
              conversation.sla.resolutionTarget = slaTargets[priority].resolution;
            }

            await conversation.save();

            // İlk SLA hesaplaması
            conversation.calculateSLA();
            await conversation.save();

            // Departman istatistiklerini güncelle
            if (department) {
              department.stats.totalConversations++;
              department.stats.activeConversations++;
              await department.save();
            }

            // Join conversation room
            socket.join(`conversation:${conversation._id}`);
            socket.conversationId = conversation._id;
            conversationId = conversation._id;

            // Notify admins about new ticket
            this.adminNamespace.to(`site:${socket.siteId}`).emit('new-conversation', {
              conversation: await conversation.populate('department', 'name color icon')
            });
          }

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          // Create message (visitor messages default to unread)
          const messageData = {
            conversationId,
            senderType: 'visitor',
            senderId: conversation.visitorId,
            senderName: senderName || conversation.visitorName,
            content,
            messageType: messageType || 'text',
            isRead: false // Visitor messages start as unread for admin
          };

          // Dosya varsa ekle
          if (fileData && (messageType === 'file' || messageType === 'image')) {
            messageData.fileData = fileData;
          }

          const message = new Message(messageData);
          await message.save();

          // Update conversation
          conversation.lastMessageAt = new Date();
          await conversation.save();

          // Send to visitor
          this.widgetNamespace.to(`conversation:${conversationId}`).emit('new-message', {
            message
          });

          // Send to admins in conversation room
          this.adminNamespace.to(`conversation:${conversationId}`).emit('new-message', {
            message,
            conversation
          });

          // Also send to all admins watching this site (for real-time updates)
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('new-message', {
            message,
            conversation
          });

          // Send notification to all connected admins
          this.adminNamespace.emit('notification', {
            type: 'new-message',
            message: `New message from ${conversation.visitorName}`,
            siteId: conversation.siteId,
            conversationId: conversation._id,
            timestamp: new Date()
          });

          // Try to auto-respond with FAQ
          await this.tryAutoResponse(conversation, content);

        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Typing indicator
      socket.on('typing', () => {
        if (socket.conversationId) {
          this.adminNamespace.to(`conversation:${socket.conversationId}`).emit('visitor-typing', {
            conversationId: socket.conversationId
          });
        }
      });

      socket.on('disconnect', () => {
        // Widget disconnected
      });
    });
  }

  setupAdminHandlers() {
    this.adminNamespace.on('connection', async (socket) => {

      // Join site rooms
      socket.on('join-site', async (data) => {
        try {
          const { siteId, userId } = data;
          socket.join(`site:${siteId}`);
          socket.siteId = siteId;
          socket.userId = userId;
        } catch (error) {
          console.error('Join site error:', error.message);
        }
      });

      // Join specific conversation
      socket.on('join-conversation', async (data) => {
        try {
          const { conversationId } = data;
          socket.join(`conversation:${conversationId}`);
          
          // Mark messages as read
          await Message.updateMany(
            { conversationId, isRead: false, senderType: 'visitor' },
            { isRead: true, readAt: new Date() }
          );

        } catch (error) {
          console.error('Join conversation error:', error);
        }
      });

      // Send message from agent
      socket.on('send-message', async (data) => {
        try {
          const { conversationId, content, senderName, senderId, messageType, fileData } = data;
          
          // Use provided senderId, fallback to socket.userId, or 'support'
          const actualSenderId = senderId || socket.userId || 'support';
          const actualSenderName = senderName || 'Support';

          const conversation = await Conversation.findById(conversationId)
            .populate('department');
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          // Auto-assign if not assigned
          if (!conversation.assignedAgent && socket.userId) {
            conversation.assignedAgent = socket.userId;
            conversation.assignedAt = new Date();
            conversation.status = 'assigned';
          }

          // İlk agent yanıtı ise kaydet ve SLA'yı güncelle
          if (!conversation.firstResponseAt) {
            conversation.firstResponseAt = new Date();
            
            // SLA'yı yeniden hesapla
            conversation.calculateSLA();
            
            // Agent istatistiklerini güncelle
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
            
            // Emit conversation-update event for SLA update
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

          // Dosya varsa ekle
          if (fileData && (messageType === 'file' || messageType === 'image')) {
            messageData.fileData = fileData;
          }

          const message = new Message(messageData);
          await message.save();

          conversation.lastMessageAt = new Date();
          await conversation.save();

          // Send to visitor
          this.widgetNamespace.to(`conversation:${conversationId}`).emit('new-message', {
            message
          });

          // Send to admins in conversation room with updated SLA
          this.adminNamespace.to(`conversation:${conversationId}`).emit('new-message', {
            message,
            conversation
          });

          // Also send to all admins watching this site
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('new-message', {
            message,
            conversation
          });

        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Typing indicator
      socket.on('typing', (data) => {
        const { conversationId } = data;
        this.widgetNamespace.to(`conversation:${conversationId}`).emit('agent-typing');
      });

      // Agent status update
      socket.on('update-status', async (data) => {
        try {
          const { status } = data;
          await Team.findByIdAndUpdate(socket.userId, { status });
          
          // Broadcast to all admins
          this.adminNamespace.emit('agent-status-changed', {
            userId: socket.userId,
            status
          });
        } catch (error) {
          console.error('Update status error:', error);
        }
      });

      // Assign conversation
      socket.on('assign-conversation', async (data) => {
        try {
          const { conversationId, agentId } = data;
          
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          conversation.assignedAgent = agentId;
          conversation.assignedBy = socket.userId;
          conversation.assignedAt = new Date();
          conversation.status = 'assigned';
          await conversation.save();
          
          // Update agent stats
          await Team.findByIdAndUpdate(agentId, {
            $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
          });
          
          // Broadcast to all admins in site
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-assigned', {
            conversationId,
            agentId,
            assignedBy: socket.userId
          });
        } catch (error) {
          console.error('Assign conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Claim conversation (self-assign)
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
          
          // Check agent's load
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
          
          // Update agent stats
          await Team.findByIdAndUpdate(socket.userId, {
            $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
          });
          
          // Broadcast to all admins in site
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-claimed', {
            conversationId,
            agentId: socket.userId
          });
        } catch (error) {
          console.error('Claim conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Update conversation department
      socket.on('set-department', async (data) => {
        try {
          const { conversationId, departmentId } = data;
          
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }
          
          const oldDepartmentId = conversation.department;
          conversation.department = departmentId;
          
          // Yeni departmanın SLA kurallarını uygula
          if (departmentId) {
            const newDepartment = await Department.findById(departmentId);
            if (newDepartment && newDepartment.sla.enabled) {
              const priority = conversation.priority;
              conversation.sla.firstResponseTarget = newDepartment.sla.firstResponse[priority] || 30;
              conversation.sla.resolutionTarget = newDepartment.sla.resolution[priority] || 480;
              
              // SLA'yı yeniden hesapla
              conversation.calculateSLA();
            }
            
            // Yeni departman istatistiklerini güncelle
            await Department.findByIdAndUpdate(departmentId, {
              $inc: { 'stats.activeConversations': 1 }
            });
          }
          
          await conversation.save();
          
          // Eski departman istatistiklerini güncelle
          if (oldDepartmentId) {
            await Department.findByIdAndUpdate(oldDepartmentId, {
              $inc: { 'stats.activeConversations': -1 }
            });
          }
          
          // Broadcast to all admins in site
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

      // Update conversation priority
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
          
          // SLA hedeflerini önceliğe göre güncelle
          if (conversation.department && conversation.department.sla.enabled) {
            conversation.sla.firstResponseTarget = conversation.department.sla.firstResponse[priority] || 30;
            conversation.sla.resolutionTarget = conversation.department.sla.resolution[priority] || 480;
            
            // SLA'yı yeniden hesapla
            conversation.calculateSLA();
          }
          
          await conversation.save();
          
          // Broadcast to all admins in site
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

      // Resolve conversation
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
          
          // SLA'yı son kez hesapla
          conversation.calculateSLA();
          
          await conversation.save();
          
          // Departman istatistiklerini güncelle
          if (conversation.department) {
            const dept = await Department.findById(conversation.department._id);
            dept.stats.activeConversations = Math.max(0, dept.stats.activeConversations - 1);
            
            // SLA istatistiklerini güncelle
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
            
            // Ortalama yanıt sürelerinigüncelle
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
          
          // Agent istatistiklerini güncelle
          if (conversation.assignedAgent) {
            await Team.findByIdAndUpdate(conversation.assignedAgent, {
              $inc: { 
                'stats.activeConversations': -1,
                'stats.resolvedConversations': 1
              }
            });
          }
          
          // Broadcast to all admins in site
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
        // Admin disconnected
      });
    });
  }

  // SLA takip sistemi - Her 1 dakikada bir tüm aktif ticketları kontrol eder
  startSLAMonitoring() {
    setInterval(async () => {
      try {
        // Açık ve atanmış tüm conversation'ları getir
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
          
          // SLA'yı yeniden hesapla
          conversation.calculateSLA();
          await conversation.save();
          
          // HER KONUŞMA İÇİN SLA GÜNCELLEMESİ GÖNDER (countdown için)
          // Sadece kalan süre değiştiyse emit et (performans için)
          if (previousFirstResponseRemaining !== conversation.sla.firstResponseTimeRemaining ||
              previousResolutionRemaining !== conversation.sla.resolutionTimeRemaining ||
              previousFirstResponseStatus !== conversation.sla.firstResponseStatus ||
              previousResolutionStatus !== conversation.sla.resolutionStatus) {
            
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('conversation-update', {
              conversationId: conversation._id,
              conversation: conversation.toObject()
            });
          }
          
          // SLA ihlali oluştuysa bildirim gönder
          if (previousFirstResponseStatus !== 'breached' && conversation.sla.firstResponseStatus === 'breached') {
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'first-response',
              conversation: conversation.toObject()
            });
            // Tüm admin'lere de gönder
            this.adminNamespace.emit('sla-breach', {
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
            // Tüm admin'lere de gönder
            this.adminNamespace.emit('sla-breach', {
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
    }, 30000); // Her 30 saniye
  }

  async tryAutoResponse(conversation, userMessage) {
    try {
      const site = await Site.findById(conversation.siteId);
      
      // Search for relevant FAQ
      const faqs = await FAQ.find({
        siteId: conversation.siteId,
        isActive: true,
        $text: { $search: userMessage }
      }, {
        score: { $meta: 'textScore' }
      }).sort({ score: { $meta: 'textScore' } }).limit(1);

      if (faqs.length > 0 && faqs[0].score > 0.5) {
        const faq = faqs[0];
        
        // Send auto-response
        const autoMessage = new Message({
          conversationId: conversation._id,
          senderType: 'bot',
          senderId: 'auto-faq',
          senderName: 'Support Bot',
          content: faq.answer
        });
        await autoMessage.save();

        // Update FAQ stats
        faq.viewCount++;
        await faq.save();

        // Send to widget
        this.widgetNamespace.to(`conversation:${conversation._id}`).emit('new-message', {
          message: autoMessage
        });

        // Send to admins in conversation room
        this.adminNamespace.to(`conversation:${conversation._id}`).emit('new-message', {
          message: autoMessage,
          conversation
        });

        // Also send to all admins watching this site
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
