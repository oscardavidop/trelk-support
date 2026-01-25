/**
 * Permission Request Model
 * Handles permission access requests from agents to admins
 * 
 * Flow:
 * 1. Agent requests permission access with reason
 * 2. Admin reviews request in Permissions page
 * 3. Admin approves (permission granted) or rejects (can add reason)
 * 4. If rejected, agent cannot request same permission again until admin allows
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Individual permission request item
export interface IPermissionItem {
  permission: string;        // e.g., 'chats.read', 'contacts.write'
  reason: string;            // Why the agent needs this permission
  requestedAt: Date;         // When this specific permission was requested
  page?: string;             // Optional: page/route where access was denied
}

// Status of the request
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'partial';

export interface IPermissionRequest extends Document {
  _id: Types.ObjectId;
  agent: Types.ObjectId;              // Agent requesting permissions
  permissions: IPermissionItem[];      // Array of permissions requested
  status: RequestStatus;
  
  // Review info
  reviewedBy?: Types.ObjectId;         // Admin who reviewed
  reviewedAt?: Date;
  rejectionReason?: string;            // Reason for rejection (if rejected)
  
  // Spam prevention
  blockedPermissions: string[];        // Permissions agent can't request again (after rejection)
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const PermissionItemSchema = new Schema<IPermissionItem>({
  permission: { type: String, required: true },
  reason: { type: String, required: true, maxlength: 500 },
  requestedAt: { type: Date, default: Date.now },
  page: { type: String },
}, { _id: false });

const PermissionRequestSchema = new Schema<IPermissionRequest>(
  {
    agent: { 
      type: Schema.Types.ObjectId, 
      ref: 'Agent', 
      required: true,
      index: true 
    },
    permissions: {
      type: [PermissionItemSchema],
      required: true,
      validate: {
        validator: (arr: IPermissionItem[]) => arr.length > 0,
        message: 'At least one permission is required'
      }
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'partial'],
      default: 'pending',
      index: true
    },
    reviewedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'Agent' 
    },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 500 },
    blockedPermissions: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'permissionrequests'
  }
);

// Compound index for finding agent's pending requests
PermissionRequestSchema.index({ agent: 1, status: 1 });

// Index for admin queries
PermissionRequestSchema.index({ status: 1, createdAt: -1 });

// Virtual to get all permission keys
PermissionRequestSchema.virtual('permissionKeys').get(function() {
  return this.permissions.map(p => p.permission);
});

// Method to check if a permission is already requested
PermissionRequestSchema.methods.hasPermission = function(permission: string): boolean {
  return this.permissions.some((p: IPermissionItem) => p.permission === permission);
};

// Method to add a permission to the request
PermissionRequestSchema.methods.addPermission = function(
  permission: string, 
  reason: string, 
  page?: string
): boolean {
  if (this.hasPermission(permission)) {
    return false;
  }
  this.permissions.push({
    permission,
    reason,
    requestedAt: new Date(),
    page
  });
  return true;
};

// Static to find or create pending request for agent
PermissionRequestSchema.statics.findOrCreatePending = async function(
  agentId: string
): Promise<IPermissionRequest | null> {
  let request = await this.findOne({ 
    agent: agentId, 
    status: 'pending' 
  });
  
  if (!request) {
    request = new this({ 
      agent: agentId, 
      permissions: [],
      status: 'pending'
    });
  }
  
  return request;
};

// Static to check if permission is blocked for agent
PermissionRequestSchema.statics.isPermissionBlocked = async function(
  agentId: string,
  permission: string
): Promise<boolean> {
  const blockedRequest = await this.findOne({
    agent: agentId,
    status: 'rejected',
    blockedPermissions: permission
  });
  return !!blockedRequest;
};

export const PermissionRequest = mongoose.model<IPermissionRequest>(
  'PermissionRequest',
  PermissionRequestSchema
);

export default PermissionRequest;
