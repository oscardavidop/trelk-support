/**
 * Role Model - RBAC Role definitions with granular permissions
 * 
 * System provides these base roles:
 * - admin: Full access to everything
 * - supervisor: Manage agents, view all chats, monitoring
 * - support: Handle chats, basic operations
 * - junior: Limited access, supervised mode
 * - custom: User-defined roles with specific permissions
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Permission categories and their associated permissions
 * Format: category.action
 */
export const PERMISSION_CATEGORIES = {
    // Chat/Session permissions
    chats: [
        'chats.read',           // View assigned chats
        'chats.read_all',       // View all chats (not just assigned)
        'chats.respond',        // Send messages in chats
        'chats.close',          // Close chat sessions
        'chats.reopen',         // Reopen closed sessions
        'chats.transfer',       // Transfer to other agents
        'chats.takeover',       // Take over another agent's chat
        'chats.delete',         // Delete individual chats
        'chats.delete_all',     // Delete all chats (destructive)
        'chats.monitor',        // Real-time monitoring
        'chats.export'        // Export chat transcripts
    ],
    uploads: [
        'uploads.upload',       // Upload files in chats
        'uploads.delete',       // Delete uploaded files
        'uploads.manage',       // Manage all uploads
    ],
    // Contact/User permissions
    contacts: [
        'contacts.read',        // View contact info
        'contacts.write',       // Edit contact info
        'contacts.delete',      // Delete contacts
        'contacts.export',      // Export contacts
        'contacts.import',      // Import contacts
        'contacts.block',       // Block/unblock users
        'contacts.merge',       // Merge duplicate contacts
    ],

    // Agent management permissions
    agents: [
        'agents.read',          // View agents list
        'agents.write',         // Create/edit agents
        'agents.delete',        // Delete agents
        'agents.permissions',   // Manage agent permissions/roles
        'agents.status',        // Change agent status
        'agents.teams',         // Manage team assignments
    ],

    // Notes and tags
    notes: [
        'notes.read',           // View notes
        'notes.write',          // Create/edit notes
        'notes.delete',         // Delete notes
    ],

    tags: [
        'tags.read',            // View tags
        'tags.write',           // Create/edit tags
        'tags.delete',          // Delete tags
        'tags.assign',          // Assign/remove tags from users
    ],

    // Flows/Automation
    flows: [
        'flows.read',           // View flows
        'flows.write',          // Create/edit flows
        'flows.delete',         // Delete flows
        'flows.publish',        // Publish flows (activate)
        'flows.test',           // Test flows
    ],

    // Automation rules
    automation: [
        'automation.read',      // View automation rules
        'automation.write',     // Create/edit rules
        'automation.delete',    // Delete rules
        'automation.toggle',    // Enable/disable rules
    ],

    // Broadcast/Mass messaging
    broadcast: [
        'broadcast.read',       // View broadcasts
        'broadcast.write',      // Create broadcasts
        'broadcast.send',       // Send broadcasts
        'broadcast.delete',     // Delete broadcasts
    ],

    // Analytics and reports
    analytics: [
        'analytics.read',       // View analytics dashboards
        'analytics.export',     // Export analytics data
        'analytics.advanced',   // Advanced analytics features
    ],

    // Settings
    settings: [
        'settings.read',        // View settings
        'settings.write',       // Modify settings
        'settings.security',    // Security settings
        'settings.integrations', // Integration settings
    ],

    // System administration
    system: [
        'system.read',          // View system status
        'system.manage',        // Manage system settings
        'system.logs',          // View system logs
        'system.audit',         // View audit logs
        'system.destructive',   // Destructive operations (reset, purge)
        'system.backup',        // Backup/restore operations
        'system.admin',         // Critical admin operations (force logout, etc)
    ],

    // Supervisor features
    supervisor: [
        'supervisor.monitor',   // Monitor agents in real-time
        'supervisor.whisper',   // Send whisper messages
        'supervisor.intervene', // Intervene in chats
        'supervisor.reports',   // Supervisor reports
    ],

    // Saved replies
    replies: [
        'replies.read',         // View saved replies
        'replies.write',        // Create/edit saved replies
        'replies.delete',       // Delete saved replies
        'replies.use',          // Use saved replies in chats
    ],

    // Scheduled messages
    scheduled: [
        'scheduled.read',       // View scheduled messages
        'scheduled.write',      // Create scheduled messages
        'scheduled.delete',     // Delete scheduled messages
    ],

    // Exports
    exports: [
        'exports.create',       // Create exports
        'exports.download',     // Download exports
        'exports.delete',       // Delete exports
    ],

    // Custom fields
    customFields: [
        'customFields.read',    // View custom fields
        'customFields.write',   // Create/edit custom fields
        'customFields.delete',  // Delete custom fields
    ],

    // Segments
    segments: [
        'segments.read',        // View segments
        'segments.write',       // Create/edit segments
        'segments.delete',      // Delete segments
    ],

    // Playbooks / Guided Scripts
    playbooks: [
        'playbooks.read',       // View playbooks
        'playbooks.write',      // Create/edit playbooks
        'playbooks.delete',     // Delete playbooks
        'playbooks.execute',    // Execute playbooks in chats
    ],
} as const;

// Flatten all permissions for validation
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSION_CATEGORIES).flat();

