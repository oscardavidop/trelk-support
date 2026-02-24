/**
 * TranslationSettingsPage — Admin page for configuring the translation system
 * Manage providers, mode (free/API), rules, cache, rate limits, view logs & stats
 */

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
    Languages, Save, Loader2, Settings2, Shield, BarChart3,
    Globe, Key, ToggleLeft, ToggleRight, RefreshCcw, AlertTriangle,
    Check, ArrowUpDown, FileText, Clock, Zap, ChevronDown,
    Network, Lock, Wifi, WifiOff, Play, ArrowRightLeft, Send,
    Flag, Eye, DollarSign, Search, Filter, ChevronLeft, ChevronRight,
    Ban, CheckCircle, XCircle, MessageSquare, TrendingUp, Activity
} from 'lucide-react';
import {
    getTranslationSettings,
    updateTranslationSettings,
    getTranslationLogs,
    getTranslationStats,
    testProxy,
    getTranslationReports as fetchReports,
    updateTranslationReport,
    getReportStats as fetchReportStats,
    blockReporter,
    unblockReporter,
    getCostDashboard,
    getQAMessages,
    type TranslationSettings,
    type TranslationLogEntry,
    type TranslationStats,
    type TranslationMode,
    type ProviderConfig,
    type ProxyConfig,
    type ProxyProtocol,
    type OutgoingDeliveryMode,
    type TargetLangStrategy,
    type TranslationReportEntry,
    type ReportStats,
    type ReportStatus,
    type ReportCategory,
    type CostDashboardData,
    type QAMessage,
} from '../services/translation.service';

// ─── TABS ───────────────────────────────────────────────────

type SettingsTab = 'general' | 'providers' | 'logs' | 'stats' | 'reports' | 'cost' | 'qa';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'providers', label: 'Proveedores', icon: <Globe className="w-4 h-4" /> },
    { id: 'reports', label: 'Reportes', icon: <Flag className="w-4 h-4" /> },
    { id: 'cost', label: 'Costos', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'qa', label: 'QA Review', icon: <Eye className="w-4 h-4" /> },
    { id: 'logs', label: 'Logs', icon: <FileText className="w-4 h-4" /> },
    { id: 'stats', label: 'Estadísticas', icon: <BarChart3 className="w-4 h-4" /> },
];

// ─── MAIN COMPONENT ─────────────────────────────────────────

