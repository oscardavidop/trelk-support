/**
 * LiveChatPage - WebChat Projects Management
 * Configure and manage live chat widgets for websites
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
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  ChevronRight,
  Palette,
  Bell,
  Users,
  Clock,
  ExternalLink,
  Key,
  Power,
  PowerOff,
  MoreVertical,
  Edit,
  ShieldAlert,
  Ban,
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
  type CreateProjectData,
} from '../services/webchat.service';

// ============= PROJECT FORM =============

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

export default function LiveChatPage() {
  const { agent } = useAuthStore();
  const isAdmin = agent?.role === 'admin';

  // Data states
  const [projects, setProjects] = useState<WebChatProject[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // ============= RENDER =============

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-indigo-600" />
            Live Chat
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Configura widgets de chat para tus sitios web
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setFormData(initialFormData);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Proyecto
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'projects'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            Proyectos ({projects.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab('security');
                loadSecurityEvents();
              }}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'security'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Seguridad
            </button>
          )}
        </nav>
      </div>

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div className="grid gap-6">
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay proyectos
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crea tu primer proyecto de Live Chat para tu sitio web
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-5 h-5" />
                  Crear Proyecto
                </button>
              )}
            </div>
          ) : (
            projects.map((project) => (
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
            ))
          )}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Eventos de Seguridad
              </h3>
              <button
                onClick={loadSecurityEvents}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
            {securityEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay eventos de seguridad recientes</p>
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

      {/* Create Project Modal */}
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

      {/* Edit Config Modal */}
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

      {/* Embed Code Modal */}
      {showEmbedModal && selectedProject && (
        <Modal
          title="Código de Instalación"
          onClose={() => {
            setShowEmbedModal(false);
            setSelectedProject(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Copia este código y pégalo antes del cierre del tag <code>&lt;/body&gt;</code> en tu sitio web.
            </p>

            <div className="relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                {embedCode}
              </pre>
              <button
                onClick={() => handleCopy(embedCode, 'embed')}
                className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                {copiedField === 'embed' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-300" />
                )}
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Importante:</strong> El widget solo funcionará en los dominios autorizados configurados en el proyecto.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedProject && (
        <Modal
          title="Eliminar Proyecto"
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedProject(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              ¿Estás seguro de que deseas eliminar el proyecto <strong>{selectedProject.name}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedProject(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProject}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg"
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

// ============= COMPONENTS =============

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: project.config.primaryColor + '20' }}
            >
              <MessageCircle
                className="w-6 h-6"
                style={{ color: project.config.primaryColor }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {project.name}
              </h3>
              {project.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                project.isOnline && project.currentlyOnline
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {project.isOnline && project.currentlyOnline ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                  Online ({project.onlineAgentCount || 0} agentes)
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1.5" />
                  Offline
                </>
              )}
            </span>

            {/* Actions menu */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                      <button
                        onClick={() => {
                          onEditConfig(project);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Settings className="w-4 h-4" />
                        Configuración
                      </button>
                      <button
                        onClick={() => {
                          onToggleStatus(project);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {project.isOnline ? (
                          <>
                            <PowerOff className="w-4 h-4" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4" />
                            Activar
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          onRegenerateKey(project);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Key className="w-4 h-4" />
                        Regenerar API Key
                      </button>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={() => {
                          onDelete(project);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Project details */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Project ID
            </span>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {project.projectId}
              </code>
              <button
                onClick={() => onCopy(project.projectId, `pid-${project.projectId}`)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {copiedField === `pid-${project.projectId}` ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Dominios Autorizados
            </span>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {project.allowedDomains.length > 0
                ? project.allowedDomains.slice(0, 2).join(', ') +
                  (project.allowedDomains.length > 2
                    ? ` +${project.allowedDomains.length - 2} más`
                    : '')
                : 'Todos (sin restricción)'}
            </p>
          </div>

          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Posición
            </span>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 capitalize">
              {project.config.position === 'right' ? 'Derecha' : 'Izquierda'}
            </p>
          </div>

          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Tema
            </span>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 capitalize">
              {project.config.theme === 'auto' ? 'Automático' : project.config.theme}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => onShowEmbed(project)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Code className="w-4 h-4" />
            Obtener Código
          </button>
          {isAdmin && (
            <button
              onClick={() => onEditConfig(project)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityEventRow({
  event,
  onBlockIP,
  onUnblockVisitor,
}: {
  event: SecurityEvent;
  onBlockIP: (ip: string) => void;
  onUnblockVisitor: (visitorId: string) => void;
}) {
  const typeConfig = {
    rate_limit: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    abuse: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    ip_block: { icon: Ban, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
    domain_reject: { icon: Globe, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    suspicious: { icon: Eye, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  };

  const config = typeConfig[event.type] || typeConfig.suspicious;
  const Icon = config.icon;

  return (
    <div className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white capitalize">
            {event.type.replace('_', ' ')}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {event.ip && <span className="mr-2">IP: {event.ip}</span>}
          {event.visitorId && <span className="mr-2">Visitor: {event.visitorId.slice(0, 12)}...</span>}
          {event.projectId && <span>Project: {event.projectId}</span>}
        </div>
        {event.details && (
          <div className="text-xs text-gray-400 mt-0.5">
            {JSON.stringify(event.details).slice(0, 100)}...
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {event.ip && (
          <button
            onClick={() => onBlockIP(event.ip!)}
            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
            title="Bloquear IP"
          >
            <Ban className="w-4 h-4" />
          </button>
        )}
        {event.visitorId && event.type === 'abuse' && (
          <button
            onClick={() => onUnblockVisitor(event.visitorId!)}
            className="p-2 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg"
            title="Desbloquear Visitor"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nombre del Proyecto *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Mi Sitio Web"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descripción
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Widget de soporte para sitio principal"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Dominios Autorizados
            <span className="text-gray-500 font-normal ml-2">(uno por línea)</span>
          </label>
          <textarea
            value={formData.allowedDomains}
            onChange={(e) => setFormData((prev) => ({ ...prev, allowedDomains: e.target.value }))}
            placeholder="ejemplo.com&#10;*.ejemplo.com&#10;subdominio.ejemplo.com"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Usa *.dominio.com para permitir subdominios. Deja vacío para permitir cualquier dominio (no recomendado).
          </p>
        </div>
      </div>

      {/* Config Tabs */}
      {isEdit && (
        <>
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-4">
              {['general', 'appearance', 'behavior'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveConfigTab(tab as typeof activeConfigTab)}
                  className={`pb-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeConfigTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'general' && 'General'}
                  {tab === 'appearance' && 'Apariencia'}
                  {tab === 'behavior' && 'Comportamiento'}
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            {activeConfigTab === 'general' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}

            {activeConfigTab === 'appearance' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                        className="w-12 h-10 rounded cursor-pointer"
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
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="right">Derecha</option>
                      <option value="left">Izquierda</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="auto">Automático</option>
                      <option value="light">Claro</option>
                      <option value="dark">Oscuro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="chat">Chat</option>
                      <option value="message">Mensaje</option>
                      <option value="support">Soporte</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.showAgentPhotos !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, showAgentPhotos: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Mostrar fotos de agentes
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.showAgentNames !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, showAgentNames: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Mostrar nombres de agentes
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.showPoweredBy !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, showPoweredBy: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Mostrar "Powered by"
                    </span>
                  </label>
                </div>
              </>
            )}

            {activeConfigTab === 'behavior' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.enableAttachments !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, enableAttachments: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Permitir archivos adjuntos
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.enableEmoji !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, enableEmoji: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Permitir emojis
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.enableTypingIndicator !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, enableTypingIndicator: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Indicador de escritura
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.enableSoundNotifications !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, enableSoundNotifications: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Sonidos de notificación
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.enableSurvey !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, enableSurvey: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Encuesta de satisfacción
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.config.hideWhenOffline === true}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          config: { ...prev.config, hideWhenOffline: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Ocultar cuando offline
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.config.requireName === true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            config: { ...prev.config, requireName: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Requerir nombre
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.config.requireEmail === true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            config: { ...prev.config, requireEmail: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Requerir email
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    0 = desactivado (el usuario debe hacer clic para abrir)
                  </p>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={isSaving || !formData.name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        <div
          className={`relative w-full ${sizeClasses[size]} bg-white dark:bg-gray-800 rounded-xl shadow-xl`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
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
