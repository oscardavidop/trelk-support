/**
 * PermissionsPage - Permission management admin panel
 * 
 * Diseño consistente con ContactsPage, BroadcastPage, etc.
 * Features:
 * - List all agents with their permissions
 * - Update agent roles
 * - Grant/revoke specific permissions
 * - View permission categories
 * - Manage custom roles
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  Loader2,
  KeyRound,
  UserCog,
  Settings2,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  Unlock,
  MessageSquare,
  FileText
} from 'lucide-react';
import { toast } from '../stores/toastStore';

// ==================== TYPES ====================

interface Permission {
  key: string;
  label: string;
  description: string;
}

interface PermissionCategory {
  name: string;
  description: string;
  permissions: Permission[];
}

interface AgentWithPermissions {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  permissionsOverride?: {
    allow: string[];
    deny: string[];
  };
  permissionVersion: number;
}

interface Role {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  color: string;
  priority: number;
  isSystem: boolean;
}

interface PermissionRequestItem {
  permission: string;
  reason: string;
  page?: string;
  requestedAt: string;
}

interface PermissionRequest {
  _id: string;
  agent: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  permissions: PermissionRequestItem[];
  status: 'pending' | 'approved' | 'rejected' | 'partial';
  blockedPermissions: string[];
  reviewedBy?: {
    _id: string;
    name: string;
  };
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== CONSTANTS ====================

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  supervisor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  support: 'bg-green-500/20 text-green-400 border-green-500/30',
  junior: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const CATEGORY_STYLES: Record<string, { color: string; bgColor: string }> = {
  chats: { color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  contacts: { color: 'text-green-400', bgColor: 'bg-green-500/20' },
  agents: { color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  flows: { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  automation: { color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  analytics: { color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  settings: { color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  system: { color: 'text-red-400', bgColor: 'bg-red-500/20' },
  supervisor: { color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  broadcast: { color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  notes: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  tags: { color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
  replies: { color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  scheduled: { color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  exports: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  customFields: { color: 'text-lime-400', bgColor: 'bg-lime-500/20' },
  segments: { color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/20' },
  permissions: { color: 'text-red-400', bgColor: 'bg-red-500/20' },
};

const DANGEROUS_PERMISSIONS = [
  'system.destructive',
  'chats.delete_all',
  'contacts.delete',
  'agents.delete',
  'system.backup',
  'permissions.manage',
];

// ==================== MAIN COMPONENT ====================

export default function PermissionsPage() {
  const token = useAuthStore((state) => state.token);

  // Data state
  const [agents, setAgents] = useState<AgentWithPermissions[]>([]);
  const [categories, setCategories] = useState<Record<string, PermissionCategory>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedAgent, setSelectedAgent] = useState<AgentWithPermissions | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PermissionRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'agents' | 'roles' | 'requests'>('agents');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [requestFilter, setRequestFilter] = useState<'pending' | 'all'>('pending');

  // Review form state
  const [reviewNotes, setReviewNotes] = useState('');
  const [blockOnReject, setBlockOnReject] = useState(false);
  // Track individual permission decisions: 'pending' | 'approve' | 'reject'
  const [permissionDecisions, setPermissionDecisions] = useState<Record<string, 'pending' | 'approve' | 'reject'>>({});

  // Reset decisions when selecting a new request
  const handleSelectRequest = useCallback((request: PermissionRequest) => {
    setSelectedRequest(request);
    setReviewNotes('');
    setBlockOnReject(false);
    // Initialize all permissions as pending
    const decisions: Record<string, 'pending' | 'approve' | 'reject'> = {};
    request.permissions.forEach(p => {
      decisions[p.permission] = 'pending';
    });
    setPermissionDecisions(decisions);
  }, []);

  // ==================== API CALLS ====================

  const fetchAgents = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/permissions/agents', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch agents');
      }

      const data = await response.json();
      return data.agents || [];
    } catch (err: any) {
      console.error('Error fetching agents:', err);
      setError(err.message);
      return [];
    }
  }, [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/permissions/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || {});
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, [token]);

  const fetchRoles = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/permissions/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  }, [token]);

  const fetchPermissionRequests = useCallback(async () => {
    if (!token) return;
    try {
      const endpoint = requestFilter === 'pending' 
        ? '/api/permission-requests/pending'
        : '/api/permission-requests/all';
      
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPermissionRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching permission requests:', err);
    }
  }, [token, requestFilter]);

  // Load all data
  const loadData = useCallback(async () => {
    const [agentsData] = await Promise.all([
      fetchAgents(),
      fetchCategories(),
      fetchRoles(),
      fetchPermissionRequests(),
    ]);
    setAgents(agentsData);
    return agentsData;
  }, [fetchAgents, fetchCategories, fetchRoles, fetchPermissionRequests]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadData();
      setIsLoading(false);
    };
    init();
  }, [loadData]);

  // Reload requests when filter changes
  useEffect(() => {
    if (!isLoading) {
      fetchPermissionRequests();
    }
  }, [requestFilter, fetchPermissionRequests, isLoading]);

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const agentsData = await loadData();
    // Update selected agent if still exists
    if (selectedAgent) {
      const updated = agentsData.find((a: AgentWithPermissions) => a._id === selectedAgent._id);
      if (updated) setSelectedAgent(updated);
    }
    setIsRefreshing(false);
  };

  // ==================== HELPERS ====================

  const filteredAgents = useMemo(() => {
    let result = agents;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        a => a.name.toLowerCase().includes(query) || 
             a.email.toLowerCase().includes(query) ||
             a.role.toLowerCase().includes(query)
      );
    }
    
    if (roleFilter) {
      result = result.filter(a => a.role === roleFilter);
    }
    
    return result;
  }, [agents, searchQuery, roleFilter]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const hasPermission = useCallback((agent: AgentWithPermissions, permission: string): boolean => {
    // Check deny override first
    if (agent.permissionsOverride?.deny?.includes(permission)) return false;
    // Check allow override
    if (agent.permissionsOverride?.allow?.includes(permission)) return true;
    // Check wildcard
    if (agent.permissions.includes('*')) return true;
    // Check category wildcard
    const category = permission.split('.')[0];
    if (agent.permissions.includes(`${category}.*`)) return true;
    // Check exact permission
    return agent.permissions.includes(permission);
  }, []);

  const getPermissionSource = useCallback((agent: AgentWithPermissions, permission: string): 'role' | 'allow' | 'deny' | null => {
    if (agent.permissionsOverride?.deny?.includes(permission)) return 'deny';
    if (agent.permissionsOverride?.allow?.includes(permission)) return 'allow';
    if (hasPermission(agent, permission)) return 'role';
    return null;
  }, [hasPermission]);

  // ==================== ACTIONS ====================

  const handleRoleChange = async (agentId: string, newRole: string) => {
    if (!token) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/permissions/agents/${agentId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      const data = await response.json();
      toast.success('Rol actualizado', `El rol se ha cambiado a ${newRole}`);
      
      // Update local state immediately
      const updatedAgent = data.agent;
      if (updatedAgent) {
        setAgents(prev => prev.map(a => a._id === agentId ? updatedAgent : a));
        if (selectedAgent?._id === agentId) {
          setSelectedAgent(updatedAgent);
        }
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePermissionToggle = async (agentId: string, permission: string, currentlyHas: boolean) => {
    if (!token || !selectedAgent) return;
    
    setIsSaving(true);
    try {
      const endpoint = currentlyHas 
        ? `/api/permissions/agents/${agentId}/revoke`
        : `/api/permissions/agents/${agentId}/grant`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: [permission] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update permission');
      }

      const data = await response.json();
      
      toast.success(
        currentlyHas ? 'Permiso revocado' : 'Permiso otorgado',
        permission
      );
      
      // Update local state immediately with the response data
      const updatedAgent = data.agent;
      if (updatedAgent) {
        setAgents(prev => prev.map(agent => 
          agent._id === agentId ? updatedAgent : agent
        ));
        
        // Also update selected agent
        if (selectedAgent._id === agentId) {
          setSelectedAgent(updatedAgent);
        }
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (agentId: string) => {
    if (!token) return;
    if (!confirm('¿Resetear permisos a los valores por defecto del rol?')) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/permissions/agents/${agentId}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset permissions');
      }

      const data = await response.json();
      toast.success('Permisos reseteados', 'Se han restaurado los valores por defecto');
      
      // Update local state
      const updatedAgent = data.agent;
      if (updatedAgent) {
        setAgents(prev => prev.map(a => a._id === agentId ? updatedAgent : a));
        if (selectedAgent?._id === agentId) {
          setSelectedAgent(updatedAgent);
        }
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ==================== PERMISSION REQUEST ACTIONS ====================

  // Handle individual permission decision
  const handlePermissionDecision = (permission: string, decision: 'approve' | 'reject') => {
    setPermissionDecisions(prev => ({
      ...prev,
      [permission]: prev[permission] === decision ? 'pending' : decision
    }));
  };

  // Submit all decisions for a request
  const handleSubmitReview = async () => {
    if (!token || !selectedRequest) return;
    
    const approved = Object.entries(permissionDecisions)
      .filter(([_, decision]) => decision === 'approve')
      .map(([perm]) => perm);
    
    const rejected = Object.entries(permissionDecisions)
      .filter(([_, decision]) => decision === 'reject')
      .map(([perm]) => perm);
    
    // Check if all decisions are made
    const pending = Object.values(permissionDecisions).filter(d => d === 'pending').length;
    if (pending > 0) {
      toast.error('Decisiones pendientes', `Faltan ${pending} permiso(s) por revisar`);
      return;
    }
    
    // Validate rejection reason if there are rejections
    if (rejected.length > 0 && !reviewNotes.trim()) {
      toast.error('Razón requerida', 'Debes proporcionar una razón para los permisos rechazados');
      return;
    }
    
    setIsSaving(true);
    try {
      // Determine action based on decisions
      let action: 'approve' | 'reject' | 'approve_partial';
      if (approved.length === selectedRequest.permissions.length) {
        action = 'approve';
      } else if (rejected.length === selectedRequest.permissions.length) {
        action = 'reject';
      } else {
        action = 'approve_partial';
      }
      
      const response = await fetch(`/api/permission-requests/${selectedRequest._id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          rejectionReason: rejected.length > 0 ? reviewNotes : undefined,
          approvedPermissions: approved,
          blockPermissions: blockOnReject && rejected.length > 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to review request');
      }

      const message = action === 'approve' 
        ? 'Todos los permisos han sido aprobados'
        : action === 'reject'
          ? 'Todos los permisos han sido rechazados'
          : `${approved.length} aprobado(s), ${rejected.length} rechazado(s)`;
      
      toast.success('Revisión completada', message);
      
      // Refresh data
      await Promise.all([fetchPermissionRequests(), fetchAgents()]);
      
      // Clear selection and form
      setSelectedRequest(null);
      setReviewNotes('');
      setBlockOnReject(false);
      setPermissionDecisions({});
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick approve/reject all
  const handleQuickAction = (action: 'approve' | 'reject') => {
    if (!selectedRequest) return;
    const decisions: Record<string, 'approve' | 'reject'> = {};
    selectedRequest.permissions.forEach(p => {
      decisions[p.permission] = action;
    });
    setPermissionDecisions(decisions);
  };

  const handleUnblockPermission = async (agentId: string, permission: string) => {
    if (!token) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/permission-requests/unblock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agentId, permission }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unblock permission');
      }

      toast.success('Permiso desbloqueado', 'El agente puede volver a solicitar este permiso');
      
      // Refresh requests
      await fetchPermissionRequests();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!token) return;
    if (!confirm('¿Eliminar esta solicitud?')) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/permission-requests/${requestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete request');
      }

      toast.success('Solicitud eliminada', 'La solicitud ha sido eliminada');
      
      // Refresh and clear selection
      await fetchPermissionRequests();
      if (selectedRequest?._id === requestId) {
        setSelectedRequest(null);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Get permission label from categories
  const getPermissionLabel = useCallback((permKey: string): string => {
    for (const cat of Object.values(categories)) {
      const perm = cat.permissions.find(p => p.key === permKey);
      if (perm) return perm.label;
    }
    return permKey;
  }, [categories]);

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-950">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <KeyRound className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Permisos</h1>
              <p className="text-sm text-gray-400">Gestiona roles y permisos de agentes</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-3 bg-gray-900/50 border-b border-gray-800">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-white font-semibold">{agents.length}</span>
              <span className="text-gray-400 text-sm">agentes</span>
            </div>
            <div className="h-4 w-px bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-500/20 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-green-400 font-medium">{agents.filter(a => a.isActive).length}</span>
              <span className="text-gray-400 text-sm">activos</span>
            </div>
            <div className="h-4 w-px bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-500/20 rounded-lg">
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-purple-400 font-medium">{roles.length}</span>
              <span className="text-gray-400 text-sm">roles</span>
            </div>
            <div className="h-4 w-px bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 rounded-lg">
                <Settings2 className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-amber-400 font-medium">{Object.keys(categories).length}</span>
              <span className="text-gray-400 text-sm">categorías</span>
            </div>
            {permissionRequests.filter(r => r.status === 'pending').length > 0 && (
              <>
                <div className="h-4 w-px bg-gray-700" />
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-500/20 rounded-lg">
                    <Clock className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="text-orange-400 font-medium">{permissionRequests.filter(r => r.status === 'pending').length}</span>
                  <span className="text-gray-400 text-sm">solicitudes pendientes</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'agents'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Agentes
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'roles'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Roles
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
                  activeTab === 'requests'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Solicitudes
                {permissionRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {permissionRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>

            {/* Right: Search & Filters */}
            {activeTab === 'agents' && (
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar agente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="">Todos los roles</option>
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="support">Support</option>
                  <option value="junior">Junior</option>
                </select>
              </div>
            )}
            
            {activeTab === 'requests' && (
              <div className="flex items-center gap-3">
                <select
                  value={requestFilter}
                  onChange={(e) => setRequestFilter(e.target.value as 'pending' | 'all')}
                  className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="pending">Solo pendientes</option>
                  <option value="all">Todas</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'agents' && (
            <div className="flex h-full">
              {/* Agent List */}
              <div className="w-80 border-r border-gray-800 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-2">
                  {filteredAgents.map((agent) => (
                    <button
                      key={agent._id}
                      onClick={() => setSelectedAgent(agent)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        selectedAgent?._id === agent._id
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                          <UserCog className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{agent.name}</div>
                          <div className="text-sm text-gray-400 truncate">{agent.email}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ROLE_COLORS[agent.role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {agent.role}
                        </span>
                      </div>
                      
                      {(agent.permissionsOverride?.allow?.length || agent.permissionsOverride?.deny?.length) ? (
                        <div className="flex gap-2 mt-2">
                          {agent.permissionsOverride?.allow?.length ? (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <Plus className="w-3 h-3" />
                              {agent.permissionsOverride.allow.length} extra
                            </span>
                          ) : null}
                          {agent.permissionsOverride?.deny?.length ? (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <Minus className="w-3 h-3" />
                              {agent.permissionsOverride.deny.length} denied
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  ))}
                  
                  {filteredAgents.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      No se encontraron agentes
                    </div>
                  )}
                </div>
              </div>

              {/* Permission Panel */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {selectedAgent ? (
                  <div className="p-6">
                    {/* Agent Header */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                      <div>
                        <h2 className="text-xl font-semibold text-white">{selectedAgent.name}</h2>
                        <p className="text-sm text-gray-400">{selectedAgent.email}</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <select
                          value={selectedAgent.role}
                          onChange={(e) => handleRoleChange(selectedAgent._id, e.target.value)}
                          disabled={isSaving}
                          className="px-4 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="support">Support</option>
                          <option value="junior">Junior</option>
                        </select>
                        
                        <button
                          onClick={() => handleReset(selectedAgent._id)}
                          disabled={isSaving}
                          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="w-4 h-4 inline mr-1" />
                          Reset
                        </button>
                      </div>
                    </div>
                    
                    {/* Permission Stats */}
                    <div className="flex items-center gap-4 text-sm mb-6">
                      <span className="text-gray-400">
                        {selectedAgent.permissions.includes('*') 
                          ? '🔓 Todos los permisos (Admin)' 
                          : `${selectedAgent.permissions.length} permisos activos`}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">v{selectedAgent.permissionVersion}</span>
                    </div>

                    {/* Permission Categories */}
                    <div className="space-y-2">
                      {Object.entries(categories).map(([categoryKey, category]) => {
                        const style = CATEGORY_STYLES[categoryKey] || { color: 'text-gray-400', bgColor: 'bg-gray-500/20' };
                        const isExpanded = expandedCategories.has(categoryKey);
                        
                        // Count active permissions in category
                        const activeCount = category.permissions.filter(p => hasPermission(selectedAgent, p.key)).length;
                        
                        return (
                          <div key={categoryKey} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                            {/* Category Header */}
                            <button
                              onClick={() => toggleCategory(categoryKey)}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg ${style.bgColor} flex items-center justify-center`}>
                                  <Settings2 className={`w-4 h-4 ${style.color}`} />
                                </div>
                                <div className="text-left">
                                  <span className="font-medium text-white">{category.name}</span>
                                  <span className="ml-2 text-sm text-gray-400">
                                    {activeCount}/{category.permissions.length}
                                  </span>
                                </div>
                              </div>
                              
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                            </button>

                            {/* Permissions List */}
                            {isExpanded && (
                              <div className="px-4 pb-4 space-y-2">
                                {category.permissions.map((perm) => {
                                  const hasPerm = hasPermission(selectedAgent, perm.key);
                                  const source = getPermissionSource(selectedAgent, perm.key);
                                  const isDangerous = DANGEROUS_PERMISSIONS.includes(perm.key);
                                  const isAdmin = selectedAgent.permissions.includes('*');
                                  
                                  return (
                                    <div
                                      key={perm.key}
                                      className={`flex items-center justify-between p-3 rounded-lg ${
                                        isDangerous ? 'bg-red-900/20 border border-red-500/20' : 'bg-gray-700/30'
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-sm text-gray-300">
                                            {perm.key}
                                          </span>
                                          {isDangerous && (
                                            <span title="Permiso peligroso">
                                              <AlertTriangle className="w-4 h-4 text-red-500" />
                                            </span>
                                          )}
                                          {source === 'allow' && (
                                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/30">
                                              +override
                                            </span>
                                          )}
                                          {source === 'deny' && (
                                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">
                                              -denied
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                                          {perm.label} - {perm.description}
                                        </p>
                                      </div>
                                      
                                      {/* Toggle Switch */}
                                      <button
                                        onClick={() => handlePermissionToggle(selectedAgent._id, perm.key, hasPerm)}
                                        disabled={isSaving || isAdmin}
                                        className={`relative ml-3 w-12 h-6 rounded-full transition-colors ${
                                          hasPerm
                                            ? 'bg-green-500'
                                            : 'bg-gray-600'
                                        } ${isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
                                        title={isAdmin ? 'Admin tiene todos los permisos' : hasPerm ? 'Desactivar' : 'Activar'}
                                      >
                                        <div
                                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                                            hasPerm ? 'left-6' : 'left-0.5'
                                          }`}
                                        />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Shield className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        Selecciona un agente
                      </h3>
                      <p className="text-gray-400 max-w-md">
                        Selecciona un agente de la lista para ver y editar sus permisos
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <div
                    key={role._id}
                    className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${role.color}30` }}
                      >
                        <Shield className="w-5 h-5" style={{ color: role.color }} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-white">{role.displayName}</h3>
                        <p className="text-xs text-gray-400">{role.name}</p>
                      </div>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                          Sistema
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                      {role.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {role.permissions.includes('*') ? (
                          <span className="text-amber-400 font-medium">Todos los permisos</span>
                        ) : (
                          `${role.permissions.length} permisos`
                        )}
                      </span>
                      <span className="text-gray-500">Prioridad: {role.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permission Requests Tab */}
          {activeTab === 'requests' && (
            <div className="flex h-full">
              {/* Request List */}
              <div className="w-96 border-r border-gray-800 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-2">
                  {permissionRequests.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay solicitudes {requestFilter === 'pending' ? 'pendientes' : ''}</p>
                    </div>
                  ) : (
                    permissionRequests.map((request) => (
                      <button
                        key={request._id}
                        onClick={() => handleSelectRequest(request)}
                        className={`w-full p-4 rounded-lg border text-left transition-all ${
                          selectedRequest?._id === request._id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">
                              {request.agent.name}
                            </div>
                            <div className="text-sm text-gray-400 truncate">
                              {request.agent.email}
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                            request.status === 'pending' 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : request.status === 'approved'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : request.status === 'rejected'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {request.status === 'pending' && <Clock className="w-3 h-3" />}
                            {request.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                            {request.status === 'rejected' && <XCircle className="w-3 h-3" />}
                            {request.status === 'partial' && <AlertTriangle className="w-3 h-3" />}
                            {request.status === 'pending' ? 'Pendiente' : 
                             request.status === 'approved' ? 'Aprobada' :
                             request.status === 'rejected' ? 'Rechazada' : 'Parcial'}
                          </span>
                        </div>
                        
                        {/* Permissions count */}
                        <div className="mt-2 text-xs text-gray-500">
                          {request.permissions.length} permiso{request.permissions.length !== 1 ? 's' : ''} solicitado{request.permissions.length !== 1 ? 's' : ''}
                        </div>
                        
                        {/* Timestamp */}
                        <div className="mt-1 text-xs text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Request Detail Panel */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {selectedRequest ? (
                  <div className="p-6">
                    {/* Request Header */}
                    <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-800">
                      <div>
                        <h2 className="text-xl font-semibold text-white">{selectedRequest.agent.name}</h2>
                        <p className="text-sm text-gray-400">{selectedRequest.agent.email}</p>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[selectedRequest.agent.role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {selectedRequest.agent.role}
                        </span>
                      </div>
                      
                      {selectedRequest.status !== 'pending' && (
                        <button
                          onClick={() => handleDeleteRequest(selectedRequest._id)}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4 inline mr-1" />
                          Eliminar
                        </button>
                      )}
                    </div>

                    {/* Requested Permissions */}
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4" />
                          Permisos Solicitados
                        </span>
                        {selectedRequest.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickAction('reject')}
                              className="text-xs px-2 py-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                              Rechazar todos
                            </button>
                            <button
                              onClick={() => handleQuickAction('approve')}
                              className="text-xs px-2 py-1 text-green-400 hover:bg-green-500/10 rounded transition-colors"
                            >
                              Aprobar todos
                            </button>
                          </div>
                        )}
                      </h3>
                      <div className="space-y-3">
                        {selectedRequest.permissions.map((perm, idx) => {
                          const decision = permissionDecisions[perm.permission] || 'pending';
                          return (
                          <div 
                            key={idx} 
                            className={`rounded-lg p-4 border transition-colors ${
                              decision === 'approve' 
                                ? 'bg-green-900/20 border-green-500/30'
                                : decision === 'reject'
                                  ? 'bg-red-900/20 border-red-500/30'
                                  : 'bg-gray-800/50 border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-purple-400">{perm.permission}</span>
                                {decision === 'approve' && (
                                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Aprobar
                                  </span>
                                )}
                                {decision === 'reject' && (
                                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded flex items-center gap-1">
                                    <XCircle className="w-3 h-3" />
                                    Rechazar
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(perm.requestedAt).toLocaleDateString('es', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 mb-2">{getPermissionLabel(perm.permission)}</p>
                            {perm.page && (
                              <div className="text-xs text-gray-500 mb-2">
                                Desde: <span className="text-gray-400">{perm.page}</span>
                              </div>
                            )}
                            <div className="bg-gray-700/50 rounded p-2 mb-3">
                              <p className="text-xs text-gray-400 flex items-start gap-2">
                                <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span className="italic">"{perm.reason}"</span>
                              </p>
                            </div>
                            
                            {/* Individual permission actions */}
                            {selectedRequest.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handlePermissionDecision(perm.permission, 'reject')}
                                  disabled={isSaving}
                                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                                    decision === 'reject'
                                      ? 'bg-red-500 text-white'
                                      : 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30'
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Rechazar
                                </button>
                                <button
                                  onClick={() => handlePermissionDecision(perm.permission, 'approve')}
                                  disabled={isSaving}
                                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                                    decision === 'approve'
                                      ? 'bg-green-500 text-white'
                                      : 'text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30'
                                  }`}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Aprobar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    </div>

                    {/* Blocked Permissions */}
                    {selectedRequest.blockedPermissions.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-400" />
                          Permisos Bloqueados
                        </h3>
                        <div className="space-y-2">
                          {selectedRequest.blockedPermissions.map((perm, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-red-900/20 rounded-lg p-3 border border-red-500/20">
                              <span className="font-mono text-sm text-red-400">{perm}</span>
                              <button
                                onClick={() => handleUnblockPermission(selectedRequest.agent._id, perm)}
                                disabled={isSaving}
                                className="px-2 py-1 text-xs font-medium text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                <Unlock className="w-3 h-3" />
                                Desbloquear
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review Section (only for pending) */}
                    {selectedRequest.status === 'pending' && (
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <h3 className="text-sm font-medium text-white mb-4">Confirmar Revisión</h3>
                        
                        {/* Decision Summary */}
                        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-400">Resumen de decisiones:</span>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span className="text-green-400">
                              ✓ {Object.values(permissionDecisions).filter(d => d === 'approve').length} aprobar
                            </span>
                            <span className="text-red-400">
                              ✗ {Object.values(permissionDecisions).filter(d => d === 'reject').length} rechazar
                            </span>
                            <span className="text-amber-400">
                              ○ {Object.values(permissionDecisions).filter(d => d === 'pending').length} pendiente
                            </span>
                          </div>
                        </div>
                        
                        {/* Rejection Reason - required when there are rejections */}
                        {Object.values(permissionDecisions).some(d => d === 'reject') && (
                          <div className="mb-4">
                            <label className="block text-xs font-medium text-red-400 mb-1.5">
                              Razón del rechazo <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              placeholder="Explica por qué se rechazan estos permisos..."
                              className={`w-full px-3 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 resize-none ${
                                !reviewNotes.trim() 
                                  ? 'border-red-500/50 focus:ring-red-500/50' 
                                  : 'border-gray-600 focus:ring-purple-500/50'
                              }`}
                              rows={2}
                            />
                            {!reviewNotes.trim() && (
                              <p className="mt-1 text-xs text-red-400">
                                La razón es obligatoria cuando se rechazan permisos
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Notes - optional when only approving */}
                        {!Object.values(permissionDecisions).some(d => d === 'reject') && (
                          <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">
                              Notas (opcional)
                            </label>
                            <textarea
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              placeholder="Agregar notas sobre la revisión..."
                              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                              rows={2}
                            />
                          </div>
                        )}
                        
                        {/* Block on reject checkbox - only show if there are rejections */}
                        {Object.values(permissionDecisions).some(d => d === 'reject') && (
                          <label className="flex items-center gap-2 mb-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={blockOnReject}
                              onChange={(e) => setBlockOnReject(e.target.checked)}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500/50"
                            />
                            <span className="text-sm text-gray-300">
                              Bloquear permisos rechazados (no podrá volver a solicitar)
                            </span>
                          </label>
                        )}
                        
                        {/* Submit Button */}
                        <button
                          onClick={handleSubmitReview}
                          disabled={
                            isSaving || 
                            Object.values(permissionDecisions).some(d => d === 'pending') ||
                            (Object.values(permissionDecisions).some(d => d === 'reject') && !reviewNotes.trim())
                          }
                          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          {Object.values(permissionDecisions).some(d => d === 'pending')
                            ? 'Decide todos los permisos primero'
                            : Object.values(permissionDecisions).some(d => d === 'reject') && !reviewNotes.trim()
                              ? 'Proporciona una razón de rechazo'
                              : 'Enviar Revisión'
                          }
                        </button>
                      </div>
                    )}

                    {/* Review Info (for reviewed requests) */}
                    {selectedRequest.status !== 'pending' && selectedRequest.reviewedBy && (
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <h3 className="text-sm font-medium text-gray-300 mb-3">Información de Revisión</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Revisado por:</span>
                            <span className="text-white">{selectedRequest.reviewedBy.name}</span>
                          </div>
                          {selectedRequest.reviewedAt && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Fecha:</span>
                              <span className="text-white">
                                {new Date(selectedRequest.reviewedAt).toLocaleDateString('es', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                          {selectedRequest.reviewNotes && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <span className="text-gray-400 block mb-1">Notas:</span>
                              <p className="text-gray-300 italic">"{selectedRequest.reviewNotes}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        Selecciona una solicitud
                      </h3>
                      <p className="text-gray-400 max-w-md">
                        Selecciona una solicitud de la lista para ver los detalles y aprobar o rechazar
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