export default function TranslationSettingsPage() {
    const [tab, setTab] = useState<SettingsTab>('general');
    const [settings, setSettings] = useState<TranslationSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [proxyTesting, setProxyTesting] = useState(false);
    const [proxyTestResult, setProxyTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);

    // Logs & stats state
    const [logs, setLogs] = useState<TranslationLogEntry[]>([]);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotal, setLogsTotal] = useState(0);
    const [logsLoading, setLogsLoading] = useState(false);
    const [stats, setStats] = useState<TranslationStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Reports state
    const [reports, setReports] = useState<TranslationReportEntry[]>([]);
    const [reportsPage, setReportsPage] = useState(1);
    const [reportsTotal, setReportsTotal] = useState(0);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportStats, setReportStats] = useState<ReportStats | null>(null);
    const [reportsFilter, setReportsFilter] = useState<{ status?: ReportStatus; category?: ReportCategory }>({});

    // Cost dashboard state
    const [costData, setCostData] = useState<CostDashboardData | null>(null);
    const [costLoading, setCostLoading] = useState(false);
    const [costDays, setCostDays] = useState(30);

    // QA Review state
    const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
    const [qaPage, setQaPage] = useState(1);
    const [qaTotal, setQaTotal] = useState(0);
    const [qaLoading, setQaLoading] = useState(false);
    const [qaDirection, setQaDirection] = useState<'incoming' | 'outgoing' | undefined>(undefined);
    const [qaEditedOnly, setQaEditedOnly] = useState(false);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTranslationSettings();
            setSettings(data);
        } catch (err: any) {
            setError(err.message || 'Error loading settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    // Load logs when tab switches to logs
    useEffect(() => {
        if (tab === 'logs') loadLogs(1);
        if (tab === 'stats') loadStats();
        if (tab === 'reports') { loadReports(1); loadReportStats(); }
        if (tab === 'cost') loadCostData();
        if (tab === 'qa') loadQA(1);
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadLogs = async (page: number) => {
        setLogsLoading(true);
        try {
            const res = await getTranslationLogs({ page, limit: 20 });
            setLogs(res.logs);
            setLogsPage(res.page);
            setLogsTotal(res.total);
        } catch { /* silent */ } finally {
            setLogsLoading(false);
        }
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const res = await getTranslationStats(30);
            setStats(res);
        } catch { /* silent */ } finally {
            setStatsLoading(false);
        }
    };

    const loadReports = async (page: number) => {
        setReportsLoading(true);
        try {
            const res = await fetchReports({ ...reportsFilter, page, limit: 15 });
            setReports(res.reports);
            setReportsPage(res.page);
            setReportsTotal(res.total);
        } catch { /* silent */ } finally {
            setReportsLoading(false);
        }
    };

    const loadReportStats = async () => {
        try {
            const s = await fetchReportStats();
            setReportStats(s);
        } catch { /* silent */ }
    };

    const loadCostData = async () => {
        setCostLoading(true);
        try {
            const data = await getCostDashboard(costDays);
            setCostData(data);
        } catch { /* silent */ } finally {
            setCostLoading(false);
        }
    };

    const loadQA = async (page: number) => {
        setQaLoading(true);
        try {
            const res = await getQAMessages({ direction: qaDirection, edited: qaEditedOnly, page, limit: 20 });
            setQaMessages(res.messages);
            setQaPage(res.page);
            setQaTotal(res.total);
        } catch { /* silent */ } finally {
            setQaLoading(false);
        }
    };

    const handleReportAction = async (reportId: string, status: ReportStatus, reviewNote?: string) => {
        try {
            await updateTranslationReport(reportId, { status, reviewNote });
            loadReports(reportsPage);
            loadReportStats();
        } catch { /* silent */ }
    };

    const handleBlockReporter = async (agentId: string) => {
        try {
            await blockReporter(agentId);
            loadReports(reportsPage);
        } catch { /* silent */ }
    };

    const handleUnblockReporter = async (agentId: string) => {
        try {
            await unblockReporter(agentId);
            loadReports(reportsPage);
        } catch { /* silent */ }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await updateTranslationSettings(settings);
            setSettings(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err: any) {
            setError(err.message || 'Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    const updateField = <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => {
        setSettings(prev => prev ? { ...prev, [key]: value } : prev);
    };

    const updateProvider = (index: number, field: keyof ProviderConfig, value: unknown) => {
        if (!settings) return;
        const providers = [...settings.providers];
        (providers[index] as any)[field] = value;
        updateField('providers', providers);
    };

    const updateProxy = (field: keyof ProxyConfig, value: unknown) => {
        if (!settings) return;
        const proxy = { ...settings.proxy, [field]: value };
        updateField('proxy', proxy as ProxyConfig);
    };

    const handleTestProxy = async () => {
        if (!settings?.proxy) return;
        setProxyTesting(true);
        setProxyTestResult(null);
        try {
            const res = await testProxy(settings.proxy);
            setProxyTestResult(res);
        } catch (err: any) {
            setProxyTestResult({ success: false, error: err.message || 'Test failed' });
        } finally {
            setProxyTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-6 text-red-400">
                <AlertTriangle className="w-6 h-6 mb-2" />
                <p>No se pudieron cargar las configuraciones.</p>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-indigo-500/30">
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                {/* Header */}
                <div className="px-8 py-6 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-indigo-900/10">
                                <Languages className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Sistema de Traducción</h1>
                                <p className="text-sm text-zinc-400">Configura proveedores, modo y preferencias</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchSettings}
                                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-sm font-medium transition-all"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Actualizar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${saved
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10'
                                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/20'
                                } disabled:opacity-50`}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit">
                        {TABS.map((t, i) => (
                            <Fragment key={t.id}>
                                {i > 0 && <div className="h-4 w-px bg-white/10" />}
                                <button
                                    onClick={() => setTab(t.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id
                                        ? 'bg-white/10 text-zinc-50 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-200'
                                    }`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            </Fragment>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
                    <div className="max-w-5xl">

                {/* === GENERAL TAB === */}
                {tab === 'general' && (
                    <div className="space-y-6">
                        {/* Mode Selector */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-400" /> Modo de Traducción
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <ModeCard
                                    title="Free Mode"
                                    description="Sin clave API. Usa Google Translate gratuito. Ideal para testing y uso básico."
                                    isActive={settings.mode === 'free'}
                                    onClick={() => updateField('mode', 'free')}
                                    badge="Sin costo"
                                    badgeColor="emerald"
                                />
                                <ModeCard
                                    title="API Mode"
                                    description="Usa proveedores con clave API. Mayor calidad y fiabilidad para producción."
                                    isActive={settings.mode === 'api'}
                                    onClick={() => updateField('mode', 'api')}
                                    badge="Enterprise"
                                    badgeColor="indigo"
                                />
                            </div>
                        </div>

                        {/* Default Languages */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-indigo-400" /> Idiomas por Defecto
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1.5">Idioma origen</label>
                                    <select
                                        value={settings.defaultSourceLang}
                                        onChange={e => updateField('defaultSourceLang', e.target.value)}
                                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="auto">Auto-detectar</option>
                                        <option value="es">Español</option>
                                        <option value="en">English</option>
                                        <option value="pt">Português</option>
                                        <option value="fr">Français</option>
                                        <option value="de">Deutsch</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1.5">Idioma destino</label>
                                    <select
                                        value={settings.defaultTargetLang}
                                        onChange={e => updateField('defaultTargetLang', e.target.value)}
                                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="es">Español</option>
                                        <option value="en">English</option>
                                        <option value="pt">Português</option>
                                        <option value="fr">Français</option>
                                        <option value="de">Deutsch</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-400" /> Opciones
                            </h3>

                            <ToggleRow
                                label="Auto-detectar idioma"
                                description="Detecta automáticamente el idioma del texto fuente"
                                checked={settings.enableAutoDetect}
                                onChange={v => updateField('enableAutoDetect', v)}
                            />
                            <ToggleRow
                                label="Registro de auditoría"
                                description="Guarda un log de cada traducción realizada"
                                checked={settings.enableAuditLog}
                                onChange={v => updateField('enableAuditLog', v)}
                            />
                            <ToggleRow
                                label="Bloquear idioma origen"
                                description="Los agentes no podrán cambiar el idioma de origen en el compositor"
                                checked={settings.lockSourceLang}
                                onChange={v => updateField('lockSourceLang', v)}
                            />
                            <ToggleRow
                                label="Bloquear idioma destino"
                                description="Los agentes no podrán cambiar el idioma de destino en el compositor"
                                checked={settings.lockTargetLang}
                                onChange={v => updateField('lockTargetLang', v)}
                            />

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1.5">Cache TTL (segundos)</label>
                                    <input
                                        type="number"
                                        value={settings.cacheTTLSeconds}
                                        onChange={e => updateField('cacheTTLSeconds', parseInt(e.target.value) || 3600)}
                                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1.5">Rate limit (por minuto)</label>
                                    <input
                                        type="number"
                                        value={settings.rateLimitPerMinute}
                                        onChange={e => updateField('rateLimitPerMinute', parseInt(e.target.value) || 60)}
                                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-zinc-500 mb-1.5">Longitud máxima de texto</label>
                                <input
                                    type="number"
                                    value={settings.maxTextLength}
                                    onChange={e => updateField('maxTextLength', parseInt(e.target.value) || 5000)}
                                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none max-w-xs"
                                />
                            </div>
                        </div>

                        {/* ─── PROXY ENTERPRISE ─── */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                                    <Network className="w-4 h-4 text-cyan-400" /> Proxy Enterprise
                                </h3>
                                <button
                                    onClick={() => updateProxy('enabled', !settings.proxy?.enabled)}
                                    className={`p-1 rounded-lg transition-colors ${settings.proxy?.enabled ? 'text-emerald-400' : 'text-zinc-600'}`}
                                >
                                    {settings.proxy?.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                </button>
                            </div>

                            {settings.proxy?.enabled && (
                                <div className="space-y-4 pt-2">
                                    {/* Protocol */}
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-1.5">Protocolo</label>
                                        <div className="flex gap-2">
                                            {(['http', 'https', 'socks5'] as ProxyProtocol[]).map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => updateProxy('protocol', p)}
                                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                                                        settings.proxy?.protocol === p
                                                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                                                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Host + Port */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-xs text-zinc-500 mb-1.5">Host</label>
                                            <input
                                                type="text"
                                                value={settings.proxy?.host || ''}
                                                onChange={e => updateProxy('host', e.target.value)}
                                                placeholder="proxy.mycompany.com"
                                                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1.5">Puerto</label>
                                            <input
                                                type="number"
                                                value={settings.proxy?.port || ''}
                                                onChange={e => updateProxy('port', parseInt(e.target.value) || 0)}
                                                placeholder="8080"
                                                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Auth */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1.5">Usuario (opcional)</label>
                                            <input
                                                type="text"
                                                value={settings.proxy?.username || ''}
                                                onChange={e => updateProxy('username', e.target.value)}
                                                placeholder="user"
                                                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1.5">Contraseña (opcional)</label>
                                            <input
                                                type="password"
                                                value={settings.proxy?.password || ''}
                                                onChange={e => updateProxy('password', e.target.value)}
                                                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Timeout */}
                                    <div className="max-w-xs">
                                        <label className="block text-xs text-zinc-500 mb-1.5">Timeout (ms)</label>
                                        <input
                                            type="number"
                                            value={settings.proxy?.timeoutMs || 10000}
                                            onChange={e => updateProxy('timeoutMs', parseInt(e.target.value) || 10000)}
                                            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                                        />
                                    </div>

                                    {/* Toggles */}
                                    <ToggleRow
                                        label="Solo tráfico externo"
                                        description="No usar proxy para el proveedor Free (localhost)"
                                        checked={settings.proxy?.externalOnly ?? true}
                                        onChange={v => updateProxy('externalOnly', v)}
                                    />
                                    <ToggleRow
                                        label="Fallback directo"
                                        description="Si el proxy falla, intentar conexión directa"
                                        checked={settings.proxy?.allowDirectFallback ?? true}
                                        onChange={v => updateProxy('allowDirectFallback', v)}
                                    />

                                    {/* Test Button */}
                                    <div className="pt-2 flex items-center gap-3">
                                        <button
                                            onClick={handleTestProxy}
                                            disabled={proxyTesting || !settings.proxy?.host || !settings.proxy?.port}
                                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl text-sm font-bold transition-all"
                                        >
                                            {proxyTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                            {proxyTesting ? 'Probando…' : 'Probar Proxy'}
                                        </button>

                                        {proxyTestResult && (
                                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${
                                                proxyTestResult.success
                                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                            }`}>
                                                {proxyTestResult.success ? (
                                                    <>
                                                        <Wifi className="w-4 h-4" />
                                                        Conectado — {proxyTestResult.latencyMs}ms
                                                    </>
                                                ) : (
                                                    <>
                                                        <WifiOff className="w-4 h-4" />
                                                        {proxyTestResult.error || 'Error'}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!settings.proxy?.enabled && (
                                <p className="text-xs text-zinc-600">
                                    Habilita el proxy para dirigir las peticiones de traducción a través de un servidor intermedio (HTTP/HTTPS/SOCKS5).
                                </p>
                            )}
                        </div>

                        {/* ─── OUTGOING AUTO-TRANSLATE ─── */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                                    <Send className="w-4 h-4 text-indigo-400" /> Auto-Translate Outgoing Replies
                                </h3>
                                <button
                                    onClick={() => {
                                        const out = settings.outgoing || { enabled: false, deliveryMode: 'translated_only', showPreviewBeforeSend: true, targetLangPriority: ['user_detected','custom_field','session_lang','fallback'], fallbackLang: 'en', protectPlaceholders: true, agentOverrideAllowed: true };
                                        updateField('outgoing', { ...out, enabled: !out.enabled });
                                    }}
                                    className={`p-1 rounded-lg transition-colors ${settings.outgoing?.enabled ? 'text-emerald-400' : 'text-zinc-600'}`}
                                >
                                    {settings.outgoing?.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                </button>
                            </div>

                            {settings.outgoing?.enabled ? (
                                <div className="space-y-4 pt-2">
                                    <ToggleRow
                                        label="Mostrar preview antes de enviar"
                                        description="El agente verá la traducción antes de confirmar el envío"
                                        checked={settings.outgoing.showPreviewBeforeSend ?? true}
                                        onChange={v => updateField('outgoing', { ...settings.outgoing, showPreviewBeforeSend: v })}
                                    />
                                    <ToggleRow
                                        label="Proteger variables {{...}}"
                                        description="Variables y placeholders se preservan durante la traducción"
                                        checked={settings.outgoing.protectPlaceholders ?? true}
                                        onChange={v => updateField('outgoing', { ...settings.outgoing, protectPlaceholders: v })}
                                    />
                                    <ToggleRow
                                        label="Agentes pueden desactivar por chat"
                                        description="Permite a los agentes activar/desactivar traducción por sesión individual"
                                        checked={settings.outgoing.agentOverrideAllowed ?? true}
                                        onChange={v => updateField('outgoing', { ...settings.outgoing, agentOverrideAllowed: v })}
                                    />

                                    {/* Delivery Mode */}
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-2">Modo de envío</label>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => updateField('outgoing', { ...settings.outgoing, deliveryMode: 'translated_only' })}
                                                className={`flex-1 p-3 rounded-xl text-left border transition-all ${
                                                    settings.outgoing.deliveryMode === 'translated_only'
                                                        ? 'border-indigo-500/30 bg-indigo-500/5 text-zinc-200'
                                                        : 'border-zinc-700 bg-zinc-800/30 text-zinc-500 hover:text-zinc-300'
                                                }`}
                                            >
                                                <div className="text-xs font-bold">Solo traducido</div>
                                                <div className="text-[10px] text-zinc-600 mt-0.5">El usuario recibe solo la traducción</div>
                                            </button>
                                            <button
                                                onClick={() => updateField('outgoing', { ...settings.outgoing, deliveryMode: 'both' })}
                                                className={`flex-1 p-3 rounded-xl text-left border transition-all ${
                                                    settings.outgoing.deliveryMode === 'both'
                                                        ? 'border-indigo-500/30 bg-indigo-500/5 text-zinc-200'
                                                        : 'border-zinc-700 bg-zinc-800/30 text-zinc-500 hover:text-zinc-300'
                                                }`}
                                            >
                                                <div className="text-xs font-bold">Original + Traducido</div>
                                                <div className="text-[10px] text-zinc-600 mt-0.5">Se envían ambos mensajes juntos</div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Fallback language */}
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-1.5">Idioma fallback (si no se detecta idioma del usuario)</label>
                                        <select
                                            value={settings.outgoing.fallbackLang || 'en'}
                                            onChange={e => updateField('outgoing', { ...settings.outgoing, fallbackLang: e.target.value })}
                                            className="w-full max-w-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="en">English</option>
                                            <option value="es">Español</option>
                                            <option value="pt">Português</option>
                                            <option value="fr">Français</option>
                                            <option value="de">Deutsch</option>
                                            <option value="it">Italiano</option>
                                            <option value="ru">Русский</option>
                                            <option value="zh">中文</option>
                                            <option value="ar">العربية</option>
                                            <option value="ja">日本語</option>
                                        </select>
                                    </div>

                                    {/* Target language priority */}
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-2">Prioridad de resolución de idioma destino</label>
                                        <div className="space-y-1">
                                            {(settings.outgoing.targetLangPriority || ['user_detected','custom_field','session_lang','fallback']).map((s, i) => (
                                                <div key={s} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-lg text-xs">
                                                    <span className="text-zinc-600 font-mono w-4">{i + 1}.</span>
                                                    <span className="text-zinc-300 font-medium">
                                                        {s === 'user_detected' ? 'Idioma detectado del usuario' :
                                                         s === 'custom_field' ? 'Campo personalizado (lang)' :
                                                         s === 'session_lang' ? 'Idioma de la sesión' :
                                                         'Fallback global'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Outgoing Anti-abuse */}
                                    <div className="border-t border-zinc-800/50 pt-4 mt-2">
                                        <h4 className="text-xs font-bold text-amber-400/80 mb-3 flex items-center gap-1.5">
                                            <Shield className="w-3.5 h-3.5" /> Anti-abuso saliente
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] text-zinc-500 mb-1">Máx. traducciones/min por agente</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={120}
                                                    value={(settings.outgoing as any)?.maxTranslationsPerMinAgent || 60}
                                                    onChange={e => updateField('outgoing', {
                                                        ...settings.outgoing,
                                                        ...(({ maxTranslationsPerMinAgent: parseInt(e.target.value) || 60 }) as any),
                                                    })}
                                                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:border-amber-500/50 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] text-zinc-500 mb-1">Cooldown entre previews (ms)</label>
                                                <input
                                                    type="number"
                                                    min={200}
                                                    max={5000}
                                                    step={100}
                                                    value={(settings.outgoing as any)?.previewCooldownMs || 800}
                                                    onChange={e => updateField('outgoing', {
                                                        ...settings.outgoing,
                                                        ...(({ previewCooldownMs: parseInt(e.target.value) || 800 }) as any),
                                                    })}
                                                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:border-amber-500/50 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-600">
                                    Habilita la traducción automática para que los mensajes del agente se traduzcan antes de enviarse al usuario.
                                </p>
                            )}
                        </div>

                        {/* ─── INCOMING AUTO-TRANSLATE ─── */}
                        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                                    <ArrowRightLeft className="w-4 h-4 text-cyan-400" /> Auto-Translate Incoming Messages
                                </h3>
                                <button
                                    onClick={() => updateField('incoming', {
                                        ...settings.incoming,
                                        enabled: !settings.incoming?.enabled,
                                    })}
                                    className={`p-1 rounded-lg transition-colors ${settings.incoming?.enabled ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                                >
                                    {settings.incoming?.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                </button>
                            </div>
                            <p className="text-xs text-zinc-500 mb-5">
                                Traduce automáticamente los mensajes entrantes del usuario al idioma del agente. El mensaje original siempre se preserva.
                            </p>

                            {settings.incoming?.enabled && (
                                <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                                    {/* Target Language Mode */}
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-2 font-bold">Idioma destino</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {([
                                                { id: 'agent_lang', label: 'Idioma del agente', desc: 'Según preferencias del agente' },
                                                { id: 'system_lang', label: 'Idioma del sistema', desc: 'Usa el idioma configurado abajo' },
                                                { id: 'custom', label: 'Personalizado', desc: 'Idioma fijo para todos' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => updateField('incoming', {
                                                        ...settings.incoming,
                                                        targetLangMode: opt.id,
                                                    })}
                                                    className={`p-3 rounded-xl border text-left transition-all ${
                                                        (settings.incoming as any)?.targetLangMode === opt.id
                                                            ? 'bg-cyan-600/10 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/20'
                                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold">{opt.label}</div>
                                                    <div className="text-[10px] text-zinc-600 mt-0.5">{opt.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Target Language Selector (when system_lang or custom) */}
                                    {((settings.incoming as any)?.targetLangMode !== 'agent_lang') && (
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1.5 font-bold">Idioma destino por defecto</label>
                                            <select
                                                value={settings.incoming?.targetLang || 'es'}
                                                onChange={e => updateField('incoming', {
                                                    ...settings.incoming,
                                                    targetLang: e.target.value,
                                                })}
                                                className="w-full max-w-xs bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                                            >
                                                <option value="es">Español</option>
                                                <option value="en">English</option>
                                                <option value="pt">Português</option>
                                                <option value="fr">Français</option>
                                                <option value="de">Deutsch</option>
                                                <option value="it">Italiano</option>
                                                <option value="ru">Русский</option>
                                                <option value="zh">中文</option>
                                                <option value="ar">العربية</option>
                                                <option value="ja">日本語</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Channel Scope */}
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-2 font-bold">Canales</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {([
                                                { id: 'all', label: 'Todos', desc: 'Web + Telegram + otros' },
                                                { id: 'web_only', label: 'Solo LiveChat', desc: 'Solo mensajes del widget web' },
                                                { id: 'telegram_only', label: 'Solo Telegram', desc: 'Solo mensajes de Telegram' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => updateField('incoming', {
                                                        ...settings.incoming,
                                                        channelScope: opt.id,
                                                    })}
                                                    className={`p-3 rounded-xl border text-left transition-all ${
                                                        (settings.incoming as any)?.channelScope === opt.id
                                                            ? 'bg-cyan-600/10 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/20'
                                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold">{opt.label}</div>
                                                    <div className="text-[10px] text-zinc-600 mt-0.5">{opt.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Toggle options */}
                                    <div className="space-y-1">
                                        <ToggleRow
                                            label="Mostrar siempre original + traducción"
                                            description="El agente verá el mensaje original junto a la traducción"
                                            checked={settings.incoming?.showOriginal ?? true}
                                            onChange={() => updateField('incoming', {
                                                ...settings.incoming,
                                                showOriginal: !(settings.incoming?.showOriginal ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Solo traducir si idioma ≠ destino"
                                            description="Evita traducciones innecesarias cuando el idioma coincide"
                                            checked={(settings.incoming as any)?.onlyIfDifferent ?? true}
                                            onChange={() => updateField('incoming', {
                                                ...settings.incoming,
                                                onlyIfDifferent: !((settings.incoming as any)?.onlyIfDifferent ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Saltar comandos (/start, /help…)"
                                            description="No traducir mensajes que empiezan con /"
                                            checked={(settings.incoming as any)?.skipCommands ?? true}
                                            onChange={() => updateField('incoming', {
                                                ...settings.incoming,
                                                skipCommands: !((settings.incoming as any)?.skipCommands ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Saltar mensajes cortos (<3 chars)"
                                            description="Ignora mensajes muy cortos como 'ok', 'si'"
                                            checked={(settings.incoming as any)?.skipShortMessages ?? true}
                                            onChange={() => updateField('incoming', {
                                                ...settings.incoming,
                                                skipShortMessages: !((settings.incoming as any)?.skipShortMessages ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Saltar mensajes solo emoji"
                                            description="No traducir mensajes que solo contienen emojis"
                                            checked={(settings.incoming as any)?.skipEmojiOnly ?? true}
                                            onChange={() => updateField('incoming', {
                                                ...settings.incoming,
                                                skipEmojiOnly: !((settings.incoming as any)?.skipEmojiOnly ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Permitir override por agente"
                                            description="Cada agente puede activar/desactivar para sus chats"
                                            checked={(settings.incoming as any)?.agentOverrideAllowed ?? true}
                                            onChange={() => updateField('incoming', {
                                                ...settings.incoming,
                                                agentOverrideAllowed: !((settings.incoming as any)?.agentOverrideAllowed ?? true),
                                            })}
                                        />
                                    </div>

                                    {/* Throttle slider */}
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-1.5 font-bold">
                                            Anti-flood: {((settings.incoming as any)?.throttleMs || 1000) / 1000}s entre traducciones por chat
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="5000"
                                            step="500"
                                            value={(settings.incoming as any)?.throttleMs || 1000}
                                            onChange={e => updateField('incoming', {
                                                ...settings.incoming,
                                                throttleMs: parseInt(e.target.value),
                                            })}
                                            className="w-full max-w-xs h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        />
                                    </div>

                                    {/* Anti-abuse section */}
                                    <div className="border-t border-zinc-800/50 pt-4 mt-2">
                                        <h4 className="text-xs font-bold text-amber-400/80 mb-3 flex items-center gap-1.5">
                                            <Shield className="w-3.5 h-3.5" /> Anti-abuso
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] text-zinc-500 mb-1">Máx. traducciones/min por chat</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={120}
                                                    value={(settings.incoming as any)?.maxTranslationsPerMinute || 30}
                                                    onChange={e => updateField('incoming', {
                                                        ...settings.incoming,
                                                        ...(({ maxTranslationsPerMinute: parseInt(e.target.value) || 30 }) as any),
                                                    })}
                                                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:border-amber-500/50 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] text-zinc-500 mb-1">Máx. caracteres por mensaje</label>
                                                <input
                                                    type="number"
                                                    min={100}
                                                    max={10000}
                                                    step={100}
                                                    value={(settings.incoming as any)?.maxCharsPerMessage || 5000}
                                                    onChange={e => updateField('incoming', {
                                                        ...settings.incoming,
                                                        ...(({ maxCharsPerMessage: parseInt(e.target.value) || 5000 }) as any),
                                                    })}
                                                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:border-amber-500/50 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                        <ToggleRow
                                            label="Bloquear traducciones de contenido repetido"
                                            description="Detecta spam y evita traducir mensajes idénticos repetidos"
                                            checked={(settings.incoming as any)?.blockRepetitive ?? false}
                                            onChange={() => updateField('incoming', {
                                                ...settings.incoming,
                                                ...(({ blockRepetitive: !((settings.incoming as any)?.blockRepetitive ?? false) }) as any),
                                            })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* === PROVIDERS TAB === */}
                {tab === 'providers' && (
                    <div className="space-y-4">
                        {settings.mode === 'free' && (
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm text-emerald-300 flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                Estás en modo <strong>Free</strong>. Solo se usa el proveedor gratuito. Cambia a modo API para usar otros proveedores.
                            </div>
                        )}

                        {settings.providers.map((prov, i) => (
                            <div
                                key={prov.provider}
                                className={`bg-zinc-900/50 border rounded-2xl p-5 transition-all ${prov.isEnabled ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-zinc-800'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${prov.isEnabled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                                        <h4 className="font-bold text-zinc-200 capitalize">
                                            {prov.provider === 'free' ? 'Google Translate (Free)' : prov.provider === 'deepl' ? 'DeepL' : prov.provider === 'google' ? 'Google Cloud Translation' : 'Azure Translator'}
                                        </h4>
                                        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">
                                            Prioridad: {prov.priority}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => updateProvider(i, 'isEnabled', !prov.isEnabled)}
                                        className={`p-1 rounded-lg transition-colors ${prov.isEnabled ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                                    >
                                        {prov.isEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                    </button>
                                </div>

                                {prov.provider !== 'free' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1">API Key</label>
                                            <input
                                                type="password"
                                                value={prov.apiKey || ''}
                                                onChange={e => updateProvider(i, 'apiKey', e.target.value)}
                                                placeholder={`Clave API de ${prov.provider}`}
                                                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none font-mono"
                                            />
                                        </div>
                                        {prov.provider === 'azure' && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-zinc-500 mb-1">Región</label>
                                                    <input
                                                        type="text"
                                                        value={prov.region || ''}
                                                        onChange={e => updateProvider(i, 'region', e.target.value)}
                                                        placeholder="eastus"
                                                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-zinc-500 mb-1">Endpoint</label>
                                                    <input
                                                        type="text"
                                                        value={prov.endpoint || ''}
                                                        onChange={e => updateProvider(i, 'endpoint', e.target.value)}
                                                        placeholder="https://api.cognitive.microsofttranslator.com"
                                                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1">Prioridad (menor = más alta)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                max={10}
                                                value={prov.priority}
                                                onChange={e => updateProvider(i, 'priority', parseInt(e.target.value) || 0)}
                                                className="w-20 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {prov.provider === 'free' && (
                                    <p className="text-xs text-zinc-500 mt-2">
                                        Usa Google Translate gratuito sin clave API. Adecuado para volumen bajo.
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* === LOGS TAB === */}
                {tab === 'logs' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-zinc-300">Registro de Traducciones</h3>
                            <button
                                onClick={() => loadLogs(1)}
                                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <RefreshCcw className="w-3 h-3" /> Actualizar
                            </button>
                        </div>

                        {logsLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500">
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p>No hay registros de traducción</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {logs.map(log => (
                                    <div key={log._id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="font-mono text-indigo-400 uppercase">{log.sourceLang} → {log.targetLang}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${log.provider === 'free' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        log.provider === 'deepl' ? 'bg-blue-500/10 text-blue-400' :
                                                            'bg-zinc-800 text-zinc-400'
                                                    }`}>
                                                    {log.provider}
                                                </span>
                                                {log.cached && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400">Cache</span>}
                                                <span className="text-zinc-600">{log.latencyMs}ms</span>
                                            </div>
                                            <span className="text-[10px] text-zinc-600">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 truncate">{log.sourceText}</p>
                                        <p className="text-xs text-zinc-300 truncate mt-0.5">→ {log.translatedText}</p>
                                        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600">
                                            <span>{log.characterCount} chars</span>
                                            <span>•</span>
                                            <span>{log.direction}</span>
                                            {typeof log.agentId === 'object' && log.agentId.name && (
                                                <>
                                                    <span>•</span>
                                                    <span>{log.agentId.name}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Pagination */}
                                {logsTotal > 20 && (
                                    <div className="flex justify-center gap-2 pt-4">
                                        <button
                                            disabled={logsPage <= 1}
                                            onClick={() => loadLogs(logsPage - 1)}
                                            className="px-3 py-1 text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg disabled:opacity-30"
                                        >
                                            Anterior
                                        </button>
                                        <span className="text-xs text-zinc-500 py-1">Página {logsPage}</span>
                                        <button
                                            disabled={logsPage * 20 >= logsTotal}
                                            onClick={() => loadLogs(logsPage + 1)}
                                            className="px-3 py-1 text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg disabled:opacity-30"
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* === STATS TAB === */}
                {tab === 'stats' && (
                    <div>
                        {statsLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                            </div>
                        ) : stats ? (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-4 gap-4">
                                    <StatCard label="Traducciones" value={stats.totalTranslations} icon={<Languages className="w-5 h-5" />} color="indigo" />
                                    <StatCard label="Caracteres" value={stats.totalCharacters.toLocaleString()} icon={<FileText className="w-5 h-5" />} color="blue" />
                                    <StatCard label="Desde Cache" value={stats.cachedHits} icon={<Zap className="w-5 h-5" />} color="amber" />
                                    <StatCard label="Latencia Promedio" value={`${Math.round(stats.avgLatency || 0)}ms`} icon={<Clock className="w-5 h-5" />} color="emerald" />
                                </div>

                                {/* By Provider */}
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                    <h4 className="text-sm font-bold text-zinc-300 mb-3">Por Proveedor</h4>
                                    {stats.byProvider.length === 0 ? (
                                        <p className="text-xs text-zinc-500">Sin datos</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {stats.byProvider.map(p => (
                                                <div key={p._id} className="flex items-center justify-between text-sm">
                                                    <span className="text-zinc-300 capitalize font-medium">{p._id}</span>
                                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                        <span>{p.count} traducciones</span>
                                                        <span>{p.chars.toLocaleString()} chars</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Top Agents */}
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                    <h4 className="text-sm font-bold text-zinc-300 mb-3">Top Agentes</h4>
                                    {stats.byAgent.length === 0 ? (
                                        <p className="text-xs text-zinc-500">Sin datos</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {stats.byAgent.map((a, i) => (
                                                <div key={a._id} className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-zinc-600 font-mono">#{i + 1}</span>
                                                        <span className="text-zinc-300 font-medium">{a.agentName || 'Desconocido'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                        <span>{a.count} traducciones</span>
                                                        <span>{a.chars.toLocaleString()} chars</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-zinc-500">
                                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p>No hay estadísticas disponibles</p>
                            </div>
                        )}
                    </div>
                )}

                {/* === REPORTS TAB === */}
                {tab === 'reports' && (
                    <div className="space-y-6">
                        {/* Report Stats Summary */}
                        {reportStats && (
                            <div className="grid grid-cols-4 gap-4">
                                {(['pending', 'reviewed', 'resolved', 'dismissed'] as ReportStatus[]).map(s => {
                                    const count = reportStats.byStatus.find((x: any) => x._id === s)?.count || 0;
                                    const colors: Record<string, string> = { pending: 'amber', reviewed: 'blue', resolved: 'emerald', dismissed: 'zinc' };
                                    const labels: Record<string, string> = { pending: 'Pendientes', reviewed: 'Revisados', resolved: 'Resueltos', dismissed: 'Descartados' };
                                    return (
                                        <div key={s} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                                            <p className={`text-2xl font-bold text-${colors[s]}-400`}>{count}</p>
                                            <p className="text-xs text-zinc-500 mt-1">{labels[s]}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Filters */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <select
                                value={reportsFilter.status || ''}
                                onChange={e => { setReportsFilter(f => ({ ...f, status: (e.target.value as ReportStatus) || undefined })); }}
                                className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Todos los estados</option>
                                <option value="pending">Pendientes</option>
                                <option value="reviewed">Revisados</option>
                                <option value="resolved">Resueltos</option>
                                <option value="dismissed">Descartados</option>
                            </select>
                            <select
                                value={reportsFilter.category || ''}
                                onChange={e => { setReportsFilter(f => ({ ...f, category: (e.target.value as ReportCategory) || undefined })); }}
                                className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Todas las categorías</option>
                                <option value="wrong_translation">Traducción incorrecta</option>
                                <option value="wrong_language">Idioma incorrecto</option>
                                <option value="offensive">Ofensiva</option>
                                <option value="incomplete">Incompleta</option>
                                <option value="improvement">Mejora</option>
                                <option value="bug">Bug</option>
                                <option value="other">Otro</option>
                            </select>
                            <button onClick={() => loadReports(1)} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors">
                                <RefreshCcw className="w-3 h-3" /> Actualizar
                            </button>
                        </div>

                        {/* Reports List */}
                        {reportsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500">
                                <Flag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p>No hay reportes</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {reports.map(r => {
                                    const statusColors: Record<string, string> = { pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20', reviewed: 'bg-blue-500/10 text-blue-400 border-blue-500/20', resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dismissed: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
                                    const catLabels: Record<string, string> = { wrong_translation: '❌ Incorrecta', wrong_language: '🌐 Idioma errado', offensive: '⚠️ Ofensiva', incomplete: '✂️ Incompleta', improvement: '💡 Mejora', bug: '🐛 Bug', other: '📝 Otro' };
                                    const reporterName = typeof r.reportedBy === 'object' && r.reportedBy !== null ? (r.reportedBy as any).name : r.reportedByName;
                                    const reporterAgentId = typeof r.reportedBy === 'object' && r.reportedBy !== null ? (r.reportedBy as any)._id : (r.reportedBy as string);
                                    return (
                                        <div key={r._id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[r.status]}`}>{r.status.toUpperCase()}</span>
                                                    <span className="text-xs text-zinc-400">{catLabels[r.category] || r.category}</span>
                                                    <span className="text-[10px] text-zinc-600">•</span>
                                                    <span className="text-[10px] text-zinc-500">{r.sourceLang} → {r.targetLang}</span>
                                                    <span className="text-[10px] text-zinc-600">•</span>
                                                    <span className="text-[10px] text-zinc-500">{r.provider}</span>
                                                    {r.reporterBlocked && <span className="text-[10px] text-red-400 font-bold">BLOQUEADO</span>}
                                                </div>
                                                <span className="text-[10px] text-zinc-600 shrink-0">{new Date(r.createdAt).toLocaleString()}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <div>
                                                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Original</p>
                                                    <p className="text-xs text-zinc-300 line-clamp-3">{r.originalContent}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-cyan-500 uppercase mb-1">Traducción</p>
                                                    <p className="text-xs text-cyan-300 line-clamp-3">{r.translatedContent}</p>
                                                </div>
                                            </div>
                                            <div className="mb-3 px-3 py-2 bg-zinc-800/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Motivo</p>
                                                <p className="text-xs text-zinc-300">{r.reason}</p>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="text-[10px] text-zinc-500">
                                                    Reportado por <span className="text-zinc-300 font-medium">{reporterName}</span>
                                                    {r.reviewedByName && <span className="ml-2">• Revisado por <span className="text-zinc-300">{r.reviewedByName}</span></span>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {r.status === 'pending' && (
                                                        <>
                                                            <button onClick={() => handleReportAction(r._id, 'reviewed')} className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors font-bold">Revisar</button>
                                                            <button onClick={() => handleReportAction(r._id, 'resolved')} className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors font-bold">Resolver</button>
                                                            <button onClick={() => handleReportAction(r._id, 'dismissed')} className="text-[10px] px-2 py-1 bg-zinc-700/50 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors font-bold">Descartar</button>
                                                        </>
                                                    )}
                                                    {r.status === 'reviewed' && (
                                                        <button onClick={() => handleReportAction(r._id, 'resolved')} className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors font-bold">Resolver</button>
                                                    )}
                                                    {!r.reporterBlocked ? (
                                                        <button onClick={() => handleBlockReporter(reporterAgentId)} className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors font-bold flex items-center gap-1"><Ban className="w-2.5 h-2.5" />Bloquear</button>
                                                    ) : (
                                                        <button onClick={() => handleUnblockReporter(reporterAgentId)} className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors font-bold">Desbloquear</button>
                                                    )}
                                                </div>
                                            </div>
                                            {r.reviewNote && (
                                                <div className="mt-2 px-3 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
                                                    <p className="text-[10px] text-indigo-400"><strong>Nota:</strong> {r.reviewNote}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Pagination */}
                                {reportsTotal > 15 && (
                                    <div className="flex items-center justify-center gap-2 pt-4">
                                        <button disabled={reportsPage <= 1} onClick={() => loadReports(reportsPage - 1)} className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                        <span className="text-xs text-zinc-500">Página {reportsPage} de {Math.ceil(reportsTotal / 15)}</span>
                                        <button disabled={reportsPage >= Math.ceil(reportsTotal / 15)} onClick={() => loadReports(reportsPage + 1)} className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* === COST DASHBOARD TAB === */}
                {tab === 'cost' && (
                    <div className="space-y-6">
                        {/* Period Selector */}
                        <div className="flex items-center gap-3">
                            {[7, 14, 30, 90].map(d => (
                                <button key={d} onClick={() => setCostDays(d)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${costDays === d ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700'}`}
                                >{d}d</button>
                            ))}
                        </div>

                        {costLoading ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
                        ) : costData ? (
                            <>
                                {/* Summary Cards */}
                                <div className="grid grid-cols-5 gap-4">
                                    <StatCard label="Total Requests" value={costData.totals.totalRequests.toLocaleString()} icon={<Activity className="w-4 h-4" />} color="indigo" />
                                    <StatCard label="Total Caracteres" value={costData.totals.totalChars.toLocaleString()} icon={<FileText className="w-4 h-4" />} color="blue" />
                                    <StatCard label="Cache Hits" value={costData.totals.cachedHits.toLocaleString()} icon={<Zap className="w-4 h-4" />} color="emerald" />
                                    <StatCard label="Latencia Prom." value={`${Math.round(costData.totals.avgLatency)}ms`} icon={<Clock className="w-4 h-4" />} color="amber" />
                                    <StatCard label="Costo Estimado" value={`$${costData.totals.estimatedCost}`} icon={<DollarSign className="w-4 h-4" />} color="emerald" />
                                </div>

                                {/* Daily usage bar chart */}
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                    <h4 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400" /> Uso Diario</h4>
                                    {costData.dailyUsage.length === 0 ? (
                                        <p className="text-xs text-zinc-500">Sin datos para este período</p>
                                    ) : (
                                        <div className="flex items-end gap-1 h-32">
                                            {(() => {
                                                const maxReq = Math.max(...costData.dailyUsage.map((d: any) => d.requests), 1);
                                                return costData.dailyUsage.slice(-30).map((d: any) => (
                                                    <div key={d._id} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${d._id}: ${d.requests} req, ${d.characters.toLocaleString()} chars`}>
                                                        <div className="w-full bg-indigo-500/80 rounded-t-sm transition-all hover:bg-indigo-400" style={{ height: `${Math.max((d.requests / maxReq) * 100, 2)}%` }} />
                                                        <span className="text-[7px] text-zinc-600 truncate w-full text-center">{d._id.slice(5)}</span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    {/* By Provider */}
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                        <h4 className="text-sm font-bold text-zinc-300 mb-3">Por Proveedor</h4>
                                        <div className="space-y-2">
                                            {costData.byProvider.map((p: any) => (
                                                <div key={p._id} className="flex items-center justify-between text-xs">
                                                    <span className="text-zinc-300 font-medium capitalize">{p._id}</span>
                                                    <div className="flex gap-3 text-zinc-500">
                                                        <span>{p.count} req</span>
                                                        <span>{Math.round(p.avgLatency)}ms</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* By Direction */}
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                        <h4 className="text-sm font-bold text-zinc-300 mb-3">Por Dirección</h4>
                                        <div className="space-y-2">
                                            {costData.byDirection.map((d: any) => (
                                                <div key={d._id} className="flex items-center justify-between text-xs">
                                                    <span className="text-zinc-300 font-medium">{d._id === 'incoming' ? '📥 Entrante' : d._id === 'outgoing' ? '📤 Saliente' : '🔧 Manual'}</span>
                                                    <div className="flex gap-3 text-zinc-500">
                                                        <span>{d.count} req</span>
                                                        <span>{d.chars.toLocaleString()} chars</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Top Language Pairs */}
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                        <h4 className="text-sm font-bold text-zinc-300 mb-3">Idiomas Frecuentes</h4>
                                        <div className="space-y-2">
                                            {costData.byLangPair.slice(0, 8).map((lp: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <span className="text-zinc-300 font-medium">{lp._id.source} → {lp._id.target}</span>
                                                    <span className="text-zinc-500">{lp.count} req</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Top Agents */}
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                    <h4 className="text-sm font-bold text-zinc-300 mb-3">Top Agentes por Uso</h4>
                                    <div className="space-y-2">
                                        {costData.topAgents.map((a: any, i: number) => (
                                            <div key={a._id} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-zinc-600 font-mono">#{i + 1}</span>
                                                    <span className="text-zinc-300 font-medium">{a.agentName || 'Desconocido'}</span>
                                                </div>
                                                <div className="flex gap-4 text-zinc-500">
                                                    <span>{a.count} req</span>
                                                    <span>{a.chars.toLocaleString()} chars</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12 text-zinc-500"><DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No hay datos de costos</p></div>
                        )}
                    </div>
                )}

                {/* === QA REVIEW TAB === */}
                {tab === 'qa' && (
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <select value={qaDirection || ''} onChange={e => setQaDirection((e.target.value as 'incoming' | 'outgoing') || undefined)}
                                className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Todas las direcciones</option>
                                <option value="incoming">📥 Entrante</option>
                                <option value="outgoing">📤 Saliente</option>
                            </select>
                            <button onClick={() => setQaEditedOnly(p => !p)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors ${qaEditedOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}
                            >
                                Solo editadas
                            </button>
                            <button onClick={() => loadQA(1)} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors">
                                <RefreshCcw className="w-3 h-3" /> Actualizar
                            </button>
                            <span className="text-[10px] text-zinc-600 ml-auto">{qaTotal} mensajes con traducción</span>
                        </div>

                        {/* QA Messages */}
                        {qaLoading ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
                        ) : qaMessages.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500"><Eye className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No hay mensajes traducidos para revisar</p></div>
                        ) : (
                            <div className="space-y-3">
                                {qaMessages.map((m: any) => (
                                    <div key={m._id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={`px-1.5 py-0.5 rounded font-bold ${m.sender === 'user' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                    {m.sender === 'user' ? '📥 Incoming' : '📤 Outgoing'}
                                                </span>
                                                {m.senderAgent && <span className="text-zinc-400">Agente: {m.senderAgent.name}</span>}
                                                <span className="text-zinc-600">•</span>
                                                <span className="text-zinc-500 font-mono">{m.sessionId?.slice(0, 12)}…</span>
                                            </div>
                                            <span className="text-[10px] text-zinc-600">{new Date(m.createdAt).toLocaleString()}</span>
                                        </div>

                                        {/* Content comparison */}
                                        <div className="space-y-2">
                                            {/* Original */}
                                            <div className="px-3 py-2 bg-zinc-800/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-500 mb-1">ORIGINAL</p>
                                                <p className="text-sm text-zinc-200">{m.originalContent || m.content}</p>
                                            </div>

                                            {/* Translation details */}
                                            {m.translation && (
                                                <div className="px-3 py-2 bg-cyan-500/5 border border-cyan-500/10 rounded-lg">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] font-bold text-cyan-500">TRADUCCIÓN</p>
                                                            {m.translation.wasEdited && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">EDITADA</span>}
                                                        </div>
                                                        <div className="flex gap-2 text-[10px] text-zinc-500">
                                                            {m.translation.sourceLang && <span>{m.translation.sourceLang} → {m.translation.targetLang}</span>}
                                                            {m.translation.provider && <span className="capitalize">{m.translation.provider}</span>}
                                                            {m.translation.latencyMs && <span>{m.translation.latencyMs}ms</span>}
                                                            {m.translation.cached && <span className="text-emerald-400">cache</span>}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-cyan-200">{m.translation.translatedContent}</p>
                                                </div>
                                            )}

                                            {/* Auto-translated content (before edit) */}
                                            {m.translation?.autoTranslatedContent && m.translation?.wasEdited && (
                                                <div className="px-3 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
                                                    <p className="text-[10px] font-bold text-indigo-400 mb-1">TRADUCCIÓN AUTOMÁTICA (antes de edición)</p>
                                                    <p className="text-sm text-indigo-200">{m.translation.autoTranslatedContent}</p>
                                                </div>
                                            )}

                                            {/* Edited content */}
                                            {m.translation?.editedContent && (
                                                <div className="px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                                                    <p className="text-[10px] font-bold text-amber-400 mb-1">VERSIÓN EDITADA (ENVIADA)</p>
                                                    <p className="text-sm text-amber-200">{m.translation.editedContent}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {/* Pagination */}
                                {qaTotal > 20 && (
                                    <div className="flex items-center justify-center gap-2 pt-4">
                                        <button disabled={qaPage <= 1} onClick={() => loadQA(qaPage - 1)} className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                        <span className="text-xs text-zinc-500">Página {qaPage} de {Math.ceil(qaTotal / 20)}</span>
                                        <button disabled={qaPage >= Math.ceil(qaTotal / 20)} onClick={() => loadQA(qaPage + 1)} className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── HELPER COMPONENTS ──────────────────────────────────────

function ModeCard({ title, description, isActive, onClick, badge, badgeColor }: {
    title: string;
    description: string;
    isActive: boolean;
    onClick: () => void;
    badge: string;
    badgeColor: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-left p-4 rounded-xl border-2 transition-all ${isActive
                    ? 'border-indigo-500/50 bg-indigo-500/5'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-800/30'
                }`}
        >
            <div className="flex items-center justify-between mb-2">
                <h4 className={`font-bold text-sm ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>{title}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                    {badge}
                </span>
            </div>
            <p className="text-xs text-zinc-500">{description}</p>
            {isActive && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-400">
                    <Check className="w-3 h-3" /> Activo
                </div>
            )}
        </button>
    );
}

function ToggleRow({ label, description, checked, onChange }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-zinc-300 font-medium">{label}</p>
                <p className="text-xs text-zinc-500">{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`p-1 rounded-lg transition-colors ${checked ? 'text-emerald-400' : 'text-zinc-600'}`}
            >
                {checked ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
        </div>
    );
}

function StatCard({ label, value, icon, color }: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className={`inline-flex p-2 rounded-lg border mb-3 ${colorClasses[color] || colorClasses.indigo}`}>
                {icon}
            </div>
            <p className="text-xl font-bold text-zinc-100">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </div>
    );
}
