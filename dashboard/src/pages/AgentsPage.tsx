/**
 * AgentsPage - Modern UI for managing support agents
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
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
  UserX,
  UserCheck,
  MoreVertical,
  Key,
  MessageSquare,
  Clock,
  Star,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { Agent, OnlineStatus } from '../types';

interface AgentFormData {
  name: string;
  email: string;
  role: 'support' | 'supervisor' | 'admin' | 'junior';
  maxConcurrentChats: number;
  skills: string[];
  department: string;
}

const initialFormData: AgentFormData = {
  name: '',
  email: '',
  role: 'support',
  maxConcurrentChats: 5,
  skills: [],
  department: '',
};

const roleLabels: Record<string, string> = {
  support: 'Agente',
  junior: 'Junior',
  supervisor: 'Supervisor',
  admin: 'Administrador',
};

const roleColors: Record<string, string> = {
  support: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  junior: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  supervisor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const statusColors: Record<string, string> = {
  available: 'bg-green-500',
  busy: 'bg-yellow-500',
  away: 'bg-orange-500',
  offline: 'bg-gray-500',
};

const statusLabels: Record<string, string> = {
  available: 'Disponible',
  busy: 'Ocupado',
  away: 'Ausente',
  offline: 'Desconectado',
};

export default function AgentsPage() {
  const token = useAuthStore((state) => state.token);
  const currentAgent = useAuthStore((state) => state.agent);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/admin/agents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        : '/api/admin/agents';

      const res = await fetch(url, {
        method: editingAgent ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.ok) {
        if (editingAgent) {
          setAgents(agents.map((a) => (a._id === editingAgent._id ? data.agent : a)));
        } else {
          setAgents([...agents, data.agent]);
        }
        closeFormModal();
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAgent) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${editingAgent._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(agents.filter((a) => a._id !== editingAgent._id));
        setShowDeleteModal(false);
        setEditingAgent(null);
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingAgent) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${editingAgent._id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setShowResetPasswordModal(false);
        setEditingAgent(null);
        // TODO: Show temporary password
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(agents.map((a) => (a._id === agent._id ? data.agent : a)));
      }
    } catch (error) {
      console.error('Failed to toggle agent status:', error);
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
        department: agent.department || '',
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
    setSkillInput('');
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || agent.role === selectedRole;
    const matchesStatus = selectedStatus === 'all' || agent.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const stats = {
    total: agents.length,
    online: agents.filter((a) => a.status !== 'offline' && a.isActive).length,
    admins: agents.filter((a) => a.role === 'admin').length,
    supervisors: agents.filter((a) => a.role === 'supervisor').length,
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-gray-950">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl">
            <Users className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Agentes</h1>
            <p className="text-sm text-gray-400">Gestiona el equipo de soporte</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:scale-105 ${
              showFilters
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => openFormModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-medium transition-all hover:scale-105 shadow-lg shadow-green-500/25"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Agente</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-800">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Agentes" value={stats.total} color="green" />
        <StatCard icon={<UserCheck className="w-5 h-5" />} label="En Línea" value={stats.online} color="blue" />
        <StatCard icon={<Shield className="w-5 h-5" />} label="Supervisores" value={stats.supervisors} color="purple" />
        <StatCard icon={<ShieldCheck className="w-5 h-5" />} label="Administradores" value={stats.admins} color="amber" />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
            </div>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all min-w-40"
            >
              <option value="all">Todos los roles</option>
              <option value="support">Agente</option>
              <option value="junior">Junior</option>
              <option value="supervisor">Supervisores</option>
              <option value="admin">Administradores</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all min-w-40"
            >
              <option value="all">Todos los estados</option>
              <option value="available">Disponibles</option>
              <option value="busy">Ocupados</option>
              <option value="away">Ausentes</option>
              <option value="offline">Desconectados</option>
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="p-4 bg-gray-800/50 rounded-2xl mb-4">
              <Users className="w-12 h-12 opacity-50" />
            </div>
            <p className="text-lg font-medium">No se encontraron agentes</p>
            {searchQuery && <p className="text-sm mt-1">Intenta ajustar tu búsqueda</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent._id}
                agent={agent}
                isCurrentUser={currentAgent?._id === agent._id}
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                onEdit={() => openFormModal(agent)}
                onDelete={() => {
                  setEditingAgent(agent);
                  setShowDeleteModal(true);
                }}
                onResetPassword={() => {
                  setEditingAgent(agent);
                  setShowResetPasswordModal(true);
                }}
                onToggleActive={() => handleToggleActive(agent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <FormModal
          isEditing={!!editingAgent}
          formData={formData}
          setFormData={setFormData}
          skillInput={skillInput}
          setSkillInput={setSkillInput}
          onAddSkill={addSkill}
          onRemoveSkill={removeSkill}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onClose={closeFormModal}
        />
      )}

      {/* Delete Modal */}
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

      {/* Reset Password Modal */}
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
    </div>
  );
}

