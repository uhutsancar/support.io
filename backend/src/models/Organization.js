const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'Organization',
  table: 'organizations',
  fields: {
    name: { column: 'name', type: 'string', required: true, trim: true },
    ownerUserId: { column: 'owner_user_id', type: 'id', ref: 'User' },
    planType: { column: 'plan_type', type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'], default: 'FREE' },
    isActive: { column: 'is_active', type: 'boolean', default: true }
  }
});
