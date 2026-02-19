/**
 * LiveChatPage - WebChat Projects Management
 * Configure and manage live chat widgets for websites
 * 
 * Diseño consistente con SavedRepliesPage, BroadcastsPage, PermissionsPage
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  MessageCircle,
  Plus,
  Settings,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Globe,
  Code,
  Shield,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Palette,
  Users,
  Clock,
  Key,
  Power,
  PowerOff,
  MoreVertical,
  ShieldAlert,
  Ban,
  Zap,
} from 'lucide-react';
import {
  listWebChatProjects,
  createWebChatProject,
  updateWebChatProject,
  deleteWebChatProject,
  toggleProjectStatus,
  regenerateApiKey,
  getEmbedCode,
  getSecurityEvents,
  blockIP,
  unblockVisitor,
  DEFAULT_PROJECT_CONFIG,
  type WebChatProject,
  type WebChatProjectConfig,
  type SecurityEvent,
} from '../services/webchat.service';

// ============= TYPES =============

interface ProjectFormData {
  name: string;
  description: string;
  allowedDomains: string;
  config: Partial<WebChatProjectConfig>;
}

const initialFormData: ProjectFormData = {
  name: '',
  description: '',
  allowedDomains: '',
  config: { ...DEFAULT_PROJECT_CONFIG },
};

// ============= STAT BADGE =============

function StatBadge({ icon: Icon, count, label, color, bg }: { 
  icon: React.ElementType; 
  count: number | string; 
  label: string; 
  color: string; 
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{typeof count === 'number' ? count.toLocaleString() : count}</span>
        <span className="text-[10px] font-bold text-zinc-500 uppercase">{label}</span>
      </div>
    </div>
  );
}

// ============= MAIN COMPONENT =============

export default function LiveChatPage() {
  const { agent } = useAuthStore();
  const isAdmin = agent?.role === 'admin';

  // Data states
  const [projects, setProjects] = useState<WebChatProject[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [activeTab, setActiveTab] = useState<'projects' | 'security'>('projects');
  const [selectedProject, setSelectedProject] = useState<WebChatProject | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [embedCode, setEmbedCode] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  // Load data
  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await listWebChatProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar los proyectos');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSecurityEvents = useCallback(async () => {
    try {
      const events = await getSecurityEvents(100);
      setSecurityEvents(events);
    } catch (err) {
      console.error('Error loading security events:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    if (isAdmin) {
      loadSecurityEvents();
    }
  }, [loadProjects, loadSecurityEvents, isAdmin]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProjects();
    if (isAdmin) {
      await loadSecurityEvents();
    }
    setIsRefreshing(false);
  };

  // ============= HANDLERS =============

  const handleCreateProject = async () => {
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      const domains = formData.allowedDomains
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const newProject = await createWebChatProject({
        name: formData.name,
        description: formData.description || undefined,
        allowedDomains: domains,
        config: formData.config as Partial<WebChatProjectConfig>,
      });

      setProjects(prev => [newProject, ...prev]);
      setShowCreateModal(false);
      setFormData(initialFormData);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Error al crear el proyecto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;

    setIsSaving(true);
    try {
      const domains = formData.allowedDomains
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const updated = await updateWebChatProject(selectedProject.projectId, {
        name: formData.name,
        description: formData.description || undefined,
        allowedDomains: domains,
        config: formData.config,
      });

      setProjects(prev => prev.map(p => p.projectId === updated.projectId ? updated : p));
      setShowConfigModal(false);
      setSelectedProject(null);
    } catch (err) {
      console.error('Error updating project:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      await deleteWebChatProject(selectedProject.projectId);
      setProjects(prev => prev.filter(p => p.projectId !== selectedProject.projectId));
      setShowDeleteModal(false);
      setSelectedProject(null);
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleToggleStatus = async (project: WebChatProject) => {
    try {
      const isOnline = await toggleProjectStatus(project.projectId);
      setProjects(prev => prev.map(p => 
        p.projectId === project.projectId ? { ...p, isOnline } : p
      ));
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleRegenerateKey = async (project: WebChatProject) => {
    if (!confirm('¿Regenerar la API key? El widget dejará de funcionar hasta actualizar el código de instalación.')) {
      return;
    }

    try {
      const newKey = await regenerateApiKey(project.projectId);
      setProjects(prev => prev.map(p => 
        p.projectId === project.projectId ? { ...p, apiKey: newKey } : p
      ));
    } catch (err) {
      console.error('Error regenerating key:', err);
    }
  };

  const handleShowEmbed = async (project: WebChatProject) => {
    try {
      const { embedCode: code } = await getEmbedCode(project.projectId);
      setEmbedCode(code);
      setSelectedProject(project);
      setShowEmbedModal(true);
    } catch (err) {
      console.error('Error getting embed code:', err);
    }
  };

  const handleEditConfig = (project: WebChatProject) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      allowedDomains: project.allowedDomains.join('\n'),
      config: { ...project.config },
    });
    setShowConfigModal(true);
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleBlockIP = async (ip: string) => {
    const reason = prompt('Razón del bloqueo:');
    if (!reason) return;

    try {
      await blockIP(ip, reason, 60);
      loadSecurityEvents();
    } catch (err) {
      console.error('Error blocking IP:', err);
    }
  };

  const handleUnblockVisitor = async (visitorId: string) => {
    try {
      await unblockVisitor(visitorId);
      loadSecurityEvents();
    } catch (err) {
      console.error('Error unblocking visitor:', err);
    }
  };

  // Stats calculation
  const stats = {
    totalProjects: projects.length,
    onlineProjects: projects.filter(p => p.isOnline && p.currentlyOnline).length,
    totalAgentsOnline: projects.reduce((sum, p) => sum + (p.onlineAgentCount || 0), 0),
    securityEventsCount: securityEvents.length,
  };

  // ============= RENDER =============

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-zinc-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-blue-500/30">
      
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        
        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-blue-900/10">
                <MessageCircle className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Live Chat</h1>
                <p className="text-sm text-zinc-400">Configura widgets de chat para tus sitios web</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-50 transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>
              
              {isAdmin && (
                <button
                  onClick={() => {
                    setFormData(initialFormData);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-zinc-50 font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="w-5 h-5" />
                  <span>Nuevo Proyecto</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
            <StatBadge icon={Globe} count={stats.totalProjects} label="Proyectos" color="text-zinc-200" bg="bg-zinc-800" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Zap} count={stats.onlineProjects} label="Online" color="text-emerald-400" bg="bg-emerald-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Users} count={stats.totalAgentsOnline} label="Agentes" color="text-blue-400" bg="bg-blue-500/10" />
            {isAdmin && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <StatBadge icon={ShieldAlert} count={stats.securityEventsCount} label="Eventos" color="text-amber-400" bg="bg-amber-500/10" />
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded-lg">
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium focus:outline-none transition-all ${
                activeTab === 'projects'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              Proyectos ({projects.length})
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setActiveTab('security');
                  loadSecurityEvents();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none ${
                  activeTab === 'security'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Shield className="w-4 h-4" />
                Seguridad
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
          
          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <>
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                  <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 mb-4">
                    <MessageCircle className="w-12 h-12 stroke-1" />
                  </div>
                  <p className="text-lg font-medium text-zinc-300 mb-2">No hay proyectos</p>
                  <p className="text-zinc-500 mb-6">Crea tu primer proyecto de Live Chat para tu sitio web</p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-zinc-50 font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                      Crear Proyecto
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.projectId}
                      project={project}
                      isAdmin={isAdmin}
                      copiedField={copiedField}
                      onCopy={handleCopy}
                      onToggleStatus={handleToggleStatus}
                      onShowEmbed={handleShowEmbed}
                      onEditConfig={handleEditConfig}
                      onRegenerateKey={handleRegenerateKey}
                      onDelete={(p) => {
                        setSelectedProject(p);
                        setShowDeleteModal(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && isAdmin && (
            <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100">Eventos de Seguridad</h3>
                    <p className="text-xs text-zinc-500">Últimos 100 eventos registrados</p>
                  </div>
                </div>
                <button
                  onClick={loadSecurityEvents}
                  className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto custom-scrollbar">
                {securityEvents.length === 0 ? (
                  <div className="p-12 text-center">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
                    <p className="text-zinc-500">No hay eventos de seguridad recientes</p>
                  </div>
                ) : (
                  securityEvents.map((event, idx) => (
                    <SecurityEventRow
                      key={idx}
                      event={event}
                      onBlockIP={handleBlockIP}
                      onUnblockVisitor={handleUnblockVisitor}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <Modal
          title="Nuevo Proyecto de Live Chat"
          onClose={() => setShowCreateModal(false)}
        >
          <ProjectForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleCreateProject}
            onCancel={() => setShowCreateModal(false)}
            isSaving={isSaving}
            isEdit={false}
          />
        </Modal>
      )}

      {showConfigModal && selectedProject && (
        <Modal
          title={`Configurar: ${selectedProject.name}`}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedProject(null);
          }}
          size="lg"
        >
          <ProjectForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateProject}
            onCancel={() => {
              setShowConfigModal(false);
              setSelectedProject(null);
            }}
            isSaving={isSaving}
            isEdit={true}
          />
        </Modal>
      )}

      {showEmbedModal && selectedProject && (
        <Modal
          title="Código de Instalación"
          onClose={() => {
            setShowEmbedModal(false);
            setSelectedProject(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-zinc-400">
              Copia este código y pégalo antes del cierre del tag <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-emerald-400">&lt;/body&gt;</code> en tu sitio web.
            </p>

            <div className="relative group">
              <pre className="bg-zinc-950 border border-zinc-800 text-emerald-400 p-4 rounded-xl text-sm overflow-x-auto font-mono">
                {embedCode}
              </pre>
              <button
                onClick={() => handleCopy(embedCode, 'embed')}
                className="absolute top-3 right-3 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                {copiedField === 'embed' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-400" />
                )}
              </button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-amber-200 text-sm">
                <strong className="text-amber-400">Importante:</strong> El widget solo funcionará en los dominios autorizados configurados en el proyecto.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteModal && selectedProject && (
        <Modal
          title="Eliminar Proyecto"
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedProject(null);
          }}
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-zinc-300">
                ¿Estás seguro de que deseas eliminar el proyecto <strong className="text-zinc-50">{selectedProject.name}</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedProject(null);
                }}
                className="px-4 py-2 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProject}
                className="px-4 py-2 text-zinc-50 bg-red-600 hover:bg-red-500 rounded-xl transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============= PROJECT CARD =============

function ProjectCard({
  project,
  isAdmin,
  copiedField,
  onCopy,
  onToggleStatus,
  onShowEmbed,
  onEditConfig,
  onRegenerateKey,
  onDelete,
}: {
  project: WebChatProject;
  isAdmin: boolean;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  onToggleStatus: (p: WebChatProject) => void;
  onShowEmbed: (p: WebChatProject) => void;
  onEditConfig: (p: WebChatProject) => void;
  onRegenerateKey: (p: WebChatProject) => void;
  onDelete: (p: WebChatProject) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isOnline = project.isOnline && project.currentlyOnline;

  return (
    <div className={`group relative bg-zinc-900/60 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/20 overflow-hidden flex flex-col ${
      isOnline
        ? 'border-zinc-800 hover:border-blue-500/30'
        : 'border-zinc-800/50'
    }`}>
      
      {/* Online indicator */}
      {isOnline && (
        <div className="absolute top-3 right-3 z-10">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-5 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div 
            className="p-2.5 rounded-xl border"
            style={{ 
              backgroundColor: project.config.primaryColor + '15',
              borderColor: project.config.primaryColor + '30'
            }}
          >
            <MessageCircle 
              className="w-5 h-5" 
              style={{ color: project.config.primaryColor }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-zinc-100 truncate">{project.name}</h3>
            </div>
            {project.description && (
              <p className="text-sm text-zinc-500 truncate">{project.description}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase border ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            {isOnline ? `Online (${project.onlineAgentCount || 0} agentes)` : 'Offline'}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Palette className="w-3 h-3" />
            {project.config.position === 'right' ? 'Derecha' : 'Izquierda'}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
            {project.config.theme === 'auto' ? 'Auto' : project.config.theme}
          </span>
        </div>

        {/* Project Details */}
        <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase ">Project ID</span>
            <div className="flex items-center gap-1.5">
              <code className="text-xs font-mono text-zinc-400">{project.projectId}</code>
              <button
                onClick={() => onCopy(project.projectId, `pid-${project.projectId}`)}
                className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {copiedField === `pid-${project.projectId}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase ">Dominios</span>
            <span className="text-xs text-zinc-400">
              {project.allowedDomains.length > 0
                ? project.allowedDomains.slice(0, 2).join(', ') +
                  (project.allowedDomains.length > 2 ? ` +${project.allowedDomains.length - 2}` : '')
                : 'Todos'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-zinc-800/50 bg-zinc-900/30 flex items-center justify-between">
        <button
          onClick={() => onShowEmbed(project)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
        >
          <Code className="w-4 h-4" />
          Obtener Código
        </button>

        {isAdmin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEditConfig(project)}
              className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
              title="Configurar"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleStatus(project)}
              className={`p-2 rounded-lg transition-colors ${
                project.isOnline
                  ? 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
                  : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title={project.isOnline ? 'Desactivar' : 'Activar'}
            >
              {project.isOnline ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 bottom-full mb-1 w-44 bg-zinc-900 rounded-xl shadow-xl border border-zinc-800 z-20 overflow-hidden">
                    <button
                      onClick={() => {
                        onRegenerateKey(project);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      <Key className="w-4 h-4 text-amber-400" />
                      Regenerar API Key
                    </button>
                    <hr className="border-zinc-800" />
                    <button
                      onClick={() => {
                        onDelete(project);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= SECURITY EVENT ROW =============

function SecurityEventRow({
  event,
  onBlockIP,
  onUnblockVisitor,
}: {
  event: SecurityEvent;
  onBlockIP: (ip: string) => void;
  onUnblockVisitor: (visitorId: string) => void;
}) {
  const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
    rate_limit: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    abuse: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    ip_block: { icon: Ban, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    domain_reject: { icon: Globe, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    suspicious: { icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  };

  const config = typeConfig[event.type] || typeConfig.suspicious;
  const Icon = config.icon;

  return (
    <div className="p-4 flex items-center gap-4 hover:bg-zinc-800/30 transition-colors">
      <div className={`p-2 rounded-xl ${config.bg} border ${config.border}`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`font-medium capitalize ${config.color}`}>
            {event.type.replace('_', ' ')}
          </span>
          <span className="text-xs text-zinc-600">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="text-sm text-zinc-500 truncate">
          {event.ip && <span className="mr-2">IP: {event.ip}</span>}
          {event.visitorId && <span className="mr-2">Visitor: {event.visitorId.slice(0, 12)}...</span>}
          {event.projectId && <span>Project: {event.projectId}</span>}
        </div>
        {event.details && (
          <div className="text-xs text-zinc-600 mt-0.5 truncate">
            {JSON.stringify(event.details).slice(0, 100)}...
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {event.ip && (
          <button
            onClick={() => onBlockIP(event.ip!)}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Bloquear IP"
          >
            <Ban className="w-4 h-4" />
          </button>
        )}
        {event.visitorId && event.type === 'abuse' && (
          <button
            onClick={() => onUnblockVisitor(event.visitorId!)}
            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
            title="Desbloquear Visitor"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============= PROJECT FORM =============

function ProjectForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSaving,
  isEdit,
}: {
  formData: ProjectFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isEdit: boolean;
}) {
  const [activeConfigTab, setActiveConfigTab] = useState<'general' | 'appearance' | 'behavior'>('general');

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Nombre del Proyecto *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Mi Sitio Web"
            className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Descripción
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Widget de soporte para sitio principal"
            className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Dominios Autorizados
            <span className="text-zinc-500 font-normal ml-2">(uno por línea)</span>
          </label>
          <textarea
            value={formData.allowedDomains}
            onChange={(e) => setFormData((prev) => ({ ...prev, allowedDomains: e.target.value }))}
            placeholder={"ejemplo.com\n*.ejemplo.com\nsubdominio.ejemplo.com"}
            rows={3}
            className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 font-mono text-sm transition-all"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Usa *.dominio.com para permitir subdominios. Deja vacío para permitir cualquier dominio (no recomendado).
          </p>
        </div>
      </div>

      {/* Config Tabs */}
      {isEdit && (
        <>
          <div className="flex items-center gap-1 p-1 bg-zinc-800/50 rounded-xl">
            {['general', 'appearance', 'behavior'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveConfigTab(tab as typeof activeConfigTab)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeConfigTab === tab
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {tab === 'general' && 'General'}
                {tab === 'appearance' && 'Apariencia'}
                {tab === 'behavior' && 'Comportamiento'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {activeConfigTab === 'general' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Título del Header
                    </label>
                    <input
                      type="text"
                      value={formData.config.headerText || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, headerText: e.target.value },
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Placeholder del Input
                    </label>
                    <input
                      type="text"
                      value={formData.config.inputPlaceholder || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, inputPlaceholder: e.target.value },
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Mensaje de Bienvenida
                  </label>
                  <textarea
                    value={formData.config.welcomeMessage || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        config: { ...prev.config, welcomeMessage: e.target.value },
                      }))
                    }
                    rows={2}
                    className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Mensaje Offline
                  </label>
                  <textarea
                    value={formData.config.offlineMessage || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        config: { ...prev.config, offlineMessage: e.target.value },
                      }))
                    }
                    rows={2}
                    className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                  />
                </div>
              </>
            )}

            {activeConfigTab === 'appearance' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Color Principal
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.config.primaryColor || '#4F46E5'}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            config: { ...prev.config, primaryColor: e.target.value },
                          }))
                        }
                        className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={formData.config.primaryColor || '#4F46E5'}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            config: { ...prev.config, primaryColor: e.target.value },
                          }))
                        }
                        className="flex-1 px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Posición
                    </label>
                    <select
                      value={formData.config.position || 'right'}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, position: e.target.value as 'left' | 'right' },
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 cursor-pointer"
                    >
                      <option value="right">Derecha</option>
                      <option value="left">Izquierda</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Tema
                    </label>
                    <select
                      value={formData.config.theme || 'auto'}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, theme: e.target.value as 'light' | 'dark' | 'auto' },
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 cursor-pointer"
                    >
                      <option value="auto">Automático</option>
                      <option value="light">Claro</option>
                      <option value="dark">Oscuro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Icono del Botón
                    </label>
                    <select
                      value={formData.config.bubbleIcon || 'chat'}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, bubbleIcon: e.target.value as 'chat' | 'message' | 'support' | 'custom' },
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 cursor-pointer"
                    >
                      <option value="chat">Chat</option>
                      <option value="message">Mensaje</option>
                      <option value="support">Soporte</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.config.showAgentPhotos !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, showAgentPhotos: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-zinc-300">Fotos de agentes</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.config.showAgentNames !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, showAgentNames: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-zinc-300">Nombres</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.config.showPoweredBy !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, showPoweredBy: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-zinc-300">"Powered by"</span>
                  </label>
                </div>
              </>
            )}

            {activeConfigTab === 'behavior' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'enableAttachments', label: 'Archivos adjuntos' },
                    { key: 'enableEmoji', label: 'Emojis' },
                    { key: 'enableTypingIndicator', label: 'Indicador escritura' },
                    { key: 'enableSoundNotifications', label: 'Sonidos' },
                    { key: 'enableSurvey', label: 'Encuesta satisfacción' },
                    { key: 'hideWhenOffline', label: 'Ocultar si offline', defaultFalse: true },
                    { key: 'requireName', label: 'Requerir nombre', defaultFalse: true },
                    { key: 'requireEmail', label: 'Requerir email', defaultFalse: true },
                  ].map(({ key, label, defaultFalse }) => (
                    <label 
                      key={key}
                      className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={defaultFalse ? formData.config[key as keyof WebChatProjectConfig] === true : formData.config[key as keyof WebChatProjectConfig] !== false}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            config: { ...prev.config, [key]: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500/20"
                      />
                      <span className="text-sm text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Delay para abrir automáticamente (segundos)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.config.autoOpenDelay || 0}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        config: { ...prev.config, autoOpenDelay: parseInt(e.target.value) || 0 },
                      }))
                    }
                    className="w-32 px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    0 = desactivado (el usuario debe hacer clic para abrir)
                  </p>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={isSaving || !formData.name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-zinc-50 font-medium rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {isEdit ? 'Guardar Cambios' : 'Crear Proyecto'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============= MODAL =============

function Modal({
  title,
  children,
  onClose,
  size = 'md',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        <div
          className={`relative w-full ${sizeClasses[size]} bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50`}
        >
          <div className="flex items-center justify-between p-5 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-50">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
