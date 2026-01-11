// Agents Management Page
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { 
  Users, 
  Plus, 
  Search,
  Edit2,
  Key,
  Trash2,
  Shield,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { Button, Input, Select, Modal, Toggle, toast } from '../components/ui';
import type { Agent } from '../types';

// Status badge component
function StatusBadge({ status }: { status: Agent['onlineStatus'] }) {
  const colors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-500',
  };
  
  return (
    <span className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <span className="capitalize text-sm">{status}</span>
    </span>
  );
}

// Role badge component
function RoleBadge({ role }: { role: Agent['role'] }) {
  return role === 'admin' ? (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs">
      <ShieldCheck className="w-3 h-3" />
      Admin
    </span>
  ) : (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">
      <Shield className="w-3 h-3" />
      Agent
    </span>
  );
}

export default function AgentsPage() {
  const currentAgent = useAuthStore((state) => state.agent);
  const token = useAuthStore((state) => state.token);
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'support' as 'admin' | 'support',
  });
  const [newPassword, setNewPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadAgents();
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
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || agent.role === filterRole;
    const matchesStatus = filterStatus === 'all' || agent.onlineStatus === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      
      if (data.ok) {
        setAgents([...agents, data.agent]);
        setShowCreateModal(false);
        setFormData({ name: '', email: '', password: '', role: 'support' });
        toast.success('Agent created successfully');
      } else {
        setFormError(data.error || 'Failed to create agent');
      }
    } catch (error) {
      setFormError('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    
    setFormLoading(true);
    setFormError('');

    try {
      const res = await fetch(`/api/admin/agents/${selectedAgent._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
        }),
      });
      const data = await res.json();
      
      if (data.ok) {
        setAgents(agents.map((a) => (a._id === selectedAgent._id ? data.agent : a)));
        setShowEditModal(false);
        toast.success('Agent updated successfully');
      } else {
        setFormError(data.error || 'Failed to update agent');
      }
    } catch (error) {
      setFormError('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    
    setFormLoading(true);
    setFormError('');

    try {
      const res = await fetch(`/api/admin/agents/${selectedAgent._id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      
      if (data.ok) {
        setShowPasswordModal(false);
        setNewPassword('');
        toast.success('Password reset successfully');
      } else {
        setFormError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      setFormError('Network error');
    } finally {
      setFormLoading(false);
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
        toast.success(`Agent ${data.agent.isActive ? 'activated' : 'deactivated'}`);
      } else {
        toast.error(data.error || 'Failed to update agent');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;
    
    setFormLoading(true);

    try {
      const res = await fetch(`/api/admin/agents/${selectedAgent._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (data.ok) {
        setAgents(agents.map((a) => 
          a._id === selectedAgent._id ? { ...a, isActive: false } : a
        ));
        setShowDeleteModal(false);
        toast.success('Agent deactivated');
      } else {
        toast.error(data.error || 'Failed to delete agent');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (agent: Agent) => {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      password: '',
      role: agent.role,
    });
    setFormError('');
    setShowEditModal(true);
  };

  const openPasswordModal = (agent: Agent) => {
    setSelectedAgent(agent);
    setNewPassword('');
    setFormError('');
    setShowPasswordModal(true);
  };

  const openDeleteModal = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowDeleteModal(true);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" />
            Agents
          </h1>
          <p className="text-gray-500 mt-1">Manage your support team</p>
        </div>
        <Button onClick={() => {
          setFormData({ name: '', email: '', password: '', role: 'support' });
          setFormError('');
          setShowCreateModal(true);
        }} icon={<Plus className="w-4 h-4" />}>
          Add Agent
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="support">Support</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="away">Away</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Agents Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Chats</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredAgents.map((agent) => (
              <tr 
                key={agent._id} 
                className={`hover:bg-gray-800/50 transition-colors ${!agent.isActive ? 'opacity-50' : ''}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium">
                      {agent.avatar ? (
                        <img src={agent.avatar} alt="" className="w-full h-full rounded-full" />
                      ) : (
                        agent.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{agent.name}</p>
                      <p className="text-sm text-gray-500">{agent.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <RoleBadge role={agent.role} />
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={agent.onlineStatus} />
                </td>
                <td className="px-6 py-4 text-gray-400">
                  {agent.activeChats || 0} active
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">
                  {formatDate(agent.lastActivity || agent.lastLogin)}
                </td>
                <td className="px-6 py-4">
                  <Toggle
                    enabled={agent.isActive !== false}
                    onChange={() => handleToggleActive(agent)}
                    disabled={agent._id === currentAgent?._id}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(agent)}
                      className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openPasswordModal(agent)}
                      className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    {agent._id !== currentAgent?._id && (
                      <button
                        onClick={() => openDeleteModal(agent)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredAgents.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No agents found matching your criteria
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Agent" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="John Doe"
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@example.com"
            required
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
          />
          <Select
            label="Role"
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'support' })}
            options={[
              { value: 'support', label: 'Support Agent' },
              { value: 'admin', label: 'Administrator' },
            ]}
          />
          
          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Create Agent
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Agent" size="md">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            disabled
            helperText="Email cannot be changed"
          />
          <Select
            label="Role"
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'support' })}
            options={[
              { value: 'support', label: 'Support Agent' },
              { value: 'admin', label: 'Administrator' },
            ]}
            disabled={selectedAgent?._id === currentAgent?._id}
          />
          
          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Reset Password" size="sm">
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-gray-400 text-sm">
            Reset password for <strong className="text-white">{selectedAgent?.name}</strong>
          </p>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
          />
          
          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Deactivate Agent" size="sm">
        <div className="space-y-4">
          <p className="text-gray-400">
            Are you sure you want to deactivate <strong className="text-white">{selectedAgent?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            The agent will no longer be able to log in. Chat history will be preserved.
          </p>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={formLoading}>
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
