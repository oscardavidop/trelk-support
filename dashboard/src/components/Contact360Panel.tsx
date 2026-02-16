/**
 * Contact360Panel - Complete Contact Profile Sidebar
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthStore } from "../stores/authStore";
import {
  X,
  User,
  Phone,
  Globe,
  MessageSquare,
  Calendar,
  Clock,
  Tag,
  Edit3,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Activity,
  BarChart3,
  FileText,
  History,
  Bookmark,
  Ban,
  UserCheck,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Send,
  Workflow,
  Star,
  PinIcon,
  Hash,
  Settings,
  Type,
  ToggleLeft,
  List,
  Link,
  Mail,
  Archive,
  RotateCcw,
  Search,
  MoreHorizontal,
} from "lucide-react";
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  restoreCustomField,
  generateFieldKey,
  isValidFieldKey,
  FIELD_TYPE_LABELS,
  type CustomField,
  type CustomFieldType,
  type CreateCustomFieldInput,
} from "../services/customFieldsApi";
import { toast } from "./ui";

// ==================== TYPES ====================

interface IContact360 {
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  language?: string;
  isBlocked: boolean;
  blockedReason?: string;
  createdAt: string;
  updatedAt?: string;
  lastActivity?: string;
  metadata?: Record<string, any>;
  tags: Array<{
    _id: string;
    name: string;
    color: string;
    addedAt: string;
    addedBy?: string;
  }>;
  customFields: Array<{
    fieldId: string;
    key: string;
    label: string;
    type: string;
    value: any;
    updatedAt?: string;
  }>;
  notes: Array<{
    _id: string;
    content: string;
    isPinned: boolean;
    createdAt: string;
    createdBy: { _id: string; name: string };
  }>;
  stats: {
    totalSessions: number;
    activeSession?: {
      sessionId: string;
      status: string;
      assignedAgent?: { _id: string; name: string };
      createdAt: string;
    };
    avgSessionDuration: number;
    avgResponseTime: number;
    totalMessages: number;
    lastSessionDate?: string;
    surveyAvgScore?: number;
  };
  flowHistory: Array<{
    flowId: string;
    flowName: string;
    executedAt: string;
    status: string;
    completedAt?: string;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    actor?: { type: string; name?: string };
    metadata?: any;
  }>;
  segments: Array<{ _id: string; name: string; color: string }>;
}

interface ITag {
  _id: string;
  name: string;
  color: string;
}

interface Props {
  contactId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

// ==================== FIELD TYPE HELPERS ====================
const FIELD_TYPES: {
  type: CustomFieldType;
  label: string;
  description: string;
}[] = [
  { type: "text", label: "Texto", description: "Campo de texto libre" },
  { type: "number", label: "Número", description: "Valores numéricos" },
  { type: "email", label: "Email", description: "Correo electrónico" },
  { type: "url", label: "URL", description: "Enlaces web" },
  { type: "date", label: "Fecha", description: "Selector de fecha" },
  { type: "boolean", label: "Sí/No", description: "Valor booleano" },
  { type: "select", label: "Lista", description: "Opciones predefinidas" },
];

const FieldTypeIcon = ({
  type,
  className = "w-4 h-4",
}: {
  type: CustomFieldType;
  className?: string;
}) => {
  switch (type) {
    case "text":
      return <Type className={className} />;
    case "number":
      return <Hash className={className} />;
    case "date":
      return <Calendar className={className} />;
    case "boolean":
      return <ToggleLeft className={className} />;
    case "select":
      return <List className={className} />;
    case "url":
      return <Link className={className} />;
    case "email":
      return <Mail className={className} />;
    default:
      return <Type className={className} />;
  }
};

// ==================== CUSTOM FIELDS MANAGER MODAL ====================
interface FieldsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFieldsChanged: () => void;
}

function FieldsManagerModal({
  isOpen,
  onClose,
  onFieldsChanged,
}: FieldsManagerModalProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    type: "text" as CustomFieldType,
    description: "",
    required: false,
    options: [] as string[],
    defaultValue: "",
  });
  const [newOption, setNewOption] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [keyTouched, setKeyTouched] = useState(false);

  const loadFields = useCallback(async () => {
    setIsLoading(true);
    const data = await getCustomFields(showInactive);
    setFields(data);
    setIsLoading(false);
  }, [showInactive]);

  useEffect(() => {
    if (isOpen) {
      loadFields();
    }
  }, [isOpen, loadFields]);

  const filteredFields = useMemo(() => {
    return fields.filter((field) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !field.name.toLowerCase().includes(query) &&
          !field.key.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [fields, searchQuery]);

  const activeFields = filteredFields.filter((f) => f.isActive);
  const archivedFields = filteredFields.filter((f) => !f.isActive);

  const resetForm = () => {
    setFormData({
      name: "",
      key: "",
      type: "text",
      description: "",
      required: false,
      options: [],
      defaultValue: "",
    });
    setNewOption("");
    setErrors({});
    setKeyTouched(false);
    setEditingField(null);
    setShowNewForm(false);
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, name: value }));
    if (!keyTouched && !editingField) {
      setFormData((prev) => ({ ...prev, key: generateFieldKey(value) }));
    }
  };

  const handleKeyChange = (value: string) => {
    setKeyTouched(true);
    setFormData((prev) => ({
      ...prev,
      key: value
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, ""),
    }));
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !formData.options.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, options: [...prev.options, trimmed] }));
      setNewOption("");
    }
  };

  const removeOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const openEditForm = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      key: field.key,
      type: field.type,
      description: field.description || "",
      required: field.required,
      options: field.options || [],
      defaultValue: field.defaultValue?.toString() || "",
    });
    setKeyTouched(true);
    setShowNewForm(true);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "El nombre es requerido";
    if (!formData.key.trim()) newErrors.key = "La clave es requerida";
    else if (!isValidFieldKey(formData.key))
      newErrors.key = "Solo letras minúsculas, números y _";
    if (formData.type === "select" && formData.options.length === 0)
      newErrors.options = "Agrega al menos una opción";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      let parsedDefault: string | number | boolean | undefined = undefined;
      if (formData.defaultValue) {
        if (formData.type === "number")
          parsedDefault = parseFloat(formData.defaultValue);
        else if (formData.type === "boolean")
          parsedDefault = formData.defaultValue === "true";
        else parsedDefault = formData.defaultValue;
      }

      if (editingField) {
        const result = await updateCustomField(editingField.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          required: formData.required,
          options: formData.type === "select" ? formData.options : undefined,
          defaultValue: parsedDefault,
        });

        if (result.ok && result.field) {
          toast.success("Campo actualizado");
          setFields((prev) =>
            prev.map((f) => (f.id === result.field!.id ? result.field! : f)),
          );
          resetForm();
          onFieldsChanged();
        } else {
          toast.error(result.error || "Error al actualizar");
        }
      } else {
        const input: CreateCustomFieldInput = {
          name: formData.name.trim(),
          key: formData.key.trim(),
          type: formData.type,
          description: formData.description.trim() || undefined,
          required: formData.required,
          options: formData.type === "select" ? formData.options : undefined,
          defaultValue: parsedDefault,
        };

        const result = await createCustomField(input);

        if (result.ok && result.field) {
          toast.success("Campo creado");
          setFields((prev) => [...prev, result.field!]);
          resetForm();
          onFieldsChanged();
        } else {
          if (result.error?.includes("already exists")) {
            setErrors({ key: "Esta clave ya existe" });
          } else {
            toast.error(result.error || "Error al crear");
          }
        }
      }
    } catch (error) {
      toast.error("Error al guardar el campo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (field: CustomField) => {
    const result = await deleteCustomField(field.id);
    if (result.ok) {
      toast.success("Campo archivado");
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, isActive: false } : f)),
      );
      onFieldsChanged();
    } else {
      toast.error(result.error || "Error al archivar");
    }
  };

  const handleRestore = async (field: CustomField) => {
    const result = await restoreCustomField(field.id);
    if (result.ok) {
      toast.success("Campo restaurado");
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, isActive: true } : f)),
      );
      onFieldsChanged();
    } else {
      toast.error(result.error || "Error al restaurar");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">
                Campos Personalizados
              </h2>
              <p className="text-xs text-zinc-500">
                Define los datos que recolectas de tus usuarios
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {showNewForm ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200 uppercase r">
                  {editingField ? "Editar Campo" : "Nuevo Campo"}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Cancelar y volver
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    Nombre Visible
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    } // Simplificado
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                    placeholder="Ej. ID Cliente"
                  />
                </div>
                {!editingField && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">
                      Clave Interna (Variable)
                    </label>
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-mono group-focus-within:text-indigo-500 transition-colors">
                        $
                      </span>
                      <input
                        type="text"
                        value={formData.key}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            key: e.target.value,
                          }))
                        } // Simplificado
                        className="w-full pl-6 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-indigo-300 font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                        placeholder="id_cliente"
                      />
                    </div>
                  </div>
                )}

                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    Tipo de Dato
                  </label>
                  {!editingField ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FIELD_TYPES.map(({ type, label }) => (
                        <button
                          key={type}
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, type }))
                          }
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            formData.type === type
                              ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.15)]"
                              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800"
                          }`}
                        >
                          <FieldTypeIcon type={type} className="w-3.5 h-3.5" />{" "}
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-400">
                      <FieldTypeIcon type={formData.type} />
                      {FIELD_TYPE_LABELS[formData.type]}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingField ? "Guardar Cambios" : "Crear Campo"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar campos..."
                    className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-50 placeholder-zinc-600 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={() => setShowNewForm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/10 transition-all"
                >
                  <Plus className="w-4 h-4" /> Nuevo
                </button>
              </div>

              {/* Lists */}
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : activeFields.length === 0 && !searchQuery ? (
                  <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
                    <Hash className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">
                      No has creado campos personalizados aún.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeFields.map((field) => (
                      <div
                        key={field.id}
                        className="group flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-colors">
                            <FieldTypeIcon type={field.type} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">
                              {field.name}
                            </p>
                            <p className="text-xs text-zinc-600 font-mono flex items-center gap-1">
                              <span className="text-zinc-700">$</span>
                              {field.key}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditForm(field)}
                            className="p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(field)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== COMPONENT ====================

export default function Contact360Panel({
  contactId,
  onClose,
  onUpdate,
}: Props) {
  const token = useAuthStore((state) => state.token);
  const currentAgent = useAuthStore((state) => state.agent);

  // Data state
  const [contact, setContact] = useState<IContact360 | null>(null);
  const [allTags, setAllTags] = useState<ITag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<
    "overview" | "activity" | "flows" | "notes"
  >("overview");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    info: true,
    tags: true,
    fields: true,
    stats: true,
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{
    firstName?: string;
    lastName?: string;
    language?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Tags state
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Custom Fields state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState<any>(null);
  const [showFieldsManager, setShowFieldsManager] = useState(false);

  // ==================== API CALLS ====================

  const fetchContact = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch contact");

      const data = await response.json();
      setContact(data.contact);
      setEditData({
        firstName: data.contact.firstName,
        lastName: data.contact.lastName,
        language: data.contact.language,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, contactId]);

  const fetchTags = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/tags", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllTags(data.tags || []);
      }
    } catch (err) {
      console.error("Error fetching tags:", err);
    }
  }, [token]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setContact(data.contact);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [token, contactId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== ACTIONS ====================

  const handleSaveEdit = async () => {
    if (!token || !contact) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editData),
      });

      if (!response.ok) throw new Error("Failed to update contact");

      await fetchContact();
      setIsEditing(false);
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!token) return;

    setTagLoading(true);
    try {
      const response = await fetch(`/api/users/${contactId}/tags`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagId }),
      });

      if (!response.ok) throw new Error("Failed to add tag");

      await fetchContact();
      setShowTagPicker(false);
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTagLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!token) return;

    setTagLoading(true);
    try {
      const response = await fetch(`/api/users/${contactId}/tags/${tagId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to remove tag");

      await fetchContact();
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTagLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!token || !newNoteContent.trim()) return;

    setNoteLoading(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}/notes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newNoteContent }),
      });

      if (!response.ok) throw new Error("Failed to add note");

      await fetchContact();
      setNewNoteContent("");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!token || !confirm("¿Eliminar esta nota?")) return;

    try {
      const response = await fetch(
        `/api/contacts/${contactId}/notes/${noteId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to delete note");

      await fetchContact();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleBlockToggle = async () => {
    if (!token || !contact) return;

    const action = contact.isBlocked ? "unblock" : "block";
    const reason = contact.isBlocked
      ? undefined
      : prompt("Motivo del bloqueo:");

    if (!contact.isBlocked && reason === null) return; // Cancelled

    try {
      const response = await fetch(`/api/contacts/${contactId}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} contact`);

      await fetchContact();
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveCustomField = async (fieldId: string) => {
    if (!token) return;

    try {
      const response = await fetch(
        `/api/users/${contactId}/custom-fields/${fieldId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: editingFieldValue }),
        },
      );

      if (!response.ok) throw new Error("Failed to update field");

      await fetchContact();
      setEditingField(null);
      setEditingFieldValue(null);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ==================== HELPERS ====================

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const formatDate = (date: string | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (date: string | undefined) => {
    if (!date) return "—";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Hace un momento";
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours} horas`;
    if (days < 7) return `Hace ${days} días`;
    return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "message_sent":
      case "message_received":
        return <MessageSquare className="w-4 h-4" />;
      case "session_created":
      case "session_closed":
        return <Activity className="w-4 h-4" />;
      case "tag_added":
      case "tag_removed":
        return <Tag className="w-4 h-4" />;
      case "flow_triggered":
      case "flow_completed":
        return <Workflow className="w-4 h-4" />;
      case "contact_blocked":
      case "contact_unblocked":
        return <Ban className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const availableTagsToAdd = allTags.filter(
    (tag) => !contact?.tags.some((t) => t._id === tag._id),
  );

  // const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[480px] bg-gray-950 border-l border-gray-800 z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="fixed inset-y-0 right-0 w-[480px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-400">{error || "Contact not found"}</p>
        <button
          onClick={onClose}
          className="mt-4 text-blue-400 hover:text-blue-300"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col shadow-2xl shadow-black/50">
      {/* --- HEADER --- */}
      <div className="flex-shrink-0 p-6 border-b border-zinc-800 bg-zinc-950 z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Avatar with Status Indicator */}
            <div className="relative group cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center shadow-lg group-hover:border-zinc-600 transition-colors">
                <span className="text-2xl font-bold text-zinc-300">
                  {contact.firstName?.[0] || contact.username?.[0] || "?"}
                </span>
              </div>
              {/* Online/Blocked Status Badge */}
              <div
                className={`absolute -bottom-1 -right-1 p-1 rounded-lg border-4 border-zinc-950 ${contact.isBlocked ? "bg-red-500" : "bg-emerald-500"}`}
              >
                {contact.isBlocked ? (
                  <Ban className="w-3 h-3 text-zinc-50" />
                ) : (
                  <UserCheck className="w-3 h-3 text-zinc-50" />
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-zinc-50 tracking-tight leading-none mb-1">
                {contact.fullName}
              </h2>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <span>@{contact.username || "sin_usuario"}</span>
                {contact.language && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                    {contact.language}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 rounded-lg transition-colors border border-transparent hover:border-zinc-800">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 rounded-lg transition-colors border border-transparent hover:border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats/Segments */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {contact.isBlocked && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              Bloqueado
            </span>
          )}
          {contact.stats.activeSession && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
              <MessageSquare className="w-3 h-3" /> En Chat
            </span>
          )}
          {contact.segments.map((seg) => (
            <span
              key={seg._id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800"
            >
              <Bookmark className="w-3 h-3" style={{ color: seg.color }} />{" "}
              {seg.name}
            </span>
          ))}
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/50">
        {[
          { id: "overview", label: "Perfil", icon: User },
          { id: "activity", label: "Actividad", icon: Activity },
          { id: "flows", label: "Flows", icon: Workflow },
          { id: "notes", label: "Notas", icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? "text-indigo-400 border-indigo-500 bg-indigo-500/5"
                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto bg-zinc-950scrollbar-thumb-zinc-800 scrollbar-track-transparent p-4">
        {/* VIEW: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Section: Basic Info */}
            <section className="space-y-3">
              <button
                onClick={() => toggleSection("info")}
                className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 uppercase r hover:text-zinc-300 transition-colors"
              >
                <span>Información Básica</span>
                {expandedSections.info ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {expandedSections.info && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/50">
                  <div className="flex justify-between items-center p-3 hover:bg-zinc-900 transition-colors group">
                    <span className="text-sm text-zinc-400">Telegram ID</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-zinc-200">
                        {contact.telegramId}
                      </span>
                      <button
                        onClick={() => handleCopy(String(contact.telegramId))}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-50 transition-all"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 hover:bg-zinc-900 transition-colors">
                    <span className="text-sm text-zinc-400">Miembro desde</span>
                    <span className="text-sm text-zinc-200">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 hover:bg-zinc-900 transition-colors">
                    <span className="text-sm text-zinc-400">
                      Última conexión
                    </span>
                    <span className="text-sm text-zinc-200 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      Hace 2 horas
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Section: Tags */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleSection("tags")}
                  className="text-xs font-bold text-zinc-500 uppercase r hover:text-zinc-300 transition-colors"
                >
                  Etiquetas
                </button>
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Añadir
                </button>
              </div>

              {expandedSections.tags && (
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag) => (
                    <span
                      key={tag._id}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all hover:pr-1.5"
                      style={{
                        backgroundColor: `${tag.color}10`,
                        color: tag.color,
                        borderColor: `${tag.color}20`,
                      }}
                    >
                      {tag.name}
                      <button className="w-0 group-hover:w-4 overflow-hidden transition-all text-current opacity-50 hover:opacity-100">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {contact.tags.length === 0 && (
                    <p className="text-xs text-zinc-600 italic">
                      Sin etiquetas asignadas
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Section: Custom Fields */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleSection("fields")}
                  className="text-xs font-bold text-zinc-500 uppercase r hover:text-zinc-300 transition-colors"
                >
                  Campos Personalizados
                </button>
                <button
                  onClick={() => setShowFieldsManager(true)}
                  className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>

              {expandedSections.fields && (
                <div className="space-y-2">
                  {contact.customFields.map((field) => (
                    <div
                      key={field.fieldId}
                      className="group relative bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900 rounded-xl p-3 transition-all"
                    >
                      <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                        {field.label}
                      </p>
                      <p className="text-sm text-zinc-200 font-medium truncate">
                        {field.value || (
                          <span className="text-zinc-700 italic">Vacío</span>
                        )}
                      </p>
                      <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-all">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {contact.customFields.length === 0 && (
                    <div className="text-center p-6 border-2 border-dashed border-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-500">
                        No hay datos personalizados
                      </p>
                      <button
                        onClick={() => setShowFieldsManager(true)}
                        className="mt-2 text-xs text-indigo-400 hover:underline"
                      >
                        Configurar campos
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section: Stats Grid */}
            {expandedSections.stats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-zinc-50 mb-1">
                    {contact.stats.totalSessions}
                  </div>
                  <div className="text-xs text-zinc-500 uppercase font-medium">
                    Sesiones
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-zinc-50 mb-1">
                    {contact.stats.avgResponseTime}s
                  </div>
                  <div className="text-xs text-zinc-500 uppercase font-medium">
                    Tiempo Resp.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: ACTIVITY */}
        {activeTab === "activity" && (
          <div className="relative space-y-6 pl-2">
            {/* Timeline Line */}
            <div className="absolute top-0 bottom-0 left-[19px] w-px bg-zinc-800" />

            {contact.recentActivity.map((act, idx) => (
              <div key={idx} className="relative flex gap-4 group">
                <div className="relative z-10 w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-colors shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="pb-6 border-b border-zinc-800/50 w-full">
                  <p className="text-sm text-zinc-300">{act.description}</p>
                  <span className="text-xs text-zinc-500 mt-1 block">
                    {new Date(act.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW: FLOWS */}
        {activeTab === "flows" && (
          <div className="text-center py-20 text-zinc-500">
            {/* <FlowPanel contactId={contactId} /> */}
          </div>
        )}

        {/* VIEW: NOTES */}
        {activeTab === "notes" && (
          <div className="p-4 space-y-6 animate-in fade-in duration-300">
            {/* Input Area */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase r ml-1">
                Nueva Nota
              </label>
              <div className="relative group">
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Escribe una observación interna sobre este contacto..."
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all min-h-[100px]scrollbar-thumb-zinc-700 border-2"
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {newNoteContent.length}/500
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim() || noteLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5 active:scale-95"
                >
                  {noteLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Guardar Nota
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-800 w-full" />

            {/* Notes List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold text-zinc-500 uppercase r">
                  Historial ({contact.notes.length})
                </h4>
              </div>

              {contact.notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
                  <div className="p-3 bg-zinc-900 rounded-full mb-3 border border-zinc-800">
                    <FileText className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-sm font-medium text-zinc-400">
                    No hay notas registradas
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Las notas son privadas para el equipo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contact.notes.map((note) => (
                    <div
                      key={note._id}
                      className={`group relative p-4 rounded-xl border transition-all duration-200 ${
                        note.isPinned
                          ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30"
                          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {/* Note Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold uppercase border ${
                              note.isPinned
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {note.createdBy.name[0]}
                          </div>
                          <div>
                            <span className="text-xs font-medium text-zinc-300 block leading-none">
                              {note.createdBy.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {formatRelativeTime(note.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Pinned Icon Indicator */}
                        {note.isPinned && (
                          <div className="p-1 bg-amber-500/10 rounded text-amber-500">
                            <PinIcon className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <p
                        className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          note.isPinned ? "text-amber-100/90" : "text-zinc-300"
                        }`}
                      >
                        {note.content}
                      </p>

                      {/* Hover Actions */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-zinc-900/80 backdrop-blur-sm rounded-lg p-0.5 border border-zinc-700/50 shadow-sm">
                        <button
                          onClick={() => handleDeleteNote(note._id)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                          title="Eliminar nota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      <FieldsManagerModal
        isOpen={showFieldsManager}
        onClose={() => setShowFieldsManager(false)}
        onFieldsChanged={loadData}
      />
    </div>
  );
}
