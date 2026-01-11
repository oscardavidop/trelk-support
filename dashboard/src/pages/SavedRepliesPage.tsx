// Saved Replies Admin Page
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Modal, Button, Input, Toggle } from '../components/ui';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Copy,
  MessageSquare,
  Tag,
  TrendingUp,
  Zap,
  Code,
  Loader2,
} from 'lucide-react';
import type { SavedReply, SavedReplyStats } from '../types';
import { PLACEHOLDERS } from '../types';

interface ReplyFormData {
  title: string;
  content: string;
  category: string;
  shortcut: string;
  isActive: boolean;
}

const initialFormData: ReplyFormData = {
  title: '',
  content: '',
  category: '',
  shortcut: '',
  isActive: true,
};

export default function SavedRepliesPage() {
  const token = useAuthStore((state) => state.token);
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<SavedReplyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPlaceholdersModalOpen, setIsPlaceholdersModalOpen] = useState(false);
  const [selectedReply, setSelectedReply] = useState<SavedReply | null>(null);
  const [formData, setFormData] = useState<ReplyFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadReplies();
  }, []);

  const loadReplies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/saved-replies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(data.replies);
        setCategories(data.categories);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load saved replies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/saved-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          category: formData.category.trim() || undefined,
          shortcut: formData.shortcut.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReplies([...replies, data.reply]);
        setIsCreateModalOpen(false);
        setFormData(initialFormData);
        // Update categories if new one was added
        if (formData.category && !categories.includes(formData.category)) {
          setCategories([...categories, formData.category]);
        }
      }
    } catch (error) {
      console.error('Failed to create saved reply:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedReply || !formData.title.trim() || !formData.content.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/saved-replies/${selectedReply._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          category: formData.category.trim() || undefined,
          shortcut: formData.shortcut.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(replies.map((r) => (r._id === selectedReply._id ? data.reply : r)));
        setIsEditModalOpen(false);
        setSelectedReply(null);
        setFormData(initialFormData);
      }
    } catch (error) {
      console.error('Failed to update saved reply:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedReply) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/saved-replies/${selectedReply._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(replies.filter((r) => r._id !== selectedReply._id));
        setIsDeleteModalOpen(false);
        setSelectedReply(null);
      }
    } catch (error) {
      console.error('Failed to delete saved reply:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (reply: SavedReply) => {
    setSelectedReply(reply);
    setFormData({
      title: reply.title,
      content: reply.content,
      category: reply.category || '',
      shortcut: reply.shortcut || '',
      isActive: reply.isActive,
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (reply: SavedReply) => {
    setSelectedReply(reply);
    setIsDeleteModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Filter replies
  const filteredReplies = replies.filter((reply) => {
    const matchesSearch =
      reply.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || reply.category === selectedCategory;
    const matchesActive = showInactive || reply.isActive;
    return matchesSearch && matchesCategory && matchesActive;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Saved Replies</h1>
          <p className="text-gray-400 mt-1">
            Manage quick response templates for faster support
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setIsPlaceholdersModalOpen(true)}
          >
            <Code className="w-4 h-4 mr-2" />
            Placeholders
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Reply
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={<MessageSquare className="w-5 h-5" />}
            label="Total Replies"
            value={stats.totalReplies}
            color="primary"
          />
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Active"
            value={stats.activeReplies}
            color="success"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Total Usage"
            value={stats.totalUsage}
            color="secondary"
          />
          <StatCard
            icon={<Tag className="w-5 h-5" />}
            label="Categories"
            value={categories.length}
            color="warning"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search replies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-700 bg-gray-800 text-primary focus:ring-primary/50"
          />
          Show inactive
        </label>
      </div>

      {/* Replies Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredReplies.map((reply) => (
          <ReplyCard
            key={reply._id}
            reply={reply}
            onEdit={() => openEditModal(reply)}
            onDelete={() => openDeleteModal(reply)}
            onCopy={() => copyToClipboard(reply.content)}
          />
        ))}
      </div>

      {filteredReplies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No saved replies found</p>
          {searchQuery && (
            <p className="text-sm mt-1">Try adjusting your search</p>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData(initialFormData);
        }}
        title="Create Saved Reply"
        size="lg"
      >
        <ReplyForm
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          onSubmit={handleCreate}
          onCancel={() => setIsCreateModalOpen(false)}
          isLoading={isSaving}
          submitLabel="Create Reply"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedReply(null);
          setFormData(initialFormData);
        }}
        title="Edit Saved Reply"
        size="lg"
      >
        <ReplyForm
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditModalOpen(false)}
          isLoading={isSaving}
          submitLabel="Save Changes"
        />
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedReply(null);
        }}
        title="Delete Saved Reply"
      >
        <div className="space-y-4">
          <p className="text-gray-400">
            Are you sure you want to delete "{selectedReply?.title}"? This action cannot
            be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isSaving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Placeholders Modal */}
      <Modal
        isOpen={isPlaceholdersModalOpen}
        onClose={() => setIsPlaceholdersModalOpen(false)}
        title="Available Placeholders"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Use these placeholders in your replies. They will be replaced with
            actual values when the message is sent.
          </p>
          <div className="space-y-2">
            {Object.entries(PLACEHOLDERS).map(([key, description]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div>
                  <code className="text-primary font-mono">{key}</code>
                  <p className="text-gray-500 text-sm mt-0.5">{description}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(key)}
                  className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'primary' | 'success' | 'secondary' | 'warning';
}) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-500',
    secondary: 'bg-cyan-500/10 text-cyan-500',
    warning: 'bg-yellow-500/10 text-yellow-500',
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <div
        className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  );
}

// Reply Card Component
function ReplyCard({
  reply,
  onEdit,
  onDelete,
  onCopy,
}: {
  reply: SavedReply;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      className={`bg-gray-900/50 border rounded-xl p-4 ${
        reply.isActive ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">{reply.title}</h3>
            {!reply.isActive && (
              <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                Inactive
              </span>
            )}
          </div>
          {reply.category && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Tag className="w-3 h-3" />
              {reply.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Copy content"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-800 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-gray-400 text-sm line-clamp-3 mb-3">{reply.content}</p>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-3">
          {reply.shortcut && (
            <span className="px-2 py-1 bg-gray-800 rounded font-mono">
              {reply.shortcut}
            </span>
          )}
          <span>Used {reply.usageCount} times</span>
        </div>
        {reply.createdBy && <span>by {reply.createdBy.name}</span>}
      </div>
    </div>
  );
}

// Reply Form Component
function ReplyForm({
  formData,
  setFormData,
  categories,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel,
}: {
  formData: ReplyFormData;
  setFormData: (data: ReplyFormData) => void;
  categories: string[];
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Title"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="e.g., Greeting, Closing, Account Issue"
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Content <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Enter the reply content. Use placeholders like {userName} for dynamic values..."
          rows={5}
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Tip: Use placeholders like {'{agentName}'}, {'{userName}'} for dynamic content
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Category
          </label>
          <input
            type="text"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            placeholder="e.g., Greetings, Technical"
            list="category-suggestions"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <datalist id="category-suggestions">
            {categories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Shortcut
          </label>
          <input
            type="text"
            value={formData.shortcut}
            onChange={(e) =>
              setFormData({ ...formData, shortcut: e.target.value })
            }
            placeholder="e.g., /greet, /close"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
          />
        </div>
      </div>

      <Toggle
        label="Active"
        description="Inactive replies won't appear in the quick reply dropdown"
        checked={formData.isActive}
        onChange={(checked) => setFormData({ ...formData, isActive: checked })}
      />

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          isLoading={isLoading}
          disabled={!formData.title.trim() || !formData.content.trim()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
