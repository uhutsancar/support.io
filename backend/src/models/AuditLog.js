const mongoose = require('mongoose');
const auditSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: {
    type: String,
    enum: [
      'LOGIN_SUCCESS', 'LOGIN_FAILED',
      'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
      'PLAN_CHANGED', 'UPDATE_SLA',
      'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH'
    ],
    required: true,
    index: true
  },
  entityType: { type: String },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  metadata: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { collection: 'audit_logs' });
auditSchema.index({ organizationId: 1, createdAt: -1 });
auditSchema.pre('save', function (next) {
  if (!this.isNew) {
    const err = new Error('Audit records are immutable and cannot be modified');
    return next(err);
  }
  next();
});
module.exports = mongoose.model('AuditLog', auditSchema);
