const { defineModel } = require('../db/model');
const { query } = require('../db/pool');

// Sequential ticket numbers. A single upsert keeps the increment atomic, so
// concurrent conversations can never receive the same number.
async function nextTicketNumber() {
  const { rows } = await query(
    `INSERT INTO counters (id, seq) VALUES ('ticketNumber', 1)
     ON CONFLICT (id) DO UPDATE SET seq = counters.seq + 1
     RETURNING seq`
  );
  return Number(rows[0].seq);
}

const DEFAULT_FIRST_RESPONSE = { urgent: 5, high: 10, normal: 15, low: 30 };
const DEFAULT_RESOLUTION = { urgent: 60, high: 120, normal: 240, low: 480 };

const Conversation = defineModel({
  name: 'Conversation',
  table: 'conversations',
  options: { virtuals: true },
  fields: {
    ticketNumber: { column: 'ticket_number', type: 'number' },
    ticketId: { column: 'ticket_id', type: 'string' },
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', required: true },
    visitorId: { column: 'visitor_id', type: 'string', required: true },
    visitorName: { column: 'visitor_name', type: 'string', default: 'Visitor' },
    visitorEmail: { column: 'visitor_email', type: 'string', default: null },
    department: { column: 'department_id', type: 'id', ref: 'Department', default: null },
    // Either a Team or a User can own a conversation, so the reference resolves
    // against both tables.
    assignedAgent: { column: 'assigned_agent_id', type: 'id', refAny: ['Team', 'User'], default: null },
    assignedAt: { column: 'assigned_at', type: 'date', default: null },
    assignedBy: { column: 'assigned_by_id', type: 'id', refAny: ['Team', 'User'], default: null },
    status: {
      column: 'status',
      type: 'string',
      enum: ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'],
      default: 'open'
    },
    priority: { column: 'priority', type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    requiredSkills: { column: 'required_skills', type: 'stringArray', lowercase: true, trim: true, default: () => [] },
    unreadCount: { column: 'unread_count', type: 'number', default: 0, min: 0 },
    nextSlaCheckAt: { column: 'next_sla_check_at', type: 'date', default: null },
    autoReassignAttempts: { column: 'auto_reassign_attempts', type: 'number', default: 0 },
    lastReassignAt: { column: 'last_reassign_at', type: 'date', default: null },
    // Declared after `priority` so the SLA targets can be derived from it.
    sla: {
      column: 'sla',
      type: 'json',
      default() {
        return {
          firstResponseTarget: DEFAULT_FIRST_RESPONSE[this.priority] || 15,
          resolutionTarget: DEFAULT_RESOLUTION[this.priority] || 240,
          firstResponseStatus: 'pending',
          resolutionStatus: 'pending',
          firstResponseTimeRemaining: null,
          resolutionTimeRemaining: null,
          firstResponseBreachedAt: null,
          resolutionBreachedAt: null
        };
      }
    },
    channel: { column: 'channel', type: 'string', enum: ['web-chat', 'email', 'whatsapp', 'phone'], default: 'web-chat' },
    currentPage: { column: 'current_page', type: 'string', default: '/' },
    metadata: { column: 'metadata', type: 'json', default: () => ({}) },
    tags: { column: 'tags', type: 'stringArray', default: () => [] },
    rating: {
      column: 'rating',
      type: 'json',
      default: () => ({ score: null, feedback: null, ratedAt: null })
    },
    lastMessageAt: { column: 'last_message_at', type: 'date', default: () => new Date() },
    firstResponseAt: { column: 'first_response_at', type: 'date', default: null },
    resolvedAt: { column: 'resolved_at', type: 'date', default: null },
    closedAt: { column: 'closed_at', type: 'date', default: null }
  },
  children: {
    internalNotes: {
      table: 'conversation_internal_notes',
      parentKey: 'conversation_id',
      ownId: true,
      orderBy: 'created_at ASC',
      fields: {
        userId: { column: 'user_id', type: 'id', refAny: ['User', 'Team'] },
        note: { column: 'note', type: 'string' },
        createdAt: { column: 'created_at', type: 'date', default: () => new Date() }
      }
    }
  },
  hooks: {
    async preSave() {
      if (!this.organizationId && this.siteId) {
        try {
          const Site = require('./Site');
          const site = await Site.findById(this.siteId).select('organizationId');
          if (site && site.organizationId) {
            this.organizationId = site.organizationId;
          }
        } catch (e) {
          // Leave organizationId unset; validation reports it.
        }
      }

      if (!this.ticketNumber) {
        const seq = await nextTicketNumber();
        this.ticketNumber = seq;
        this.ticketId = `#${seq.toString().padStart(4, '0')}`;
      }
    }
  },
  virtuals: {
    responseTime() {
      if (this.firstResponseAt && this.createdAt) {
        return Math.floor((this.firstResponseAt - this.createdAt) / 1000 / 60);
      }
      return null;
    },
    resolutionTime() {
      if (this.resolvedAt && this.createdAt) {
        return Math.floor((this.resolvedAt - this.createdAt) / 1000 / 60);
      }
      return null;
    }
  },
  methods: {
    calculateSLA() {
      const now = new Date();

      if (!this.createdAt || !(this.createdAt instanceof Date) || isNaN(new Date(this.createdAt).getTime())) {
        this.createdAt = now;
      } else {
        this.createdAt = new Date(this.createdAt);
      }
      const createdTime = this.createdAt.getTime();
      const elapsedMinutes = Math.floor((now - createdTime) / 1000 / 60);

      let nextCheckMinutes = 5;

      if (!this.firstResponseAt) {
        const remaining = this.sla.firstResponseTarget - elapsedMinutes;
        this.sla.firstResponseTimeRemaining = remaining;

        if (remaining > 0 && remaining <= 10) {
          nextCheckMinutes = Math.max(1, Math.floor(remaining / 2));
        }

        if (remaining < 0) {
          this.sla.firstResponseStatus = 'breached';
          if (!this.sla.firstResponseBreachedAt) {
            this.sla.firstResponseBreachedAt = new Date(createdTime + this.sla.firstResponseTarget * 60 * 1000);
          }
          nextCheckMinutes = 1;
        } else {
          this.sla.firstResponseStatus = 'pending';
        }
      } else {
        const responseMinutes = Math.floor((this.firstResponseAt - createdTime) / 1000 / 60);
        this.sla.firstResponseStatus = responseMinutes <= this.sla.firstResponseTarget ? 'met' : 'breached';
        this.sla.firstResponseTimeRemaining = null;

        if (this.sla.firstResponseStatus === 'breached' && !this.sla.firstResponseBreachedAt) {
          this.sla.firstResponseBreachedAt = this.firstResponseAt;
        }
      }

      if (this.status !== 'resolved' && this.status !== 'closed') {
        const remaining = this.sla.resolutionTarget - elapsedMinutes;
        this.sla.resolutionTimeRemaining = remaining;

        if (remaining > 0 && remaining <= 30) {
          nextCheckMinutes = Math.min(nextCheckMinutes, Math.max(1, Math.floor(remaining / 3)));
        }

        if (remaining < 0) {
          this.sla.resolutionStatus = 'breached';
          if (!this.sla.resolutionBreachedAt) {
            this.sla.resolutionBreachedAt = new Date(createdTime + this.sla.resolutionTarget * 60 * 1000);
          }
          nextCheckMinutes = 1;
        } else {
          this.sla.resolutionStatus = 'pending';
        }
      } else if (this.resolvedAt) {
        const resolutionMinutes = Math.floor((this.resolvedAt - createdTime) / 1000 / 60);
        this.sla.resolutionStatus = resolutionMinutes <= this.sla.resolutionTarget ? 'met' : 'breached';
        this.sla.resolutionTimeRemaining = null;

        if (this.sla.resolutionStatus === 'breached' && !this.sla.resolutionBreachedAt) {
          this.sla.resolutionBreachedAt = this.resolvedAt;
        }

        this.nextSlaCheckAt = null;
        return this;
      }

      this.nextSlaCheckAt = new Date(now.getTime() + nextCheckMinutes * 60 * 1000);

      return this;
    }
  }
});

Conversation.nextTicketNumber = nextTicketNumber;

module.exports = Conversation;