/**
 * Default permissions for each system role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
    admin: ['*'], // Wildcard = all permissions

    supervisor: [
        // Chats
        'chats.read', 'chats.read_all', 'chats.respond', 'chats.close',
        'chats.reopen', 'chats.transfer', 'chats.takeover', 'chats.monitor', 'chats.export',
        // Contacts
        'contacts.read', 'contacts.write', 'contacts.export', 'contacts.block',
        // Agents
        'agents.read', 'agents.status',
        // Notes & Tags
        'notes.read', 'notes.write', 'notes.delete',
        'tags.read', 'tags.write', 'tags.assign',
        // Flows (read-only)
        'flows.read',
        // Automation (read + toggle)
        'automation.read', 'automation.toggle',
        // Broadcast
        'broadcast.read', 'broadcast.write', 'broadcast.send',
        // Analytics
        'analytics.read', 'analytics.export',
        // Supervisor features
        'supervisor.monitor', 'supervisor.whisper', 'supervisor.intervene', 'supervisor.reports',
        // Replies
        'replies.read', 'replies.write', 'replies.delete', 'replies.use',
        // Scheduled
        'scheduled.read', 'scheduled.write', 'scheduled.delete',
        // Exports
        'exports.create', 'exports.download',
        // Custom fields
        'customFields.read', 'customFields.write',
        // Segments
        'segments.read', 'segments.write',
        // Playbooks
        'playbooks.read', 'playbooks.write', 'playbooks.execute',
    ],

    support: [
        // Chats
        'chats.read', 'chats.respond', 'chats.close', 'chats.reopen', 'chats.transfer',
        // Contacts
        // Notes & Tags
        'notes.read', 'notes.write',
        'tags.read', 'tags.assign',
        // Replies
        'replies.read', 'replies.use',
        // Custom fields
        'customFields.read',
        // Playbooks (execute only)
        'playbooks.read', 'playbooks.execute',
    ],

    junior: [
        // Chats (limited)
        'chats.read', 'chats.respond', 'chats.transfer',
        // Contacts (read only)
        // Notes (create only)
        'notes.read', 'notes.write',
        // Replies
        'replies.read', 'replies.use',
        // Playbooks (execute only)
        'playbooks.read', 'playbooks.execute',
    ],
};

export interface IRole extends Document {
    _id: Types.ObjectId;
    name: string;
    displayName: string;
    description?: string;
    permissions: string[];
    isSystem: boolean;          // System roles cannot be deleted
    isActive: boolean;
    priority: number;           // Higher = more permissions in hierarchy
    color?: string;             // For UI display
    icon?: string;              // For UI display
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;

    // Methods
    hasPermission(permission: string): boolean;
    hasAnyPermission(permissions: string[]): boolean;
    hasAllPermissions(permissions: string[]): boolean;
}

const RoleSchema = new Schema<IRole>(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        permissions: [{
            type: String,
            trim: true,
        }],
        isSystem: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        priority: {
            type: Number,
            default: 0,
            index: true,
        },
        color: {
            type: String,
            default: '#6366f1', // Default indigo
        },
        icon: {
            type: String,
            default: 'user',
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'Agent',
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Agent',
        },
    },
    {
        timestamps: true,
    }
);

/**
 * Check if role has a specific permission
 */
RoleSchema.methods.hasPermission = function (permission: string): boolean {
    // Admin wildcard
    if (this.permissions.includes('*')) return true;

    // Direct match
    if (this.permissions.includes(permission)) return true;

    // Category wildcard (e.g., 'chats.*' grants all chat permissions)
    const category = permission.split('.')[0];
    if (this.permissions.includes(`${category}.*`)) return true;

    return false;
};

/**
 * Check if role has any of the specified permissions
 */
RoleSchema.methods.hasAnyPermission = function (permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(p));
};

/**
 * Check if role has all specified permissions
 */
RoleSchema.methods.hasAllPermissions = function (permissions: string[]): boolean {
    return permissions.every(p => this.hasPermission(p));
};

/**
 * Prevent deletion of system roles
 */
RoleSchema.pre('deleteOne', { document: true, query: false }, function (next) {
    if (this.isSystem) {
        next(new Error('Cannot delete system role'));
    } else {
        next();
    }
});

// Indexes
RoleSchema.index({ isSystem: 1, isActive: 1 });

export const Role = mongoose.model<IRole>('Role', RoleSchema);

/**
 * Initialize system roles if they don't exist
 */
export async function initializeSystemRoles(): Promise<void> {
    const systemRoles = [
        {
            name: 'admin',
            displayName: 'Administrator',
            description: 'Full system access. Can manage all settings, agents, and permissions.',
            permissions: DEFAULT_ROLE_PERMISSIONS.admin,
            isSystem: true,
            priority: 100,
            color: '#ef4444', // Red
            icon: 'shield',
        },
        {
            name: 'supervisor',
            displayName: 'Supervisor',
            description: 'Monitor agents, view all chats, intervene when needed.',
            permissions: DEFAULT_ROLE_PERMISSIONS.supervisor,
            isSystem: true,
            priority: 75,
            color: '#f59e0b', // Amber
            icon: 'eye',
        },
        {
            name: 'support',
            displayName: 'Support Agent',
            description: 'Handle assigned chats, basic operations.',
            permissions: DEFAULT_ROLE_PERMISSIONS.support,
            isSystem: true,
            priority: 50,
            color: '#10b981', // Green
            icon: 'headphones',
        },
        {
            name: 'junior',
            displayName: 'Junior Agent',
            description: 'Limited access, supervised mode.',
            permissions: DEFAULT_ROLE_PERMISSIONS.junior,
            isSystem: true,
            priority: 25,
            color: '#6366f1', // Indigo
            icon: 'user-plus',
        },
    ];

    for (const roleData of systemRoles) {
        await Role.findOneAndUpdate(
            { name: roleData.name },
            { $setOnInsert: roleData },
            { upsert: true, new: true }
        );
    }

    console.log('✅ System roles initialized');
}