// Sub-components

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'green' | 'blue' | 'purple' | 'amber';
}) {
  const colors = {
    green: 'from-green-500/20 to-green-600/10 text-green-400 border-green-500/20',
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/20',
  };

  const iconColors = {
    green: 'bg-green-500/20',
    blue: 'bg-blue-500/20',
    purple: 'bg-purple-500/20',
    amber: 'bg-amber-500/20',
  };

  return (
    <div className={`p-4 bg-gradient-to-br ${colors[color]} rounded-xl border`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${iconColors[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
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
}: {
  agent: Agent;
  isCurrentUser: boolean;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
}) {
  const status: OnlineStatus = (agent.status as OnlineStatus) || 'offline';
  const isActive = agent.isActive !== false;

  return (
    <div
      className={`group p-5 bg-gray-800/40 rounded-xl border transition-all duration-200 ${
        isActive
          ? 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/60'
          : 'border-gray-800/50 opacity-50'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center text-lg font-bold text-white">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${statusColors[status]} rounded-full border-2 border-gray-800`}
              title={statusLabels[status]}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{agent.name}</h3>
              {isCurrentUser && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">Tú</span>
              )}
            </div>
            <p className="text-sm text-gray-400 truncate">{agent.email}</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === agent._id ? null : agent._id);
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {activeDropdown === agent._id && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 py-1 overflow-hidden">
              <button
                onClick={onEdit}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={onResetPassword}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <Key className="w-4 h-4" />
                <span>Resetear contraseña</span>
              </button>
              <button
                onClick={onToggleActive}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {isActive ? (
                  <>
                    <UserX className="w-4 h-4" />
                    <span>Desactivar</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Activar</span>
                  </>
                )}
              </button>
              {!isCurrentUser && (
                <button
                  onClick={onDelete}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${roleColors[agent.role]}`}>
          {agent.role === 'admin' && <ShieldCheck className="w-3 h-3 inline mr-1" />}
          {agent.role === 'supervisor' && <Shield className="w-3 h-3 inline mr-1" />}
          {roleLabels[agent.role]}
        </span>
        {agent.department && (
          <span className="px-3 py-1 bg-gray-700/50 text-gray-400 rounded-lg text-xs">
            {agent.department}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-700/50">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <MessageSquare className="w-3 h-3" />
          </div>
          <p className="text-sm font-medium text-white">{agent.activeChats || 0}</p>
          <p className="text-xs text-gray-500">Activos</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Clock className="w-3 h-3" />
          </div>
          <p className="text-sm font-medium text-white">{agent.avgResponseTime || '-'}</p>
          <p className="text-xs text-gray-500">Resp. Prom.</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Star className="w-3 h-3" />
          </div>
          <p className="text-sm font-medium text-white">{agent.rating?.toFixed(1) || '-'}</p>
          <p className="text-xs text-gray-500">Rating</p>
        </div>
      </div>

      {agent.skills && agent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t border-gray-700/50">
          {agent.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="px-2 py-0.5 bg-gray-700/50 text-gray-400 rounded text-xs">
              {skill}
            </span>
          ))}
          {agent.skills.length > 3 && (
            <span className="px-2 py-0.5 bg-gray-700/50 text-gray-500 rounded text-xs">
              +{agent.skills.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function FormModal({
  isEditing,
  formData,
  setFormData,
  skillInput,
  setSkillInput,
  onAddSkill,
  onRemoveSkill,
  isSaving,
  onSubmit,
  onClose,
}: {
  isEditing: boolean;
  formData: AgentFormData;
  setFormData: (data: AgentFormData) => void;
  skillInput: string;
  setSkillInput: (value: string) => void;
  onAddSkill: () => void;
  onRemoveSkill: (skill: string) => void;
  isSaving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-gray-800/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              {isEditing ? <Edit3 className="w-5 h-5 text-green-400" /> : <Plus className="w-5 h-5 text-green-400" />}
            </div>
            <h2 className="text-lg font-bold text-white">{isEditing ? 'Editar Agente' : 'Nuevo Agente'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nombre</label>
              <div className="relative">
                <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre completo"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@ejemplo.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Rol</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as AgentFormData['role'] })}
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
              >
                <option value="agent">Agente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Departamento</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Ej: Ventas, Soporte"
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Chats Simultáneos Máximos</label>
            <input
              type="number"
              min={1}
              max={20}
              value={formData.maxConcurrentChats}
              onChange={(e) => setFormData({ ...formData, maxConcurrentChats: parseInt(e.target.value) || 5 })}
              className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Habilidades</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), onAddSkill())}
                placeholder="Ej: Python, Ventas, Soporte técnico"
                className="flex-1 px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
              <button
                onClick={onAddSkill}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm"
                  >
                    {skill}
                    <button
                      onClick={() => onRemoveSkill(skill)}
                      className="ml-1 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700/50 bg-gray-800/30 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={isSaving || !formData.name.trim() || !formData.email.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Agente'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  agent,
  isSaving,
  onDelete,
  onClose,
}: {
  agent: Agent;
  isSaving: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 p-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Eliminar Agente</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            ¿Estás seguro de eliminar a "<span className="text-white font-medium">{agent.name}</span>"?
            <br />
            <span className="text-sm">Esta acción no se puede deshacer.</span>
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onDelete}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-medium disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  agent,
  isSaving,
  onReset,
  onClose,
}: {
  agent: Agent;
  isSaving: boolean;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 p-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Key className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Resetear Contraseña</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            ¿Resetear la contraseña de "<span className="text-white font-medium">{agent.name}</span>"?
            <br />
            <span className="text-sm">Se enviará una nueva contraseña temporal por email.</span>
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onReset}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all font-medium disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            <span>Resetear</span>
          </button>
        </div>
      </div>
    </div>
  );
}
