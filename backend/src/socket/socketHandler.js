const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Site = require('../models/Site');
const FAQ = require('../models/FAQ');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.widgetNamespace = io.of('/widget');
    this.adminNamespace = io.of('/admin');
    
    this.setupWidgetHandlers();
    this.setupAdminHandlers();
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

          // Find or create conversation
          let conversation = await Conversation.findOne({
            siteId: site._id,
            visitorId,
            status: { $in: ['open', 'assigned'] }
          });

          if (!conversation) {
            conversation = new Conversation({
              siteId: site._id,
              visitorId,
              visitorName: visitorName || 'Visitor',
              visitorEmail,
              currentPage,
              metadata
            });
            await conversation.save();

            // Send welcome message
            const welcomeMessage = new Message({
              conversationId: conversation._id,
              senderType: 'bot',
              senderId: 'system',
              senderName: 'Support',
              content: site.widgetSettings.welcomeMessage || 'Hi! How can we help you today?'
            });
            await welcomeMessage.save();
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

          socket.emit('conversation-joined', {
            conversation,
            messages
          });

          // Notify admins about new/active conversation
          this.adminNamespace.to(`site:${site._id}`).emit('conversation-update', {
            conversation
          });
          console.log(`🔔 Conversation update sent to site: ${site._id}`);

        } catch (error) {
          console.error('Join conversation error:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Send message from visitor
      socket.on('send-message', async (data) => {
        try {
          const { content, senderName } = data;
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
          const message = new Message({
            conversationId,
            senderType: 'visitor',
            senderId: conversation.visitorId,
            senderName: senderName || conversation.visitorName,
            content,
            isRead: false // Visitor messages start as unread for admin
          });
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

          console.log(`📨 Message sent to admins: conversation:${conversationId} & site:${conversation.siteId}`);
          console.log(`🔔 Notification sent to all admins`);

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
          console.log(`👤 Admin ${userId} joined site room: ${siteId}`);
        } catch (error) {
          console.error('Join site error:', error.message);
        }
      });

      // Join specific conversation
      socket.on('join-conversation', async (data) => {
        try {
          const { conversationId } = data;
          socket.join(`conversation:${conversationId}`);
          console.log(`💬 Admin joined conversation room: ${conversationId}`);
          
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
          const { conversationId, content, senderName, senderId } = data;
          
          // Use provided senderId, fallback to socket.userId, or 'support'
          const actualSenderId = senderId || socket.userId || 'support';
          const actualSenderName = senderName || 'Support';

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          // Auto-assign if not assigned
          if (!conversation.assignedAgent && socket.userId) {
            conversation.assignedAgent = socket.userId;
            conversation.status = 'assigned';
            await conversation.save();
          }

          const message = new Message({
            conversationId,
            senderType: 'agent',
            senderId: actualSenderId,
            senderName: actualSenderName,
            content,
            isRead: true
          });
          await message.save();

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

          // Also send to all admins watching this site
          this.adminNamespace.to(`site:${conversation.siteId}`).emit('new-message', {
            message,
            conversation
          });

          console.log(`📤 Agent message sent to: conversation:${conversationId} & site:${conversation.siteId}`);

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

      socket.on('disconnect', () => {
        // Admin disconnected
      });
    });
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

        console.log(`🤖 Bot message sent to: conversation:${conversation._id} & site:${conversation.siteId}`);
      }
    } catch (error) {
      console.error('Auto-response error:', error);
    }
  }
}

module.exports = SocketHandler;
