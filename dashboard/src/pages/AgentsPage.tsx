/**
 * AgentsPage - Modern UI for managing support agents
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../stores/authStore";
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Shield,
  ShieldCheck,
  UserCog,
  Loader2,
  RefreshCw,
  Filter,
  X,
  Mail,
  Phone,
  Lock,
  Unlock,
  UserX,
  UserCheck,
  MoreVertical,
  Key,
  MessageSquare,
  Clock,
  Star,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  ShieldOff,
  Send,
  Link2,
  Unlink,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  Globe,
  Eye,
  Settings,
  AlertTriangle,
  Activity,
} from "lucide-react";
import type { Agent, OnlineStatus } from "../types";
import AdminMFAModal from "../components/modals/AdminMFAModal";
import { AgentManageModal } from "../components/modals/AgentManageModal";
import SendNotificationModal from "../components/SendNotificationModal";

interface AgentFormData {
  name: string;
  email: string;
  role: "support" | "supervisor" | "admin" | "junior";
  maxConcurrentChats: number;
  skills: string[];
  department: string;
}

const initialFormData: AgentFormData = {
  name: "",
  email: "",
  role: "support",
  maxConcurrentChats: 5,
  skills: [],
  department: "",
};

const roleLabels: Record<string, string> = {
  support: "Agente",
  junior: "Junior",
  supervisor: "Supervisor",
  admin: "Administrador",
};

const roleColors: Record<string, string> = {
  support: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  junior: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  supervisor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  away: "bg-orange-500",
  offline: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  available: "Disponible",
  busy: "Ocupado",
  away: "Ausente",
  offline: "Desconectado",
};

interface AgentSession {
  _id: string;
  deviceType: string;
  browser: string;
  os: string;
  ip: string;
  location?: string;
  loginAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export default function AgentsPage() {
  const token = useAuthStore((state) => state.token);
  const currentAgent = useAuthStore((state) => state.agent);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDesactivateModal, setShowDesactivateModal] = useState(false);
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showAgentManageModal, setShowAgentManageModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTargetAgent, setNotificationTargetAgent] = useState<Agent | null>(null);
  const [manageModalTab, setManageModalTab] = useState<string>("edit");
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Lock states (map of agentId -> isLocked)
  const [agentLockStates, setAgentLockStates] = useState<
    Record<string, boolean>
  >({});

  // Agent sessions for modal
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isAgentOnline, setIsAgentOnline] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAgents();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim()) return;

    setIsSaving(true);
    try {
      const url = editingAgent
        ? `/api/admin/agents/${editingAgent._id}`
        : "/api/admin/agents";

      const res = await fetch(url, {
        method: editingAgent ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.ok) {
        if (editingAgent) {
          setAgents(
            agents.map((a) => (a._id === editingAgent._id ? data.agent : a)),
          );
        } else {
          setAgents([...agents, data.agent]);
        }
        closeFormModal();
      }
    } catch (error) {
      console.error("Failed to save agent:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Lock agent session remotely
  const handleLockAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/lock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgentLockStates((prev) => ({ ...prev, [agentId]: true }));
      } else {
        console.error("Failed to lock agent:", data.error);
      }
    } catch (error) {
      console.error("Failed to lock agent:", error);
    }
  };

  // Unlock agent session remotely
  const handleUnlockAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/unlock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgentLockStates((prev) => ({ ...prev, [agentId]: false }));
      } else {
        console.error("Failed to unlock agent:", data.error);
      }
    } catch (error) {
      console.error("Failed to unlock agent:", error);
    }
  };

  // Open sessions modal for an agent
  // Load sessions for an agent (doesn't open standalone modal anymore)
  const handleViewSessions = async (agent: Agent) => {
    setSessionsLoading(true);

    try {
      const res = await fetch(`/api/agents/${agent._id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgentSessions(data.sessions || []);
        setIsAgentOnline(data.isOnline || false);
      } else {
        setAgentSessions([]);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      setAgentSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Invalidate a specific session
  const handleInvalidateSession = async (sessionId: string) => {
    if (!editingAgent) return;

    try {
      const res = await fetch(
        `/api/agents/${editingAgent._id}/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.ok) {
        setAgentSessions((prev) => prev.filter((s) => s._id !== sessionId));
      } else {
        console.error("Failed to invalidate session:", data.error);
      }
    } catch (error) {
      console.error("Failed to invalidate session:", error);
    }
  };

  // Invalidate all sessions for an agent
  const handleInvalidateAllSessions = async () => {
    if (!editingAgent) return;

    try {
      const res = await fetch(
        `/api/agents/${editingAgent._id}/sessions/invalidate-all`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.ok) {
        setAgentSessions([]);
        setIsAgentOnline(false);
      } else {
        console.error("Failed to invalidate sessions:", data.error);
      }
    } catch (error) {
      console.error("Failed to invalidate sessions:", error);
    }
  };

  // Force logout an agent
  const handleForceLogout = async () => {
    if (!editingAgent) return;

    try {
      const res = await fetch(`/api/agents/${editingAgent._id}/force-logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Desconectado por administrador" }),
      });
      const data = await res.json();
      if (data.ok) {
        setAgentSessions([]);
        setIsAgentOnline(false);
      } else {
        console.error("Failed to force logout:", data.error);
      }
    } catch (error) {
      console.error("Failed to force logout:", error);
    }
  };

  // Open agent manage modal
  const openAgentManageModal = (agent: Agent, tab: string = "edit") => {
    setEditingAgent(agent);
    setManageModalTab(tab);
    setShowAgentManageModal(true);
    // Pre-load sessions if opening sessions tab
    if (tab === "sessions") {
      handleViewSessions(agent);
    }
  };

  // Close agent manage modal
  const closeAgentManageModal = () => {
    setShowAgentManageModal(false);
    setEditingAgent(null);
    setManageModalTab("edit");
  };

  // Fetch lock states for all agents
  const fetchAgentLockStates = useCallback(async () => {
    const lockStates: Record<string, boolean> = {};
    for (const agent of agents) {
      try {
        const res = await fetch(`/api/agents/${agent._id}/lock`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok) {
          lockStates[agent._id] = data.lockState?.isLocked || false;
        }
      } catch (error) {
        // Ignore errors for individual agents
      }
    }
    setAgentLockStates(lockStates);
  }, [agents, token]);

  // Fetch lock states when agents change
  useEffect(() => {
    if (agents.length > 0) {
      fetchAgentLockStates();
    }
  }, [agents, fetchAgentLockStates]);

  const handleDelete = async () => {
    if (!editingAgent) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${editingAgent._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(agents.filter((a) => a._id !== editingAgent._id));
        setShowDeleteModal(false);
        setEditingAgent(null);
      }
    } catch (error) {
      console.error("Failed to delete agent:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingAgent) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/admin/agents/${editingAgent._id}/reset-password`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.ok) {
        setShowResetPasswordModal(false);
        setEditingAgent(null);
        // TODO: Show temporary password
      }
    } catch (error) {
      console.error("Failed to reset password:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      const data = await res.json();
      if (data.ok) {
        console.log("Agent status toggled:", agent);
        setAgents(agents.map((a) => (a._id === agent._id ? data.agent : a)));
        setEditingAgent(data.agent);
        setShowDesactivateModal(false);
      }
    } catch (error) {
      console.error("Failed to toggle agent status:", error);
    }
  };

  // Handle MFA updates from modal
  const handleMFAUpdate = (updatedFields: Partial<Agent>) => {
    if (editingAgent) {
      setAgents(
        agents.map((a) =>
          a._id === editingAgent._id ? { ...a, ...updatedFields } : a,
        ),
      );
    }
  };

  const openFormModal = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      setFormData({
        name: agent.name,
        email: agent.email,
        role: agent.role,
        maxConcurrentChats: agent.maxConcurrentChats || 5,
        skills: agent.skills || [],
        department: agent.department || "",
      });
    } else {
      setEditingAgent(null);
      setFormData(initialFormData);
    }
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingAgent(null);
    setFormData(initialFormData);
    setSkillInput("");
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skill),
    });
  };

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === "all" || agent.role === selectedRole;
    const matchesStatus =
      selectedStatus === "all" || agent.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const stats = {
    total: agents.length,
    online: agents.filter((a) => a.status !== "offline" && a.isActive).length,
    admins: agents.filter((a) => a.role === "admin").length,
    supervisors: agents.filter((a) => a.role === "supervisor").length,
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-zinc-950 gap-4">
        <div className="relative flex items-center justify-center">
          {/* Glow effect background */}
          <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />

          {/* Spinner */}
          <Loader2 className="relative w-8 h-8 text-indigo-500 animate-spin" />
        </div>

        <p className="text-xs font-medium text-zinc-500 animate-pulse">
          Cargando...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-emerald-500/30">
      {/* Green Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-emerald-900/10">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Equipo de Soporte
                </h1>
                <p className="text-sm text-zinc-400">
                  Gestión de agentes y rendimiento
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
              >
                <RefreshCw
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform"}`}
                />
              </button>

              <button
                onClick={() => openFormModal()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                <span>Nuevo Agente</span>
              </button>
            </div>
          </div>

          {/* Stats Bar (Glassy) */}
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
            <StatBadge
              icon={Users}
              count={stats.total}
              label="Total"
              color="text-zinc-200"
              bg="bg-zinc-800"
            />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge
              icon={UserCheck}
              count={stats.online}
              label="En Línea"
              color="text-emerald-400"
              bg="bg-emerald-500/10"
            />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge
              icon={Shield}
              count={stats.supervisors}
              label="Supervisores"
              color="text-purple-400"
              bg="bg-purple-500/10"
            />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge
              icon={ShieldCheck}
              count={stats.admins}
              label="Admins"
              color="text-amber-400"
              bg="bg-amber-500/10"
            />
          </div>

          {/* Toolbar (Search & Filters) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[280px] max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar agente..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="all">Todos los roles</option>
                <option value="support">Agente</option>
                <option value="junior">Junior</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="available">Disponible</option>
                <option value="busy">Ocupado</option>
                <option value="away">Ausente</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-hidden px-8 pb-8 pt-2">
          <div className="flex flex-col bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1.5fr_1fr_50px] gap-4 px-6 py-4 bg-zinc-900/80 border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase r">
              <div className="flex items-center gap-2">Agente</div>
              <div>Rol / Dpto</div>
              <div>Estado</div>
              <div>Métricas</div>
              <div>Habilidades</div>
              <div className="text-right">Acciones</div>
            </div>

            {/* Table Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
                  <Users className="w-16 h-16 mb-4 stroke-1" />
                  <p className="text-lg font-medium">
                    No se encontraron agentes
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {filteredAgents.map((agent) => (
                    <AgentRow
                      key={agent._id}
                      agent={agent}
                      isCurrentUser={currentAgent?._id === agent._id}
                      isLocked={agentLockStates[agent._id] || false}
                      onOpenManage={(tab: string) =>
                        openAgentManageModal(agent, tab)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showFormModal && (
        <FormModal
          isEditing={!!editingAgent}
          agent={editingAgent}
          formData={formData}
          setFormData={setFormData}
          skillInput={skillInput}
          setSkillInput={setSkillInput}
          onAddSkill={addSkill}
          onRemoveSkill={removeSkill}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onClose={closeFormModal}
          onAgentUpdated={loadAgents}
        />
      )}

      {/* Reutilizando tus modales Delete y Reset con estilo actualizado en el componente */}
      {showDeleteModal && editingAgent && (
        <DeleteModal
          agent={editingAgent}
          isSaving={isSaving}
          onDelete={handleDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setEditingAgent(null);
          }}
        />
      )}

      {showResetPasswordModal && editingAgent && (
        <ResetPasswordModal
          agent={editingAgent}
          isSaving={isSaving}
          onReset={handleResetPassword}
          onClose={() => {
            setShowResetPasswordModal(false);
            setEditingAgent(null);
          }}
        />
      )}
      {showDesactivateModal && editingAgent && (
        <DesactivateModal
          agent={editingAgent}
          isSaving={isSaving}
          onConfirm={handleToggleActive}
          onClose={() => {
            setShowDesactivateModal(false);
            setEditingAgent(null);
          }}
        />
      )}

      {showMFAModal && editingAgent && (
        <AdminMFAModal
          agent={editingAgent}
          token={token}
          onClose={() => {
            setShowMFAModal(false);
            setEditingAgent(null);
          }}
          onUpdate={handleMFAUpdate}
        />
      )}

      {/* Note: SessionsModal has been replaced by the sessions tab in AgentManageModal
      {showSessionsModal && editingAgent && (
        <SessionsModal
          agent={editingAgent}
          sessions={agentSessions}
          isLoading={sessionsLoading}
          isOnline={isAgentOnline}
          onInvalidateSession={handleInvalidateSession}
          onInvalidateAll={handleInvalidateAllSessions}
          onForceLogout={handleForceLogout}
          onClose={() => {
            setShowSessionsModal(false);
            setEditingAgent(null);
            setAgentSessions([]);
          }}
        />
      )}
      */}

      {showAgentManageModal && editingAgent && (
        <AgentManageModal
          agent={editingAgent}
          currentTab={manageModalTab as any}
          isCurrentUser={currentAgent?._id === editingAgent._id}
          isLocked={agentLockStates[editingAgent._id] || false}
          sessions={agentSessions}
          sessionsLoading={sessionsLoading}
          isOnline={isAgentOnline}
          onTabChange={(tab) => setManageModalTab(tab)}
          onClose={closeAgentManageModal}
          onSaveAgent={async (data) => {
            const res = await fetch(`/api/admin/agents/${editingAgent._id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(data),
            });
            const result = await res.json();
            if (result.ok) {
              setAgents(
                agents.map((a) =>
                  a._id === editingAgent._id ? result.agent : a,
                ),
              );
              setEditingAgent(result.agent);
            } else {
              throw new Error(result.error || "Error al guardar");
            }
          }}
          onResetPassword={async () => {
            const res = await fetch(
              `/api/admin/agents/${editingAgent._id}/reset-password`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            return res.json();
          }}
          onToggleActive={() => handleToggleActive(editingAgent)}
          onLock={() => handleLockAgent(editingAgent._id)}
          onUnlock={() => handleUnlockAgent(editingAgent._id)}
          onDelete={() => {
            setShowDeleteModal(true);
          }}
          onViewSessions={() => handleViewSessions(editingAgent)}
          onInvalidateSession={handleInvalidateSession}
          onInvalidateAll={handleInvalidateAllSessions}
          onForceLogout={handleForceLogout}
          onAgentUpdated={loadAgents}
          onSendNotification={() => {
            setNotificationTargetAgent(editingAgent);
            setShowNotificationModal(true);
          }}
        />
      )}

      {/* Send Notification Modal */}
      <SendNotificationModal
        isOpen={showNotificationModal}
        onClose={() => {
          setShowNotificationModal(false);
          setNotificationTargetAgent(null);
        }}
        agents={agents}
        preselectedAgentId={notificationTargetAgent?._id}
      />
    </div>
  );
}

// Sub-components

function AgentRow({
  agent,
  isCurrentUser,
  isLocked,
  onOpenManage,
}: {
  agent: any;
  isCurrentUser: boolean;
  isLocked: boolean;
  onOpenManage: (tab: string) => void;
}) {
  const status: OnlineStatus =
    (agent.onlineStatus as OnlineStatus) || "offline";
  const isActive = agent.isActive !== false;

  return (
    <div
      className={`group grid grid-cols-[2fr_1.5fr_1fr_1.5fr_1fr_50px] gap-4 px-6 py-4 items-center hover:bg-zinc-800/30 transition-colors duration-200 ${!isActive && "opacity-50 grayscale-[0.5]"}`}
    >
      {/* 1. Agente (Avatar + Nombre) */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          {agent.avatar ? (
            <img
              src={agent.avatar}
              alt={agent.name}
              className="w-10 h-10 rounded-full bg-zinc-800 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center text-sm font-bold text-white shadow-inner">
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${statusColors[status]}`}
          />
        </div>
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-200 truncate">
              {agent.name}
            </span>
            {isCurrentUser && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-px rounded border border-emerald-500/30 font-medium">
                TÚ
              </span>
            )}
            {agent.security?.mfa?.enabled && (
              <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-px rounded border border-indigo-500/30 font-medium flex items-center gap-0.5">
                <Shield className="w-2.5 h-2.5" />
                MFA
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500 truncate">{agent.email}</span>
        </div>
      </div>

      {/* 2. Rol y Departamento */}
      <div className="flex flex-col items-start gap-1.5">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-md border font-medium uppercase ${roleColors[agent.role]}`}
        >
          {roleLabels[agent.role] || agent.role}
        </span>
        {agent.department && (
          <span className="text-xs text-zinc-400 flex items-center gap-1">
            <Users className="w-3 h-3 text-zinc-600" />
            {agent.department}
          </span>
        )}
      </div>

      {/* 3. Estado */}
      <div>
        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`}
          ></div>
          <span className="text-sm text-zinc-300 capitalize">
            {statusLabels[status]}
          </span>
        </div>
        <span className="text-[10px] text-zinc-500">
          {isActive ? "Cuenta activa" : "Desactivado"}
        </span>
      </div>

      {/* 4. Métricas (Condensadas) */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
            {agent.activeChats || 0}
          </div>
          <span className="text-[10px] text-zinc-600">Chats Activos</span>
        </div>
        <div className="w-px h-6 bg-zinc-800" />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium">
            <Star className="w-3.5 h-3.5 fill-amber-400/20" />
            {agent.metrics.averageRating?.toFixed(1) || "-"}
          </div>
          <span className="text-[10px] text-zinc-600">Rating</span>
        </div>
      </div>

      {/* 5. Skills (Píldoras pequeñas) */}
      <div className="flex flex-wrap gap-1">
        {agent.skills?.slice(0, 2).map((skill: string) => (
          <span
            key={skill}
            className="px-1.5 py-0.5 bg-zinc-800/80 border border-zinc-700 text-zinc-400 rounded text-[10px]"
          >
            {skill}
          </span>
        ))}
        {agent.skills?.length > 2 && (
          <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[10px] border border-zinc-700">
            +{agent.skills.length - 2}
          </span>
        )}
        {!agent.skills?.length && (
          <span className="text-zinc-700 text-xs">-</span>
        )}
      </div>

      {/* 6. Acciones - Botón para abrir modal de gestión */}
      <div className="relative flex justify-end items-center gap-1">
        {isLocked && (
          <div
            className="w-6 h-6 flex items-center justify-center text-amber-500"
            title="Sesión bloqueada"
          >
            <Lock className="w-4 h-4" />
          </div>
        )}
        <button
          onClick={() => onOpenManage("overview")}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-all duration-200 group-hover:bg-zinc-800/50"
          title="Gestionar agente"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  isCurrentUser,
  activeDropdown,
  setActiveDropdown,
  onEdit,
  onDelete,
  onResetPassword,
  onToggleActive,
  onSendNotification,
}: any) {
  const status: OnlineStatus =
    (agent.onlineStatus as OnlineStatus) || "offline";
  const isActive = agent.isActive !== false;

  return (
    <div
      className={`group relative bg-zinc-900/60 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/20 overflow-visible ${isActive ? "border-zinc-800 hover:border-emerald-500/30" : "border-zinc-800/50 opacity-60"}`}
    >
      {/* Card Header */}
      <div className="p-5 pb-4">
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            {/* Avatar */}
            <div className="relative">
              {agent.avatar ? (
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className="w-12 h-12 rounded-4xl"
                />
              ) : (
                <div className="w-12 h-12 rounded-4xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center text-lg font-bold text-white shadow-inner">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className={`absolute bottom-6 -right-1 w-4 h-4 rounded-full border-[3px] border-zinc-900 ${statusColors[status]}`}
              />
            </div>

            {/* Info */}
            <div className="min-w-0">
              <h3 className="font-semibold text-zinc-100 truncate flex items-center gap-2">
                {agent.name}
                {isCurrentUser && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    TÚ
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {agent.email}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-medium uppercase${roleColors[agent.role]}`}
                >
                  {agent.role}
                </span>
                {agent.department && (
                  <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-800 bg-zinc-800/50 text-zinc-400">
                    {agent.department}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Context Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(
                  activeDropdown === agent._id ? null : agent._id,
                );
              }}
              className={`p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors ${activeDropdown === agent._id ? "bg-white/10 text-white" : ""}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {activeDropdown === agent._id && (
              <div className="absolute right-0 top-8 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <DropdownItem icon={Edit3} label="Editar" onClick={onEdit} />
                <DropdownItem
                  icon={Key}
                  label="Contraseña"
                  onClick={onResetPassword}
                />
                <DropdownItem
                  icon={Send}
                  label="Notificar"
                  onClick={onSendNotification}
                />
                <DropdownItem
                  icon={isActive ? UserX : UserCheck}
                  label={isActive ? "Desactivar" : "Activar"}
                  onClick={onToggleActive}
                />
                {!isCurrentUser && (
                  <>
                    <div className="h-px bg-zinc-800 my-1" />
                    <DropdownItem
                      icon={Trash2}
                      label="Eliminar"
                      onClick={onDelete}
                      danger
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-3 border-t border-zinc-800/50 bg-zinc-900/30">
        <MetricItem
          icon={MessageSquare}
          value={agent.activeChats || 0}
          label="Chats"
        />
        <MetricItem
          icon={Clock}
          value={agent.avgResponseTime || "-"}
          label="Tiempo"
        />
        <MetricItem
          icon={Star}
          value={agent.metrics.averageRating?.toFixed(1) || "-"}
          label="Rating"
          color="text-amber-400"
        />
      </div>

      {/* Skills Footer */}
      {agent.skills && agent.skills.length > 0 && (
        <div className="px-5 py-3 border-t border-zinc-800/50 flex flex-wrap gap-1.5">
          {agent.skills.slice(0, 3).map((skill: string) => (
            <span
              key={skill}
              className="px-2 py-0.5 bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 rounded text-[10px]"
            >
              {skill}
            </span>
          ))}
          {agent.skills.length > 3 && (
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[10px] border border-zinc-700">
              +{agent.skills.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const MetricItem = ({
  icon: Icon,
  value,
  label,
  color = "text-white",
}: any) => (
  <div className="py-3 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors">
    <span className={`text-sm font-semibold ${color}`}>{value}</span>
    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
      <Icon className="w-3 h-3" />
      {label}
    </div>
  </div>
);

const DropdownItem = ({ icon: Icon, label, onClick, danger }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
      danger
        ? "text-red-400 hover:bg-red-500/10"
        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

// Dropdown con portal para evitar problemas de scroll
function DropdownMenu({
  agent,
  isCurrentUser,
  isActive,
  activeDropdown,
  setActiveDropdown,
  onEdit,
  onDelete,
  onResetPassword,
  onToggleActive,
  onMFA,
  onLock,
  onUnlock,
  isLocked,
  onViewSessions,
}: any) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, openUp: false });

  const calculatePosition = useCallback(() => {
    if (buttonRef.current && activeDropdown === agent._id) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 220; // Approximate height
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < dropdownHeight;

      setPosition({
        top: openUp ? rect.top - dropdownHeight + 10 : rect.top,
        left: rect.left - 200, // 192px width + 8px margin
        openUp,
      });
    }
  }, [activeDropdown, agent._id]);

  useEffect(() => {
    calculatePosition();
    window.addEventListener("scroll", () => setActiveDropdown(null), true);
    window.addEventListener("resize", () => setActiveDropdown(null));
    return () => {
      window.removeEventListener("scroll", () => setActiveDropdown(null), true);
      window.removeEventListener("resize", () => setActiveDropdown(null));
    };
  }, [calculatePosition, setActiveDropdown]);

  return (
    <div className="relative flex justify-end">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setActiveDropdown(activeDropdown === agent._id ? null : agent._id);
        }}
        className={`p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors ${activeDropdown === agent._id ? "bg-zinc-700 text-white" : ""}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {activeDropdown === agent._id &&
        createPortal(
          <div
            className="fixed w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[9999] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownItem
              icon={Edit3}
              label="Editar"
              onClick={() => {
                onEdit();
                setActiveDropdown(null);
              }}
            />
            <DropdownItem
              icon={Key}
              label="Contraseña"
              onClick={() => {
                onResetPassword();
                setActiveDropdown(null);
              }}
            />
            <DropdownItem
              icon={agent.security?.mfa?.enabled ? ShieldCheck : Shield}
              label={
                agent.security?.mfa?.enabled
                  ? "Gestionar MFA"
                  : "Configurar MFA"
              }
              onClick={() => {
                onMFA();
                setActiveDropdown(null);
              }}
            />
            <DropdownItem
              icon={isActive ? UserX : UserCheck}
              label={isActive ? "Desactivar" : "Activar"}
              onClick={() => {
                onToggleActive();
                setActiveDropdown(null);
              }}
            />
            {!isCurrentUser && (
              <>
                <DropdownItem
                  icon={Monitor}
                  label="Ver sesiones"
                  onClick={() => {
                    onViewSessions?.();
                    setActiveDropdown(null);
                  }}
                />
                <DropdownItem
                  icon={isLocked ? Unlock : Lock}
                  label={isLocked ? "Desbloquear sesión" : "Bloquear sesión"}
                  onClick={() => {
                    if (isLocked) {
                      onUnlock?.();
                    } else {
                      onLock?.();
                    }
                    setActiveDropdown(null);
                  }}
                />
                <div className="h-px bg-zinc-800 my-1" />
                <DropdownItem
                  icon={Trash2}
                  label="Eliminar"
                  onClick={() => {
                    onDelete();
                    setActiveDropdown(null);
                  }}
                  danger
                />
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function FormModal({
  isEditing,
  agent,
  formData,
  setFormData,
  skillInput,
  setSkillInput,
  onAddSkill,
  onRemoveSkill,
  isSaving,
  onSubmit,
  onClose,
  onAgentUpdated,
}: any) {
  const token = useAuthStore.getState().token;
  const [telegramInput, setTelegramInput] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<
    "idle" | "linking" | "unlinking" | "success" | "error"
  >("idle");
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [currentTelegramId, setCurrentTelegramId] = useState<string | null>(
    agent?.telegramId || null,
  );
  const [currentTelegramUsername, setCurrentTelegramUsername] = useState<
    string | null
  >(agent?.telegramUsername || null);

  // Sync telegram state when agent changes
  useEffect(() => {
    setCurrentTelegramId(agent?.telegramId || null);
    setCurrentTelegramUsername(agent?.telegramUsername || null);
  }, [agent]);

  const handleLinkTelegram = async () => {
    if (!telegramInput.trim()) return;

    // Validate that it's a valid number
    const telegramIdNum = parseInt(telegramInput.trim(), 10);
    if (isNaN(telegramIdNum) || telegramIdNum <= 0) {
      setTelegramError("El ID de Telegram debe ser un número válido");
      return;
    }

    setTelegramStatus("linking");
    setTelegramError(null);

    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/telegram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          telegramId: parseInt(telegramInput.trim(), 10),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setTelegramStatus("success");
        setCurrentTelegramId(telegramInput.trim());
        setTelegramInput("");
        onAgentUpdated?.();
        setTimeout(() => setTelegramStatus("idle"), 2000);
      } else {
        setTelegramStatus("error");
        setTelegramError(data.error || "Error al vincular Telegram");
      }
    } catch {
      setTelegramStatus("error");
      setTelegramError("Error de conexión");
    }
  };

  const handleUnlinkTelegram = async () => {
    setTelegramStatus("unlinking");
    setTelegramError(null);

    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/telegram`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.ok) {
        setTelegramStatus("success");
        setCurrentTelegramId(null);
        setCurrentTelegramUsername(null);
        onAgentUpdated?.();
        setTimeout(() => setTelegramStatus("idle"), 2000);
      } else {
        setTelegramStatus("error");
        setTelegramError(data.error || "Error al desvincular Telegram");
      }
    } catch {
      setTelegramStatus("error");
      setTelegramError("Error de conexión");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              {isEditing ? (
                <Edit3 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Plus className="w-5 h-5 text-emerald-500" />
              )}
            </div>
            <h2 className="text-lg font-bold text-white">
              {isEditing ? "Editar Agente" : "Nuevo Agente"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-5">
            <InputGroup
              label="Nombre"
              icon={UserCog}
              value={formData.name}
              onChange={(e: any) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Nombre completo"
            />
            <InputGroup
              label="Email"
              icon={Mail}
              value={formData.email}
              onChange={(e: any) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="correo@ejemplo.com"
              type="email"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 ">
                Rol
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                >
                  <option value="support">Agente</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                  <option value="junior">Junior</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>
            <InputGroup
              label="Departamento"
              icon={Users}
              value={formData.department}
              onChange={(e: any) =>
                setFormData({ ...formData, department: e.target.value })
              }
              placeholder="Ej: Ventas"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <InputGroup
              label="Chats Máximos"
              icon={MessageSquare}
              value={formData.maxConcurrentChats}
              onChange={(e: any) =>
                setFormData({
                  ...formData,
                  maxConcurrentChats: parseInt(e.target.value),
                })
              }
              type="number"
            />

            {/* Skills Input */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 ">
                Habilidades
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), onAddSkill())
                  }
                  placeholder="Agregar skill..."
                  className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <button
                  onClick={onAddSkill}
                  className="px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-zinc-300 hover:text-white transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {/* Skills Chips */}
              <div className="flex flex-wrap gap-2 mt-3 min-h-[30px]">
                {formData.skills.map((skill: string) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 pl-3 pr-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm"
                  >
                    {skill}
                    <button
                      onClick={() => onRemoveSkill(skill)}
                      className="hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Telegram Section - Solo visible en modo edición */}
          {isEditing && agent && (
            <div className="pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-4 h-4 text-sky-400" />
                <label className="text-xs font-medium text-zinc-400 uppercase ">
                  Vinculación de Telegram
                </label>
              </div>

              {currentTelegramId ? (
                /* Telegram vinculado */
                <div className="flex items-center justify-between p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-500/20 rounded-lg">
                      <Send className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          Telegram Vinculado
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        ID:{" "}
                        <span className="font-mono text-sky-400">
                          {currentTelegramId}
                        </span>
                        {currentTelegramUsername && (
                          <span className="ml-2">
                            @{currentTelegramUsername}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleUnlinkTelegram}
                    disabled={telegramStatus === "unlinking"}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {telegramStatus === "unlinking" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlink className="w-4 h-4" />
                    )}
                    Desvincular
                  </button>
                </div>
              ) : (
                /* Sin Telegram vinculado */
                <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-zinc-300">
                        Este agente no tiene Telegram vinculado
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Ingresa el ID de Telegram del agente para vincular su
                        cuenta manualmente.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Send className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={telegramInput}
                        onChange={(e) => setTelegramInput(e.target.value)}
                        placeholder="ID de Telegram (ej: 123456789)"
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-sm"
                      />
                    </div>
                    <button
                      onClick={handleLinkTelegram}
                      disabled={
                        telegramStatus === "linking" || !telegramInput.trim()
                      }
                      className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {telegramStatus === "linking" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      Vincular
                    </button>
                  </div>
                </div>
              )}

              {/* Mensajes de estado */}
              {telegramStatus === "success" && (
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  Operación completada exitosamente
                </div>
              )}
              {telegramError && (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  {telegramError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-zinc-900/50 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={isSaving || !formData.name || !formData.email}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>{isEditing ? "Guardar Cambios" : "Crear Agente"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InputGroup({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
}: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-2 ">
        {label}
      </label>
      <div className="relative group">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
        />
      </div>
    </div>
  );
}

function DeleteModal({ agent, isSaving, onDelete, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Eliminar Agente</h2>
        <p className="text-zinc-400 mb-6">
          ¿Estás seguro de que deseas eliminar a{" "}
          <span className="text-white font-medium">{agent.name}</span>? <br />
          Esta acción es irreversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onDelete}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-red-900/20"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ agent, isSaving, onReset, onClose }: any) {
  const [mode, setMode] = useState<"link" | "generate">("link");
  const token = useAuthStore.getState().token;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSendLink = async () => {
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/agents/${agent._id}/send-password-reset`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.ok) {
        setResult({
          success: true,
          message: data.message || "Enlace enviado por Telegram",
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Error al enviar enlace",
        });
      }
    } catch {
      setResult({ success: false, message: "Error de conexión" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setResult({
          success: true,
          message: "Contraseña temporal generada y enviada por Telegram",
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Error al generar contraseña",
        });
      }
    } catch {
      setResult({ success: false, message: "Error de conexión" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasTelegram = !!agent.telegramId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
            <Key className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Restablecer Contraseña
          </h2>
          <p className="text-zinc-400 text-sm">
            <span className="text-white font-medium">{agent.name}</span>
            {hasTelegram ? (
              <span className="ml-2 text-emerald-400 text-xs">
                ✓ Telegram vinculado
              </span>
            ) : (
              <span className="ml-2 text-amber-400 text-xs">
                ⚠ Sin Telegram
              </span>
            )}
          </p>
        </div>

        {!result ? (
          <>
            {/* Mode Selection */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setMode("link")}
                disabled={!hasTelegram}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  mode === "link"
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800"
                } ${!hasTelegram && "opacity-50 cursor-not-allowed"}`}
              >
                <MessageSquare
                  className={`w-5 h-5 mb-2 ${mode === "link" ? "text-indigo-400" : "text-zinc-500"}`}
                />
                <p
                  className={`font-medium ${mode === "link" ? "text-white" : "text-zinc-300"}`}
                >
                  Enviar enlace
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  El agente elige su contraseña
                </p>
              </button>
              <button
                onClick={() => setMode("generate")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  mode === "generate"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800"
                }`}
              >
                <Key
                  className={`w-5 h-5 mb-2 ${mode === "generate" ? "text-amber-400" : "text-zinc-500"}`}
                />
                <p
                  className={`font-medium ${mode === "generate" ? "text-white" : "text-zinc-300"}`}
                >
                  Generar temporal
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Contraseña aleatoria
                </p>
              </button>
            </div>

            {/* Info box */}
            <div className="bg-zinc-800/50 rounded-lg p-3 mb-6 text-sm text-zinc-400">
              {mode === "link" ? (
                <p>
                  Se enviará un enlace seguro por Telegram. El enlace expira en
                  15 minutos.
                </p>
              ) : (
                <p>
                  Se generará una contraseña temporal y se enviará por Telegram.
                  El agente deberá cambiarla.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={mode === "link" ? handleSendLink : handleGenerate}
                disabled={isSubmitting || (mode === "link" && !hasTelegram)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-medium shadow-lg ${
                  mode === "link"
                    ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20"
                    : "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20"
                } text-white disabled:opacity-50`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === "link" ? (
                  <MessageSquare className="w-4 h-4" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                <span>{mode === "link" ? "Enviar Enlace" : "Generar"}</span>
              </button>
            </div>
          </>
        ) : (
          /* Result */
          <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            {/* 1. Icon Container with Glow Effect */}
            <div
              className={`
    relative w-16 h-16 rounded-full flex items-center justify-center mb-5
    ${
      result.success
        ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
        : "bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
    }
  `}
            >
              {result.success ? (
                <CheckCircle2 className="w-8 h-8 animate-in zoom-in duration-300" />
              ) : (
                <AlertCircle className="w-8 h-8 animate-in zoom-in duration-300" />
              )}
            </div>

            {/* 2. Status Title */}
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
              {result.success ? "¡Operación Exitosa!" : "Algo salió mal"}
            </h3>

            {/* 3. Detailed Message */}
            <p
              className={`text-sm mb-8 max-w-[260px] leading-relaxed ${result.success ? "text-zinc-400" : "text-red-300/80"}`}
            >
              {result.message}
            </p>

            {/* 4. Action Button */}
            <button
              onClick={onClose}
              className="w-full px-6 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium text-xs uppercase r shadow-sm"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DesactivateModal({ agent, isSaving, onConfirm, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6 text-center">
        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
          <UserX className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {agent.isActive ? "Desactivar Agente" : "Activar Agente"}
        </h2>
        <p className="text-zinc-400 mb-6">
          ¿Estás seguro de que deseas{" "}
          {agent.isActive ? "desactivar" : "activar"} a{" "}
          <span className="text-white font-medium">{agent.name}</span>? <br />
          {agent.isActive
            ? "El agente no podrá iniciar sesión ni atender chats hasta que sea reactivado."
            : "El agente podrá iniciar sesión y atender chats nuevamente."}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(agent)}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-yellow-900/20"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserX className="w-4 h-4" />
            )}
            <span>{agent.isActive ? "Desactivar" : "Activar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
