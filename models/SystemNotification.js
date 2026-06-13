// models/SystemNotification.js
const mongoose = require('mongoose');

const systemNotificationSchema = new mongoose.Schema({
  // Who should see this notification (by role)
  recipientRole: {
    type: String,
    required: true,
    enum: ['HR_MANAGER', 'MARKETING_MANAGER', 'SALES_MANAGER',
           'COMMERCIAL_MANAGER', 'FINANCE_MANAGER', 'STOCK_MANAGER',
           'PURCHASE_MANAGER', 'DEPOT_MANAGER', 'ADMIN'],
  },
  type: {
    type: String,
    required: true,
    enum: ['ACCOUNT_APPROVED', 'ACCOUNT_REJECTED', 'ACCOUNT_PENDING'],
  },
  message:    { type: String, required: true },
  targetId:   { type: String },   // employee _id
  targetName: { type: String },   // employee name
  actorName:  { type: String },   // who triggered it
  read:       { type: Boolean, default: false },
}, { timestamps: true });

// Auto-delete after 7 days
systemNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.models.SystemNotification ||
  mongoose.model('SystemNotification', systemNotificationSchema);
