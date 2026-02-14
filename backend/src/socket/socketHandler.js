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

          // Find or create conversation (ticket)
          let conversation = await Conversation.findOne({
            siteId: site._id,
            visitorId,
            status: { $in: ['open', 'assigned', 'pending'] }
          });

          if (!conversation) {
            // Get default department or find best match
            let department = await Department.findOne({
              siteId: site._id,
              isActive: true
            }).sort({ createdAt: 1 });

            // Create new ticket
            conversation = new Conversation({
              siteId: site._id,
              visitorId,
              visitorName: visitorName || 'Visitor',
              visitorEmail,
              currentPage,
              metadata,
              department: department?._id,
              status: 'open',
              channel: 'web-chat',
              priority: 'normal'
            });

            // SLA hedeflerini departmandan al
            if (department && department.sla.enabled) {
              const priority = conversation.priority;
              conversation.sla.firstResponseTarget = department.sla.firstResponse[priority] || 30;
              conversation.sla.resolutionTarget = department.sla.resolution[priority] || 480;
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

            // Send welcome message
            const welcomeMessage = new Message({
              conversationId: conversation._id,
              senderType: 'bot',
              senderId: 'system',
              senderName: 'Support',
              content: site.widgetSettings.welcomeMessage || 'Merhaba! Size nasıl yardımcı olabiliriz?'
            });
            await welcomeMessage.save();

            // Notify admins about new ticket
            this.adminNamespace.to(`site:${site._id}`).emit('new-conversation', {
              conversation: await conversation.populate('department', 'name color icon')
            });

          } else {
            // Update current page
            conversation.currentPage = currentPage;
            await conversation.save();
          }

          socket.join(`conversation:${conversation._id}`);
          socket.conversationId = conversation._id;
          socket.siteId = site._id;

          // Send conversation data
          const messages = await Message.find({ conversationId: conversation._id })
            .sort({ createdAt: 1 });

          // SLA'yı yeniden hesapla
          conversation.calculateSLA();
          await conversation.save();

          socket.emit('conversation-joined', {
            conversation,
            messages
          });

          // Notify admins about new/active conversation
          this.adminNamespace.to(`site:${site._id}`).emit('conversation-update', {
            conversation
          });

        } catch (error) {
          console.error('Join conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Send message from visitor
      socket.on('send-message', async (data) => {
        try {
          const { content, senderName, messageType, fileData } = data;
          const conversationId = socket.conversationId;

          if (!conversationId) {
            socket.emit('error', { message: 'Not in a conversation' });
            return;
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
        }).populate('department');

        for (const conversation of activeConversations) {
          const previousFirstResponseStatus = conversation.sla.firstResponseStatus;
          const previousResolutionStatus = conversation.sla.resolutionStatus;
          
          // SLA'yı yeniden hesapla
          conversation.calculateSLA();
          await conversation.save();
          
          // SLA ihlali oluştuysa bildirim gönder
          if (previousFirstResponseStatus !== 'breached' && conversation.sla.firstResponseStatus === 'breached') {
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'first-response',
              conversation
            });
          }
          
          if (previousResolutionStatus !== 'breached' && conversation.sla.resolutionStatus === 'breached') {
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-breach', {
              conversationId: conversation._id,
              ticketNumber: conversation.ticketNumber,
              type: 'resolution',
              conversation
            });
          }
          
          // Kalan süre azaldıysa güncelleme gönder (her 5 dakikada bir)
          const remainingMinutes = conversation.sla.firstResponseTimeRemaining || conversation.sla.resolutionTimeRemaining;
          if (remainingMinutes !== null && remainingMinutes % 5 === 0) {
            this.adminNamespace.to(`site:${conversation.siteId}`).emit('sla-update', {
              conversationId: conversation._id,
              sla: conversation.sla
            });
          }
        }
      } catch (error) {
        console.error('SLA monitoring error:', error);
      }
    }, 60000); // Her 1 dakika
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
