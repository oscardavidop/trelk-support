/**
 * QAPage — Quality Assurance & Coaching (Enterprise)
 * Tabs: Checklist Config | Analytics | Coaching Pendiente
 * Admin/Supervisor only
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, Plus, Trash2, GripVertical, Save, BarChart3,
  Users, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  XCircle, Settings2, ChevronDown, ChevronUp, Award, Target,
  RefreshCw, Minus, BookOpen, ExternalLink, MessageSquare, Clock
} from 'lucide-react';
import { useTranslation } from '../../node_modules/react-i18next';
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import * as qaService from '../services/qa.service';
import type {
  QACheckItem, QASettings, TeamAnalytics, AgentQAStats,
  QACheckCategory, QAReview, CoachingStatus, UnreviewedSession
} from '../services/qa.service';

// ═══════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════

const CATEGORIES: { value: QACheckCategory; label: string; color: string }[] = [
  { value: 'greeting', label: 'Saludo', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'resolution', label: 'Resolución', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'tone', label: 'Tono', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'procedure', label: 'Procedimiento', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'closing', label: 'Cierre', color: 'bg-pink-500/20 text-pink-400' },
  { value: 'general', label: 'General', color: 'bg-zinc-500/20 text-zinc-400' },
];

function categoryInfo(cat: string) {
  return CATEGORIES.find((c) => c.value === cat) || CATEGORIES[5];
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 90) return 'bg-emerald-500/20';
  if (score >= 70) return 'bg-blue-500/20';
  if (score >= 50) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

const coachingLabels: Record<CoachingStatus, { label: string; color: string }> = {
  none: { label: 'Sin coaching', color: 'text-zinc-500' },
  pending: { label: 'Pendiente', color: 'text-amber-400' },
  scheduled: { label: 'Programado', color: 'text-blue-400' },
  completed: { label: 'Completado', color: 'text-emerald-400' },
  dismissed: { label: 'Descartado', color: 'text-zinc-400' },
};

// ═══════════════════════════════════════════════════════════════════════
//  Tab: Checklist Config
// ═══════════════════════════════════════════════════════════════════════

function ChecklistTab() {
  const [items, setItems] = useState<QACheckItem[]>([]);
  const [settings, setSettings] = useState<QASettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', category: 'general' as QACheckCategory, weight: 10 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<QACheckItem>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsList, qaSettings] = await Promise.all([
        qaService.getAllChecklistItems(),
        qaService.getQASettings(),
      ]);
      setItems(itemsList);
      setSettings(qaSettings);
    } catch (err) {
      console.error('Failed to load QA config', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalWeight = items.filter((i) => i.isActive).reduce((s, i) => s + i.weight, 0);

  async function handleCreate() {
    if (!newItem.name.trim()) return;
    setSaving(true);
    try {
      await qaService.createChecklistItem({
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        category: newItem.category,
        weight: newItem.weight,
        order: items.length,
      });
      setNewItem({ name: '', description: '', category: 'general', weight: 10 });
      setShowAddForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item: QACheckItem) {
    await qaService.updateChecklistItem(item._id, { isActive: !item.isActive });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este ítem del checklist?')) return;
    await qaService.deleteChecklistItem(id);
    await load();
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await qaService.updateChecklistItem(editingId, editData);
      setEditingId(null);
      setEditData({});
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      await qaService.updateQASettings({
        lowScoreThreshold: settings.lowScoreThreshold,
        coachingEnabled: settings.coachingEnabled,
        autoFlagThreshold: settings.autoFlagThreshold,
        rollingWindowDays: settings.rollingWindowDays,
      });
    } finally {
      setSaving(false);
    }
  }

  async function moveItem(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const reordered = items.map((item, i) => {
      if (i === idx) return { id: item._id, order: next };
      if (i === next) return { id: item._id, order: idx };
      return { id: item._id, order: i };
    });
    await qaService.reorderChecklist(reordered);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weight Summary */}
      <div className="flex items-center gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
        <Target className="w-5 h-5 text-indigo-400" />
        <div className="flex-1">
          <span className="text-sm text-zinc-300">Peso total activos: </span>
          <span className={`font-bold ${totalWeight === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{totalWeight}%</span>
          {totalWeight !== 100 && (
            <span className="text-xs text-amber-400/70 ml-2">(se recomienda que sume 100%)</span>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar ítem
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-zinc-900/60 border border-indigo-500/30 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="Nombre del ítem"
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value as QACheckCategory })}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-50 focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Descripción (opcional)"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex items-center gap-4">
            <label className="text-sm text-zinc-400">Peso (%):</label>
            <input
              type="number"
              min={0}
              max={100}
              value={newItem.weight}
              onChange={(e) => setNewItem({ ...newItem, weight: Number(e.target.value) })}
              className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-50 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex-1" />
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-50 transition-colors">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !newItem.name.trim()} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-zinc-50 text-sm rounded-lg transition-colors">
              {saving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {items.map((item, idx) => {
          const cat = categoryInfo(item.category);
          const isEditing = editingId === item._id;

          return (
            <div
              key={item._id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                item.isActive
                  ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  : 'bg-zinc-900/30 border-zinc-800/50 opacity-60'
              }`}
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <GripVertical className="w-3.5 h-3.5 text-zinc-700" />
                <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Toggle active */}
              <button
                onClick={() => handleToggle(item)}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                  item.isActive ? 'bg-indigo-600 text-zinc-50' : 'bg-zinc-800 text-zinc-600 border border-zinc-700'
                }`}
              >
                {item.isActive && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editData.name ?? item.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-50 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editData.weight ?? item.weight}
                      onChange={(e) => setEditData({ ...editData, weight: Number(e.target.value) })}
                      className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-50 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-zinc-500">%</span>
                    <button onClick={handleSaveEdit} disabled={saving} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-xs rounded transition-colors">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingId(null); setEditData({}); }} className="px-2 py-1 text-zinc-400 hover:text-zinc-50 text-xs transition-colors">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => { setEditingId(item._id); setEditData({ name: item.name, weight: item.weight }); }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-50 font-medium">{item.name}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${cat.color}`}>{cat.label}</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.description}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Weight badge */}
              {!isEditing && (
                <span className="text-sm font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{item.weight}%</span>
              )}

              {/* Delete */}
              <button onClick={() => handleDelete(item._id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay ítems en el checklist. Agrega el primero.</p>
          </div>
        )}
      </div>

      {/* QA Settings */}
      {settings && (
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Configuración General QA</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Umbral bajo (requiere comentario)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.lowScoreThreshold}
                  onChange={(e) => setSettings({ ...settings, lowScoreThreshold: Number(e.target.value) })}
                  className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-50 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-zinc-500">% — debajo de este score se requiere comentario</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Auto-flag coaching</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.autoFlagThreshold}
                  onChange={(e) => setSettings({ ...settings, autoFlagThreshold: Number(e.target.value) })}
                  className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-50 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-zinc-500">% — promedio menor a este valor activa coaching automático</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Ventana rolling (días)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={settings.rollingWindowDays}
                onChange={(e) => setSettings({ ...settings, rollingWindowDays: Number(e.target.value) })}
                className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-50 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-500">Coaching habilitado:</label>
              <button
                onClick={() => setSettings({ ...settings, coachingEnabled: !settings.coachingEnabled })}
                className={`w-10 h-5 rounded-full transition-colors relative ${settings.coachingEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.coachingEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-zinc-50 text-sm rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" /> Guardar configuración
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Tab: Analytics
// ═══════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [data, setData] = useState<TeamAnalytics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const analytics = await qaService.getTeamAnalytics(days);
      setData(analytics);
    } catch (err) {
      console.error('Failed to load QA analytics', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-zinc-500">No hay datos de analytics disponibles.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400">Período:</span>
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              days === d ? 'bg-indigo-600 text-zinc-50' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-50'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-zinc-500">Promedio Global</span>
          </div>
          <span className={`text-2xl font-bold ${scoreColor(data.globalAvg)}`}>{data.globalAvg}%</span>
        </div>
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-zinc-500">Evaluaciones</span>
          </div>
          <span className="text-2xl font-bold text-zinc-50">{data.totalReviews}</span>
        </div>
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-zinc-500">Agentes evaluados</span>
          </div>
          <span className="text-2xl font-bold text-zinc-50">{data.agents.length}</span>
        </div>
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-500">Top Score</span>
          </div>
          <span className={`text-2xl font-bold ${scoreColor(data.agents[0]?.avgScore || 0)}`}>
            {data.agents[0]?.avgScore || 0}%
          </span>
        </div>
      </div>

      {/* Score distribution */}
      {data.scoreBrackets.length > 0 && (
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">Distribución de Scores</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={data.scoreBrackets.map(b => ({ name: b.bracket, count: b.count }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                        <p className="text-xs text-zinc-400">{label}</p>
                        <p className="text-sm font-bold text-zinc-50">{payload[0].value} evaluaciones</p>
                      </div>
                    );
                  }}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {data.scoreBrackets.map((b, i) => {
                    const bracketColor = b.bracket.startsWith('90') ? '#10b981' : b.bracket.startsWith('70') ? '#3b82f6' : b.bracket.startsWith('50') ? '#f59e0b' : '#ef4444';
                    return <Cell key={i} fill={bracketColor} fillOpacity={0.7} />;
                  })}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agent Leaderboard */}
      <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Ranking de Agentes</h3>
        <div className="space-y-2">
          {data.agents.map((agent, idx) => (
            <div key={agent.agentId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                'bg-zinc-800 text-zinc-500'
              }`}>
                {idx + 1}
              </span>
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-50 font-medium overflow-hidden">
                {agent.agentAvatar ? (
                  <img src={agent.agentAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  agent.agentName?.charAt(0)?.toUpperCase()
                )}
              </div>
              <span className="flex-1 text-sm text-zinc-200 truncate">{agent.agentName}</span>
              <span className="text-xs text-zinc-500">{agent.reviewCount} reviews</span>
              <span className={`text-sm font-bold px-2 py-0.5 rounded ${scoreBg(agent.avgScore)} ${scoreColor(agent.avgScore)}`}>
                {agent.avgScore}%
              </span>
              {agent.pendingCoaching > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                  {agent.pendingCoaching} coaching
                </span>
              )}
            </div>
          ))}
          {data.agents.length === 0 && (
            <p className="text-center text-sm text-zinc-500 py-4">No hay evaluaciones en este período.</p>
          )}
        </div>
      </div>

      {/* Most failed checks */}
      {data.mostFailedChecks.length > 0 && (
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Checks con Mayor Falla
          </h3>
          <div className="space-y-2">
            {data.mostFailedChecks.map((c) => (
              <div key={c.checkName} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300">{c.checkName}</span>
                    <span className="text-xs text-zinc-600">({c.count} fallas)</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-1">
                    <div
                      className="h-full bg-red-500/60 rounded-full transition-all"
                      style={{ width: `${c.failRate}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-red-400">{c.failRate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Tab: Coaching Pendiente
// ═══════════════════════════════════════════════════════════════════════

function CoachingTab() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<QAReview[]>([]);
  const [total, setTotal] = useState(0);
  const [unreviewed, setUnreviewed] = useState<UnreviewedSession[]>([]);
  const [unreviewedTotal, setUnreviewedTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [coachingResult, unreviewedResult] = await Promise.all([
        qaService.getPendingCoaching({ limit: 50 }),
        qaService.getUnreviewedSessions({ limit: 30, days: 7 }),
      ]);
      setReviews(coachingResult.reviews);
      setTotal(coachingResult.total);
      setUnreviewed(unreviewedResult.sessions);
      setUnreviewedTotal(unreviewedResult.total);
    } catch (err) {
      console.error('Failed to load coaching data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCoachingAction(reviewId: string, coaching: CoachingStatus, notes?: string) {
    await qaService.updateCoachingStatus(reviewId, { coaching, coachingNotes: notes });
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Unreviewed Sessions (pending QA evaluation) ── */}
      {unreviewedTotal > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{unreviewedTotal} sesiones cerradas sin evaluar</span>
            <span className="text-zinc-500 text-xs">(últimos 7 días)</span>
          </div>

          {unreviewed.map((session) => {
            const agent = session.assignedAgent;
            return (
              <div key={session._id} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-medium overflow-hidden">
                    {agent?.avatar ? (
                      <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      agent?.name?.charAt(0)?.toUpperCase() || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-50 font-medium">{agent?.name || 'Agente'}</span>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{session.sessionId.slice(0, 12)}…</span>
                      <span>•</span>
                      <span>{session.channel}</span>
                      <span>•</span>
                      <span>Cerrado: {new Date(session.closedAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 rounded-lg font-medium uppercase">
                    Sin evaluar
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => navigate(`/chat?session=${session.sessionId}`)}
                    className="px-3 py-1 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" /> Ver chat y evaluar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Section 2: Coaching Pending (already reviewed, low score) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <BookOpen className="w-4 h-4" />
          <span>{total} sesiones pendientes de coaching</span>
        </div>

        {reviews.map((review) => {
          const agent = typeof review.agentId === 'object' ? review.agentId : null;
          const reviewer = typeof review.reviewedBy === 'object' ? review.reviewedBy : null;

          return (
            <div key={review._id} className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-50 font-medium overflow-hidden">
                  {agent?.avatar ? (
                    <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    agent?.name?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-zinc-50 font-medium">{agent?.name || 'Agente'}</span>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>Sesión: {review.sessionId.slice(0, 8)}…</span>
                    <span>•</span>
                    <span>Evaluado por: {reviewer?.name || '—'}</span>
                    <span>•</span>
                    <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`text-lg font-bold px-3 py-1 rounded-lg ${scoreBg(review.totalScore)} ${scoreColor(review.totalScore)}`}>
                  {review.totalScore}%
                </span>
              </div>

              {review.comment && (
                <p className="text-xs text-zinc-400 bg-zinc-800/50 p-2 rounded">{review.comment}</p>
              )}

              {/* Coaching action buttons */}
              <div className="flex items-center gap-2">
                <span className={`text-xs ${coachingLabels[review.coaching]?.color || 'text-zinc-500'}`}>
                  Estado: {coachingLabels[review.coaching]?.label || review.coaching}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => navigate(`/chat?session=${review.sessionId}`)}
                  className="px-3 py-1 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Ir a sesión
                </button>
                {review.coaching === 'pending' && (
                  <>
                    <button
                      onClick={() => handleCoachingAction(review._id, 'scheduled')}
                      className="px-3 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors"
                    >
                      Programar
                    </button>
                    <button
                      onClick={() => handleCoachingAction(review._id, 'dismissed')}
                      className="px-3 py-1 text-xs bg-zinc-700/50 text-zinc-400 hover:text-zinc-50 rounded-lg transition-colors"
                    >
                      Descartar
                    </button>
                  </>
                )}
                {review.coaching === 'scheduled' && (
                  <button
                    onClick={() => handleCoachingAction(review._id, 'completed')}
                    className="px-3 py-1 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg transition-colors"
                  >
                    Marcar completado
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {reviews.length === 0 && unreviewedTotal === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay sesiones pendientes de coaching. ¡Excelente!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════════════

type QATab = 'checklist' | 'analytics' | 'coaching';

export default function QAPage() {
  const [activeTab, setActiveTab] = useState<QATab>('checklist');
  const { t } = useTranslation();

  const tabs: { id: QATab; label: string; icon: React.ReactNode }[] = [
    { id: 'checklist', label: 'Checklist QA', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'coaching', label: 'Coaching', icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-indigo-500/30">
      {/* Indigo Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-indigo-900/10">
                <ClipboardCheck className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">QA & Coaching</h1>
                <p className="text-sm text-zinc-400">Control de calidad y retroalimentación de agentes</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-zinc-50 shadow-lg shadow-indigo-500/20'
                    : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 pb-8 pt-2">
          {activeTab === 'checklist' && <ChecklistTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'coaching' && <CoachingTab />}
        </div>
      </div>
    </div>
  );
}
