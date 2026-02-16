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
import { AlertCircle } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  ShieldBan,
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
  FileText,
  ShieldOff,
} from "lucide-react";
import { toast } from "../stores/toastStore";

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
  avatar?: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  permissionsOverride?: {
    allow: string[];
    deny: string[];
  };
  permissionVersion: number;
  canRequestPermissions?: boolean;
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
  status: "pending" | "approved" | "rejected" | "partial";
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
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  supervisor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  support: "bg-green-500/20 text-green-400 border-green-500/30",
  junior: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const CATEGORY_STYLES: Record<string, { color: string; bgColor: string }> = {
  chats: { color: "text-blue-400", bgColor: "bg-blue-500/20" },
  contacts: { color: "text-green-400", bgColor: "bg-green-500/20" },
  agents: { color: "text-purple-400", bgColor: "bg-purple-500/20" },
  flows: { color: "text-cyan-400", bgColor: "bg-cyan-500/20" },
  automation: { color: "text-orange-400", bgColor: "bg-orange-500/20" },
  analytics: { color: "text-indigo-400", bgColor: "bg-indigo-500/20" },
  settings: { color: "text-gray-400", bgColor: "bg-gray-500/20" },
  system: { color: "text-red-400", bgColor: "bg-red-500/20" },
  supervisor: { color: "text-amber-400", bgColor: "bg-amber-500/20" },
  broadcast: { color: "text-pink-400", bgColor: "bg-pink-500/20" },
  notes: { color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  tags: { color: "text-teal-400", bgColor: "bg-teal-500/20" },
  replies: { color: "text-violet-400", bgColor: "bg-violet-500/20" },
  scheduled: { color: "text-rose-400", bgColor: "bg-rose-500/20" },
  exports: { color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
  customFields: { color: "text-lime-400", bgColor: "bg-lime-500/20" },
  segments: { color: "text-fuchsia-400", bgColor: "bg-fuchsia-500/20" },
  permissions: { color: "text-red-400", bgColor: "bg-red-500/20" },
};

const DANGEROUS_PERMISSIONS = [
  "system.destructive",
  "chats.delete_all",
  "contacts.delete",
  "agents.delete",
  "system.backup",
  "permissions.manage",
];

// ==================== MAIN COMPONENT ====================

export default function PermissionsPage() {
  const token = useAuthStore((state) => state.token);

  // Data state
  const [agents, setAgents] = useState<AgentWithPermissions[]>([]);
  const [categories, setCategories] = useState<
    Record<string, PermissionCategory>
  >({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<
    PermissionRequest[]
  >([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedAgent, setSelectedAgent] =
    useState<AgentWithPermissions | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<PermissionRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [activeTab, setActiveTab] = useState<"agents" | "roles" | "requests">(
    "agents",
  );
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [requestFilter, setRequestFilter] = useState<"pending" | "all">(
    "pending",
  );

  // Review form state
  const [reviewNotes, setReviewNotes] = useState("");
  const [blockOnReject, setBlockOnReject] = useState(false);
  // Track individual permission decisions: 'pending' | 'approve' | 'reject'
  const [permissionDecisions, setPermissionDecisions] = useState<
    Record<string, "pending" | "approve" | "reject">
  >({});

  // Reset decisions when selecting a new request
  const handleSelectRequest = useCallback((request: PermissionRequest) => {
    setSelectedRequest(request);
    setReviewNotes("");
    setBlockOnReject(false);
    // Initialize all permissions as pending
    const decisions: Record<string, "pending" | "approve" | "reject"> = {};
    request.permissions.forEach((p) => {
      decisions[p.permission] = "pending";
    });
    setPermissionDecisions(decisions);
  }, []);

  // ==================== API CALLS ====================

  const fetchAgents = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/permissions/agents", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch agents");
      }

      const data = await response.json();
      return data.agents || [];
    } catch (err: any) {
      console.error("Error fetching agents:", err);
      setError(err.message);
      return [];
    }
  }, [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/permissions/categories", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || {});
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }, [token]);

  const fetchRoles = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/permissions/roles", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  }, [token]);

  const fetchPermissionRequests = useCallback(async () => {
    if (!token) return;
    try {
      const endpoint =
        requestFilter === "pending"
          ? "/api/permission-requests/pending"
          : "/api/permission-requests/all";

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPermissionRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Error fetching permission requests:", err);
    }
  }, [token, requestFilter]);

  const fetchAgent = useCallback(
    async (agentId: string) => {
      if (!token) return null;
      try {
        const response = await fetch(`/api/permissions/agents/${agentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          return data.agent || null;
        }
      } catch (err) {
        console.error("Error fetching agent:", err);
      }
      return null;
    },
    [token],
  );

  const handleSelectAgent = useCallback(
    async (agentId: string) => {
      setIsLoadingAgent(true);
      if (agentId === selectedAgent?._id) {
        setIsLoadingAgent(false);
      } else {
        try {
          const agent = await fetchAgent(agentId);
          if (agent) {
            setSelectedAgent(agent);
          }
        } catch (error) {
          console.error("Error selecting agent:", error);
        } finally {
          setIsLoadingAgent(false);
        }
      }
    },
    [selectedAgent, fetchAgent],
  );

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
      const updated = agentsData.find(
        (a: AgentWithPermissions) => a._id === selectedAgent._id,
      );
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
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.email.toLowerCase().includes(query) ||
          a.role.toLowerCase().includes(query),
      );
    }

    if (roleFilter) {
      result = result.filter((a) => a.role === roleFilter);
    }

    return result;
  }, [agents, searchQuery, roleFilter]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const hasPermission = useCallback(
    (agent: AgentWithPermissions, permission: string): boolean => {
      // Check deny override first
      if (agent.permissionsOverride?.deny?.includes(permission)) return false;
      // Check allow override
      if (agent.permissionsOverride?.allow?.includes(permission)) return true;
      // Check wildcard
      if (agent.permissions.includes("*")) return true;
      // Check category wildcard
      const category = permission.split(".")[0];
      if (agent.permissions.includes(`${category}.*`)) return true;
      // Check exact permission
      return agent.permissions.includes(permission);
    },
    [],
  );

  const getPermissionSource = useCallback(
    (
      agent: AgentWithPermissions,
      permission: string,
    ): "role" | "allow" | "deny" | null => {
      if (agent.permissionsOverride?.deny?.includes(permission)) return "deny";
      if (agent.permissionsOverride?.allow?.includes(permission))
        return "allow";
      if (hasPermission(agent, permission)) return "role";
      return null;
    },
    [hasPermission],
  );

  // ==================== ACTIONS ====================

  const handleRoleChange = async (agentId: string, newRole: string) => {
    if (!token) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/permissions/agents/${agentId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update role");
      }

      const data = await response.json();
      toast.success("Rol actualizado", `El rol se ha cambiado a ${newRole}`);

      // Update local state immediately
      const updatedAgent = data.agent;
      if (updatedAgent) {
        setAgents((prev) =>
          prev.map((a) => (a._id === agentId ? updatedAgent : a)),
        );
        if (selectedAgent?._id === agentId) {
          setSelectedAgent(updatedAgent);
        }
      }
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePermissionToggle = async (
    agentId: string,
    permission: string,
    currentlyHas: boolean,
  ) => {
    if (!token || !selectedAgent) return;

    setIsSaving(true);
    try {
      const endpoint = currentlyHas
        ? `/api/permissions/agents/${agentId}/revoke`
        : `/api/permissions/agents/${agentId}/grant`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: [permission] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update permission");
      }

      const data = await response.json();

      toast.success(
        currentlyHas ? "Permiso revocado" : "Permiso otorgado",
        permission,
      );

      // Update local state immediately with the response data
      const updatedAgent = data.agent;
      if (updatedAgent) {
        setAgents((prev) =>
          prev.map((agent) => (agent._id === agentId ? updatedAgent : agent)),
        );

        // Also update selected agent
        if (selectedAgent._id === agentId) {
          setSelectedAgent(updatedAgent);
        }
      }
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (agentId: string) => {
    if (!token) return;
    if (!confirm("¿Resetear permisos a los valores por defecto del rol?"))
      return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/permissions/agents/${agentId}/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reset permissions");
      }

      const data = await response.json();
      toast.success(
        "Permisos reseteados",
        "Se han restaurado los valores por defecto",
      );

      // Update local state
      const updatedAgent = data.agent;
      if (updatedAgent) {
        setAgents((prev) =>
          prev.map((a) => (a._id === agentId ? updatedAgent : a)),
        );
        if (selectedAgent?._id === agentId) {
          setSelectedAgent(updatedAgent);
        }
      }
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRequestBan = async (agentId: string) => {
    if (!token) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/permission-requests/agent/${agentId}/toggle-ban`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to toggle ban");
      }

      const data = await response.json();
      toast.success(
        data.canRequestPermissions ? "Desbloqueado" : "Bloqueado",
        data.message,
      );

      // Update local state
      setAgents((prev) =>
        prev.map((a) =>
          a._id === agentId
            ? { ...a, canRequestPermissions: data.canRequestPermissions }
            : a,
        ),
      );
      if (selectedAgent?._id === agentId) {
        setSelectedAgent((prev) =>
          prev
            ? { ...prev, canRequestPermissions: data.canRequestPermissions }
            : null,
        );
      }
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ==================== PERMISSION REQUEST ACTIONS ====================

  // Handle individual permission decision
  const handlePermissionDecision = (
    permission: string,
    decision: "approve" | "reject",
  ) => {
    setPermissionDecisions((prev) => ({
      ...prev,
      [permission]: prev[permission] === decision ? "pending" : decision,
    }));
  };

  // Submit all decisions for a request
  const handleSubmitReview = async () => {
    if (!token || !selectedRequest) return;

    const approved = Object.entries(permissionDecisions)
      .filter(([_, decision]) => decision === "approve")
      .map(([perm]) => perm);

    const rejected = Object.entries(permissionDecisions)
      .filter(([_, decision]) => decision === "reject")
      .map(([perm]) => perm);

    // Check if all decisions are made
    const pending = Object.values(permissionDecisions).filter(
      (d) => d === "pending",
    ).length;
    if (pending > 0) {
      toast.error(
        "Decisiones pendientes",
        `Faltan ${pending} permiso(s) por revisar`,
      );
      return;
    }

    // Validate rejection reason if there are rejections
    if (rejected.length > 0 && !reviewNotes.trim()) {
      toast.error(
        "Razón requerida",
        "Debes proporcionar una razón para los permisos rechazados",
      );
      return;
    }

    setIsSaving(true);
    try {
      // Determine action based on decisions
      let action: "approve" | "reject" | "approve_partial";
      if (approved.length === selectedRequest.permissions.length) {
        action = "approve";
      } else if (rejected.length === selectedRequest.permissions.length) {
        action = "reject";
      } else {
        action = "approve_partial";
      }

      const response = await fetch(
        `/api/permission-requests/${selectedRequest._id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            rejectionReason: rejected.length > 0 ? reviewNotes : undefined,
            approvedPermissions: approved,
            blockPermissions: blockOnReject && rejected.length > 0,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to review request");
      }

      const message =
        action === "approve"
          ? "Todos los permisos han sido aprobados"
          : action === "reject"
            ? "Todos los permisos han sido rechazados"
            : `${approved.length} aprobado(s), ${rejected.length} rechazado(s)`;

      toast.success("Revisión completada", message);

      // Refresh data
      await Promise.all([fetchPermissionRequests(), fetchAgents()]);

      // Clear selection and form
      setSelectedRequest(null);
      setReviewNotes("");
      setBlockOnReject(false);
      setPermissionDecisions({});
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick approve/reject all
  const handleQuickAction = (action: "approve" | "reject") => {
    if (!selectedRequest) return;
    const decisions: Record<string, "approve" | "reject"> = {};
    selectedRequest.permissions.forEach((p) => {
      decisions[p.permission] = action;
    });
    setPermissionDecisions(decisions);
  };

  const handleUnblockPermission = async (
    agentId: string,
    permission: string,
  ) => {
    if (!token) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/permission-requests/unblock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agentId, permission }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to unblock permission");
      }

      toast.success(
        "Permiso desbloqueado",
        "El agente puede volver a solicitar este permiso",
      );

      // Refresh requests
      await fetchPermissionRequests();
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!token) return;
    if (!confirm("¿Eliminar esta solicitud?")) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/permission-requests/${requestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete request");
      }

      toast.success("Solicitud eliminada", "La solicitud ha sido eliminada");

      // Refresh and clear selection
      await fetchPermissionRequests();
      if (selectedRequest?._id === requestId) {
        setSelectedRequest(null);
      }
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Get permission label from categories
  const getPermissionLabel = useCallback(
    (permKey: string): string => {
      for (const cat of Object.values(categories)) {
        const perm = cat.permissions.find((p) => p.key === permKey);
        if (perm) return perm.label;
      }
      return permKey;
    },
    [categories],
  );

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500/30">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background Ambience */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-purple-900/10">
              <KeyRound className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">
                Permisos y Accesos
              </h1>
              <p className="text-sm text-zinc-400">
                Administración centralizada de roles de seguridad
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="group flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-50 transition-all active:scale-95"
          >
            <RefreshCw
              className={`w-4 h-4 transition-transform ${isRefreshing ? "animate-spin" : "group-hover:rotate-180"}`}
            />
            <span className="text-sm font-medium">Sincronizar</span>
          </button>
        </div>

        {/* Stats Bar (Glass Strip) */}
        <div className="px-8 pb-6 z-10">
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit">
            <StatBadge
              icon={Users}
              count={agents.length}
              label="agentes"
              color="text-blue-400"
              bg="bg-blue-500/10"
            />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge
              icon={ShieldCheck}
              count={agents.filter((a) => a.isActive).length}
              label="activos"
              color="text-emerald-400"
              bg="bg-emerald-500/10"
            />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge
              icon={Shield}
              count={roles.length}
              label="roles"
              color="text-purple-400"
              bg="bg-purple-500/10"
            />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge
              icon={Settings2}
              count={Object.keys(categories).length}
              label="categorías"
              color="text-amber-400"
              bg="bg-amber-500/10"
            />

            {permissionRequests.filter((r) => r.status === "pending").length >
              0 && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <StatBadge
                  icon={Clock}
                  count={
                    permissionRequests.filter((r) => r.status === "pending")
                      .length
                  }
                  label="solicitudes"
                  color="text-orange-400"
                  bg="bg-orange-500/10"
                />
              </>
            )}
          </div>
        </div>

        {/* Main Layout Area */}
        <div className="flex-1 flex flex-col px-8 pb-8 overflow-hidden z-10">
          <div className="flex-1 flex flex-col bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            {/* Tabs & Controls Toolbar */}
            <div className="px-6 py-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50">
              {/* Tabs */}
              <div className="flex p-1 bg-zinc-950/50 rounded-xl border border-white/5 w-fit">
                <TabButton
                  active={activeTab === "agents"}
                  onClick={() => setActiveTab("agents")}
                  icon={Users}
                  label="Agentes"
                />
                <TabButton
                  active={activeTab === "roles"}
                  onClick={() => setActiveTab("roles")}
                  icon={Shield}
                  label="Roles"
                />
                <TabButton
                  active={activeTab === "requests"}
                  onClick={() => setActiveTab("requests")}
                  icon={FileText}
                  label="Solicitudes"
                  badge={
                    permissionRequests.filter((r) => r.status === "pending")
                      .length
                  }
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                {activeTab === "agents" && (
                  <>
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
                      <input
                        type="text"
                        placeholder="Buscar agente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 w-64 transition-all"
                      />
                    </div>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50"
                    >
                      <option value="">Todos los roles</option>
                      <option value="admin">Admin</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="support">Support</option>
                      <option value="junior">Junior</option>
                    </select>
                  </>
                )}
                {activeTab === "requests" && (
                  <select
                    value={requestFilter}
                    onChange={(e) =>
                      setRequestFilter(e.target.value as "pending" | "all")
                    }
                    className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="pending">Solo pendientes</option>
                    <option value="all">Todas</option>
                  </select>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden relative">
              {/* AGENTS TAB */}
              {activeTab === "agents" && (
                <div className="flex h-full">
                  {/* Sidebar List */}
                  <div className="w-80 border-r border-white/5 bg-zinc-900/30 overflow-y-auto custom-scrollbar">
                    <div className="p-3 space-y-1">
                      {filteredAgents.map((agent) => (
                        <button
                          key={agent._id}
                          onClick={() => handleSelectAgent(agent._id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all duration-200 group relative ${
                            selectedAgent?._id === agent._id
                              ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                              : "border-transparent hover:bg-white/5 hover:border-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${selectedAgent?._id === agent._id ? "bg-purple-500 text-zinc-50" : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700"}`}
                            >
                              <UserCog className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div
                                className={`font-medium truncate ${selectedAgent?._id === agent._id ? "text-zinc-50" : "text-zinc-300 group-hover:text-zinc-50"}`}
                              >
                                {agent.name}
                              </div>
                              <div className="text-xs text-zinc-500 truncate">
                                {agent.email}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium uppercaseborder ${ROLE_COLORS[agent.role] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                            >
                              {agent.role}
                            </span>

                            {/* Indicator Dots */}
                            <div className="flex gap-1">
                              {agent.canRequestPermissions === false && (
                                <div
                                  className="w-2 h-2 rounded-full bg-red-500"
                                  title="Bloqueado"
                                />
                              )}
                              {(agent.permissionsOverride?.allow?.length || 0) >
                                0 && (
                                <div
                                  className="w-2 h-2 rounded-full bg-emerald-500"
                                  title="Permisos Extra"
                                />
                              )}
                              {(agent.permissionsOverride?.deny?.length || 0) >
                                0 && (
                                <div
                                  className="w-2 h-2 rounded-full bg-amber-500"
                                  title="Restricciones"
                                />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}

                      {filteredAgents.length === 0 && (
                        <div className="text-center py-12 text-zinc-500">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p>No se encontraron agentes</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detail Panel */}
                  <div className="flex-1 overflow-y-auto bg-zinc-950/30 custom-scrollbar">
                    {isLoadingAgent && (
                      <div className="absolute top-0 left-0 w-full h-full bg-black/30 flex items-center justify-center z-10 rounded-3xl">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                      </div>
                    )}
                    {selectedAgent && !isLoadingAgent ? (
                      <div className="max-w-7xl mx-auto p-8">
                        {/* Agent Header Card */}
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 mb-8 flex items-start justify-between relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                          <div className="flex gap-5 relative z-10">
                            {selectedAgent.avatar ? (
                              <img
                                src={selectedAgent.avatar}
                                alt="Avatar"
                                className="w-16 h-16 rounded-full object-cover border-2 border-purple-500"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
                                <span className="text-2xl font-bold text-zinc-50">
                                  {selectedAgent.name.charAt(0)}
                                </span>
                              </div>
                            )}
                            <div>
                              <h2 className="text-2xl font-bold text-zinc-50 mb-1">
                                {selectedAgent.name}
                              </h2>
                              <p className="text-zinc-400 font-mono text-sm mb-3">
                                {selectedAgent.email}
                              </p>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                                  <div
                                    className={`w-2 h-2 rounded-full ${selectedAgent.permissions.includes("*") ? "bg-amber-500" : "bg-emerald-500"}`}
                                  />
                                  {selectedAgent.permissions.includes("*")
                                    ? "Acceso Total (Admin)"
                                    : `${selectedAgent.permissions.length} permisos activos`}
                                </span>
                                <span className="text-zinc-600">|</span>
                                <span className="text-xs text-zinc-500">
                                  v{selectedAgent.permissionVersion}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 relative z-10">
                            <div className="flex items-center gap-2 bg-zinc-950/50 p-1 rounded-lg border border-white/5">
                              <select
                                value={selectedAgent.role}
                                onChange={(e) =>
                                  handleRoleChange(
                                    selectedAgent._id,
                                    e.target.value,
                                  )
                                }
                                disabled={isSaving}
                                className="bg-transparent text-sm font-medium text-zinc-50 px-3 py-1.5 focus:outline-none"
                              >
                                <option value="admin">Admin</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="support">Support</option>
                                <option value="junior">Junior</option>
                              </select>
                            </div>

                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleReset(selectedAgent._id)}
                                disabled={isSaving}
                                className="p-2 text-zinc-400 hover:text-zinc-50 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                                title="Resetear a valores por defecto"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleToggleRequestBan(selectedAgent._id)
                                }
                                disabled={isSaving}
                                className={`p-2 rounded-lg transition-colors ${
                                  selectedAgent.canRequestPermissions !== false
                                    ? "text-zinc-400 hover:text-red-400 bg-zinc-800 hover:bg-zinc-700"
                                    : "text-red-400 bg-red-500/10 border border-red-500/20"
                                }`}
                                title={
                                  selectedAgent.canRequestPermissions !== false
                                    ? "Bloquear solicitudes"
                                    : "Permitir solicitudes"
                                }
                              >
                                {selectedAgent.canRequestPermissions !==
                                false ? (
                                  <ShieldBan className="w-4 h-4" />
                                ) : (
                                  <ShieldOff className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Permission Categories Grid */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-zinc-400 st pl-1">
                            Configuración de Permisos
                          </h3>
                          {Object.entries(categories).map(
                            ([categoryKey, category]) => {
                              const style = CATEGORY_STYLES[categoryKey] || {
                                color: "text-zinc-400",
                                bgColor: "bg-zinc-800",
                              };
                              const isExpanded =
                                expandedCategories.has(categoryKey);
                              const activeCount = category.permissions.filter(
                                (p) => hasPermission(selectedAgent, p.key),
                              ).length;
                              const totalCount = category.permissions.length;
                              const progress = (activeCount / totalCount) * 100;

                              return (
                                <div
                                  key={categoryKey}
                                  className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden transition-all duration-300"
                                >
                                  <button
                                    onClick={() => toggleCategory(categoryKey)}
                                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div
                                        className={`w-10 h-10 rounded-xl ${style.bgColor} bg-opacity-10 border border-white/5 flex items-center justify-center`}
                                      >
                                        <Settings2
                                          className={`w-5 h-5 ${style.color}`}
                                        />
                                      </div>
                                      <div className="text-left">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-zinc-200">
                                            {category.name}
                                          </span>
                                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                                            {activeCount}/{totalCount}
                                          </span>
                                        </div>
                                        <div className="w-24 h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                                          <div
                                            className="h-full bg-purple-500 transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div
                                      className={`p-2 rounded-full bg-zinc-950 border border-white/5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                                    >
                                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 grid grid-cols-1 xl:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                      {category.permissions.map((perm) => {
                                        const hasPerm = hasPermission(
                                          selectedAgent,
                                          perm.key,
                                        );
                                        const source = getPermissionSource(
                                          selectedAgent,
                                          perm.key,
                                        );
                                        const isDangerous =
                                          DANGEROUS_PERMISSIONS.includes(
                                            perm.key,
                                          );
                                        const isAdmin =
                                          selectedAgent.permissions.includes(
                                            "*",
                                          );

                                        return (
                                          <div
                                            key={perm.key}
                                            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                                              isDangerous
                                                ? "bg-red-500/5 border-red-500/10"
                                                : hasPerm
                                                  ? "bg-zinc-800/40 border-zinc-700/50"
                                                  : "bg-zinc-900/40 border-transparent hover:border-zinc-800"
                                            }`}
                                          >
                                            <button
                                              onClick={() =>
                                                handlePermissionToggle(
                                                  selectedAgent._id,
                                                  perm.key,
                                                  hasPerm,
                                                )
                                              }
                                              disabled={isSaving || isAdmin}
                                              className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                                hasPerm
                                                  ? "bg-purple-600 border-purple-600 text-zinc-50"
                                                  : "bg-zinc-900 border-zinc-600 hover:border-zinc-500"
                                              } ${isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                                            >
                                              {hasPerm && (
                                                <CheckCircle className="w-3.5 h-3.5" />
                                              )}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span
                                                  className={`text-sm font-medium ${hasPerm ? "text-zinc-200" : "text-zinc-500"}`}
                                                >
                                                  {perm.label}
                                                </span>
                                                {isDangerous && (
                                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                                )}
                                              </div>
                                              <p className="text-xs text-zinc-500 leading-snug mb-1.5">
                                                {perm.description}
                                              </p>
                                              <div className="flex items-center gap-2">
                                                <code className="text-[10px] text-zinc-600 bg-zinc-950 px-1.5 py-0.5 rounded">
                                                  {perm.key}
                                                </code>
                                                {source === "allow" && (
                                                  <span className="text-[10px] text-emerald-400">
                                                    +manual
                                                  </span>
                                                )}
                                                {source === "deny" && (
                                                  <span className="text-[10px] text-red-400">
                                                    -denegado
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    ) : (
                      !isLoadingAgent && (
                        <EmptyState
                          icon={Shield}
                          title="Selecciona un agente"
                          description="Elige un agente de la lista izquierda para gestionar sus permisos y roles."
                        />
                      )
                    )}
                  </div>
                </div>
              )}

              {/* ROLES TAB */}
              {activeTab === "roles" && (
                <div className="p-8 overflow-y-auto h-full custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {roles.map((role) => (
                      <div
                        key={role._id}
                        className="group bg-zinc-900/50 hover:bg-zinc-800/50 rounded-2xl border border-white/5 hover:border-white/10 p-5 transition-all duration-300 hover:shadow-xl hover:shadow-black/20"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/5"
                            style={{ backgroundColor: `${role.color}15` }}
                          >
                            <Shield
                              className="w-6 h-6"
                              style={{ color: role.color }}
                            />
                          </div>
                          {role.isSystem && (
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-boldrounded border border-zinc-700">
                              Sistema
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-zinc-50 mb-1">
                          {role.displayName}
                        </h3>
                        <p className="text-xs font-mono text-zinc-500 mb-4">
                          {role.name}
                        </p>

                        <p className="text-sm text-zinc-400 mb-6 line-clamp-2 h-10 leading-relaxed">
                          {role.description}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <span
                            className={`text-xs font-medium ${role.permissions.includes("*") ? "text-amber-400" : "text-zinc-500"}`}
                          >
                            {role.permissions.includes("*")
                              ? "Acceso Total"
                              : `${role.permissions.length} Permisos`}
                          </span>
                          <span className="text-xs text-zinc-600 font-mono">
                            Prio: {role.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REQUESTS TAB */}
              {activeTab === "requests" && (
                <div className="flex h-full">
                  {/* Requests List */}
                  <div className="w-96 border-r border-white/5 bg-zinc-900/30 overflow-y-auto custom-scrollbar">
                    {permissionRequests.length === 0 ? (
                      <EmptyState
                        icon={CheckCircle}
                        title="Sin solicitudes"
                        description="No hay solicitudes pendientes de revisión."
                        small
                      />
                    ) : (
                      <div className="p-3 space-y-2">
                        {permissionRequests.map((request) => (
                          <button
                            key={request._id}
                            onClick={() => handleSelectRequest(request)}
                            className={`w-full p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                              selectedRequest?._id === request._id
                                ? "bg-zinc-800 border-zinc-600 shadow-lg"
                                : "bg-zinc-900/40 border-transparent hover:bg-zinc-800 hover:border-zinc-700"
                            }`}
                          >
                            {/* Status Strip */}
                            <div
                              className={`absolute left-0 top-0 bottom-0 w-1 ${
                                request.status === "pending"
                                  ? "bg-amber-500"
                                  : request.status === "approved"
                                    ? "bg-emerald-500"
                                    : "bg-red-500"
                              }`}
                            />

                            <div className="flex justify-between items-start mb-2 pl-2">
                              <div>
                                <div className="font-medium text-zinc-200">
                                  {request.agent.name}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {request.agent.email}
                                </div>
                              </div>
                              <span className="text-[10px] text-zinc-600 font-mono">
                                {new Date(request.createdAt).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" },
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pl-2 mt-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercaseborder ${
                                  request.status === "pending"
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    : request.status === "approved"
                                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                      : "bg-red-500/10 text-red-500 border-red-500/20"
                                }`}
                              >
                                {request.status === "pending"
                                  ? "Pendiente"
                                  : request.status}
                              </span>
                              <span className="text-xs text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                                {request.permissions.length} perms
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Request Details */}
                  <div className="flex-1 overflow-y-auto bg-zinc-950/30 p-8 custom-scrollbar">
                    {selectedRequest ? (
                      <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-start justify-between bg-zinc-900 border border-white/5 rounded-2xl p-6">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-xl font-bold text-zinc-50 border border-white/10">
                              {selectedRequest.agent.name.charAt(0)}
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-zinc-50 mb-1">
                                {selectedRequest.agent.name}
                              </h2>
                              <div className="flex items-center gap-2 text-sm">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs border ${ROLE_COLORS[selectedRequest.agent.role]}`}
                                >
                                  {selectedRequest.agent.role}
                                </span>
                                <span className="text-zinc-500">
                                  {selectedRequest.agent.email}
                                </span>
                              </div>
                            </div>
                          </div>

                          {selectedRequest.status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleQuickAction("reject")}
                                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-500/20"
                              >
                                Rechazar Todo
                              </button>
                              <button
                                onClick={() => handleQuickAction("approve")}
                                className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20"
                              >
                                Aprobar Todo
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Permissions List */}
                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
                          <div className="px-6 py-4 border-b border-white/5 bg-zinc-900">
                            <h3 className="font-medium text-zinc-50 flex items-center gap-2">
                              <KeyRound className="w-4 h-4 text-purple-400" />
                              Permisos Solicitados
                            </h3>
                          </div>
                          <div className="divide-y divide-white/5">
                            {selectedRequest.permissions.map((perm, idx) => {
                              const decision =
                                permissionDecisions[perm.permission] ||
                                "pending";
                              return (
                                <div
                                  key={idx}
                                  className={`p-4 transition-colors ${decision === "approve" ? "bg-emerald-500/5" : decision === "reject" ? "bg-red-500/5" : ""}`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <code className="text-sm text-purple-300 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded">
                                        {perm.permission}
                                      </code>
                                      <p className="text-xs text-zinc-500 mt-1">
                                        {new Date(
                                          perm.requestedAt,
                                        ).toLocaleDateString()}
                                      </p>
                                    </div>
                                    {selectedRequest.status === "pending" && (
                                      <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                                        <button
                                          onClick={() =>
                                            handlePermissionDecision(
                                              perm.permission,
                                              "reject",
                                            )
                                          }
                                          className={`p-1.5 rounded-md transition-all ${decision === "reject" ? "bg-red-500 text-zinc-50 shadow" : "text-zinc-500 hover:text-red-400"}`}
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                        <div className="w-px bg-zinc-800 mx-1" />
                                        <button
                                          onClick={() =>
                                            handlePermissionDecision(
                                              perm.permission,
                                              "approve",
                                            )
                                          }
                                          className={`p-1.5 rounded-md transition-all ${decision === "approve" ? "bg-emerald-500 text-zinc-50 shadow" : "text-zinc-500 hover:text-emerald-400"}`}
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="bg-zinc-950/50 p-3 rounded-lg border border-white/5 mt-2">
                                    <div className="flex gap-2">
                                      <MessageSquare className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                                      <p className="text-sm text-zinc-300 italic">
                                        "{perm.reason}"
                                      </p>
                                    </div>
                                    {perm.page && (
                                      <p className="text-xs text-zinc-500 mt-2 pl-6">
                                        Desde: {perm.page}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Review Form */}
                        {selectedRequest.status === "pending" && (
                          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6">
                            <h3 className="font-medium text-zinc-50 mb-4">
                              Finalizar Revisión
                            </h3>
                            <textarea
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              placeholder="Añade notas sobre tu decisión (obligatorio si rechazas)..."
                              className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-purple-500 mb-4 resize-none"
                            />

                            {Object.values(permissionDecisions).some(
                              (d) => d === "reject",
                            ) && (
                              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={blockOnReject}
                                  onChange={(e) =>
                                    setBlockOnReject(e.target.checked)
                                  }
                                  className="rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-zinc-400">
                                  Bloquear permisos rechazados permanentemente
                                </span>
                              </label>
                            )}

                            <button
                              onClick={handleSubmitReview}
                              disabled={
                                isSaving ||
                                Object.values(permissionDecisions).some(
                                  (d) => d === "pending",
                                )
                              }
                              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-zinc-50 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                              {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-5 h-5" />
                              )}
                              Confirmar Decisión
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={FileText}
                        title="Selecciona una solicitud"
                        description="Revisa los detalles y toma una decisión."
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// Helper Components for Cleaner Code
function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold ${color}`}>{count}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-zinc-800 text-zinc-50 shadow-sm"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge > 0 && (
        <span className="bg-amber-500 text-zinc-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({ icon: Icon, title, description, small }: any) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-full text-center p-8 ${small ? "scale-90" : ""}`}
    >
      <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
        <Icon className="w-10 h-10 text-zinc-700" />
      </div>
      <h3 className="text-lg font-medium text-zinc-50 mb-2">{title}</h3>
      <p className="text-zinc-500 max-w-sm">{description}</p>
    </div>
  );
}
