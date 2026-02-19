/**
 * TranslationSettingsPage — Admin page for configuring the translation system
 * Manage providers, mode (free/API), rules, cache, rate limits, view logs & stats
 */

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
    Languages, Save, Loader2, Settings2, Shield, BarChart3,
    Globe, Key, ToggleLeft, ToggleRight, RefreshCcw, AlertTriangle,
    Check, ArrowUpDown, FileText, Clock, Zap, ChevronDown,
    Network, Lock, Wifi, WifiOff, Play, ArrowRightLeft, Send
} from 'lucide-react';
import {
    getTranslationSettings,
    updateTranslationSettings,
    getTranslationLogs,
    getTranslationStats,
    testProxy,
    type TranslationSettings,
    type TranslationLogEntry,
    type TranslationStats,
    type TranslationMode,
    type ProviderConfig,
    type ProxyConfig,
    type ProxyProtocol,
    type OutgoingDeliveryMode,
    type TargetLangStrategy,
} from '../services/translation.service';

// ─── TABS ───────────────────────────────────────────────────

type SettingsTab = 'general' | 'providers' | 'logs' | 'stats';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'providers', label: 'Proveedores', icon: <Globe className="w-4 h-4" /> },
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
                                            active={settings.incoming?.showOriginal ?? true}
                                            onToggle={() => updateField('incoming', {
                                                ...settings.incoming,
                                                showOriginal: !(settings.incoming?.showOriginal ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Solo traducir si idioma ≠ destino"
                                            active={(settings.incoming as any)?.onlyIfDifferent ?? true}
                                            onToggle={() => updateField('incoming', {
                                                ...settings.incoming,
                                                onlyIfDifferent: !((settings.incoming as any)?.onlyIfDifferent ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Saltar comandos (/start, /help…)"
                                            active={(settings.incoming as any)?.skipCommands ?? true}
                                            onToggle={() => updateField('incoming', {
                                                ...settings.incoming,
                                                skipCommands: !((settings.incoming as any)?.skipCommands ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Saltar mensajes cortos (<3 chars)"
                                            active={(settings.incoming as any)?.skipShortMessages ?? true}
                                            onToggle={() => updateField('incoming', {
                                                ...settings.incoming,
                                                skipShortMessages: !((settings.incoming as any)?.skipShortMessages ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Saltar mensajes solo emoji"
                                            active={(settings.incoming as any)?.skipEmojiOnly ?? true}
                                            onToggle={() => updateField('incoming', {
                                                ...settings.incoming,
                                                skipEmojiOnly: !((settings.incoming as any)?.skipEmojiOnly ?? true),
                                            })}
                                        />
                                        <ToggleRow
                                            label="Permitir override por agente"
                                            active={(settings.incoming as any)?.agentOverrideAllowed ?? true}
                                            onToggle={() => updateField('incoming', {
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
