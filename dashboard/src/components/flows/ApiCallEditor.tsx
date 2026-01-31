/**
 * ApiCallEditor - Editor tipo Postman para configurar llamadas HTTP en flows
 * Incluye playground para pruebas y extracción de variables
 */

import React, { useState, useCallback } from 'react';
import {
    Globe,
    Plus,
    Trash2,
    Play,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Copy,
    RefreshCw,
    Key,
    FileJson,
    Code,
    Zap,
    ArrowRight,
    Settings,
    Variable,
    Loader2,
    Info,
    ChevronUp,
    Save,
    Activity,
    ArrowLeftFromLine,
    ArrowDown,
    ListFilter,
    Hash,
    FileCode,
    ShieldCheck,
    Hourglass,
    ArrowRightCircle,
    GitMerge,
    GitBranch,
} from 'lucide-react';

// ============= TYPES =============

export interface HeaderItem {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
}

export interface QueryParam {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
}

export interface ExtractedVariable {
    id: string;
    variableName: string;
    jsonPath: string;
    defaultValue?: string;
}

export interface ApiCallConfig {
    // Request
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers: HeaderItem[];
    queryParams: QueryParam[];
    bodyType: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
    body: string;
    // Auth
    authType: 'none' | 'bearer' | 'basic' | 'api-key';
    authConfig: {
        bearerToken?: string;
        basicUsername?: string;
        basicPassword?: string;
        apiKeyName?: string;
        apiKeyValue?: string;
        apiKeyLocation?: 'header' | 'query';
    };
    // Timeout & Retry
    timeout: number; // seconds
    retryCount: number;
    retryDelay: number; // seconds
    // Response handling
    successCodes: number[];
    extractVariables: ExtractedVariable[];
    // Error handling
    onError: 'continue' | 'stop' | 'goto_node';
    errorNodeId?: string;
    saveErrorTo?: string;
    saveResponseTo?: string;
    saveStatusCodeTo?: string;
}

interface ApiCallEditorProps {
    config: Partial<ApiCallConfig>;
    onChange: (config: Partial<ApiCallConfig>) => void;
    flowNodes?: Array<{ id: string; label: string; type: string }>;
}

// ============= DEFAULT CONFIG =============

const defaultConfig: ApiCallConfig = {
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    bodyType: 'none',
    body: '',
    authType: 'none',
    authConfig: {},
    timeout: 30,
    retryCount: 0,
    retryDelay: 5,
    successCodes: [200, 201, 204],
    extractVariables: [],
    onError: 'continue',
    saveResponseTo: '',
    saveStatusCodeTo: '',
};

// ============= COMPONENT =============

export default function ApiCallEditor({ config, onChange, flowNodes = [] }: ApiCallEditorProps) {
    const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showPlayground, setShowPlayground] = useState(false);
    const [playgroundResult, setPlaygroundResult] = useState<{
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: any;
        time: number;
        error?: string;
    } | null>(null);
    const [isTestRunning, setIsTestRunning] = useState(false);

    // Merge with defaults
    const cfg: ApiCallConfig = { ...defaultConfig, ...config };

    const update = useCallback((updates: Partial<ApiCallConfig>) => {
        onChange({ ...cfg, ...updates });
    }, [cfg, onChange]);

    // ============= HANDLERS =============

    const addHeader = () => {
        update({
            headers: [...cfg.headers, { id: Date.now().toString(), key: '', value: '', enabled: true }],
        });
    };

    const updateHeader = (id: string, field: keyof HeaderItem, value: any) => {
        update({
            headers: cfg.headers.map(h => h.id === id ? { ...h, [field]: value } : h),
        });
    };

    const removeHeader = (id: string) => {
        update({ headers: cfg.headers.filter(h => h.id !== id) });
    };

    const addQueryParam = () => {
        update({
            queryParams: [...cfg.queryParams, { id: Date.now().toString(), key: '', value: '', enabled: true }],
        });
    };

    const updateQueryParam = (id: string, field: keyof QueryParam, value: any) => {
        update({
            queryParams: cfg.queryParams.map(p => p.id === id ? { ...p, [field]: value } : p),
        });
    };

    const removeQueryParam = (id: string) => {
        update({ queryParams: cfg.queryParams.filter(p => p.id !== id) });
    };

    const addExtractVariable = () => {
        update({
            extractVariables: [
                ...cfg.extractVariables,
                { id: Date.now().toString(), variableName: '', jsonPath: '', defaultValue: '' },
            ],
        });
    };

    const updateExtractVariable = (id: string, field: keyof ExtractedVariable, value: string) => {
        update({
            extractVariables: cfg.extractVariables.map(v => v.id === id ? { ...v, [field]: value } : v),
        });
    };

    const removeExtractVariable = (id: string) => {
        update({ extractVariables: cfg.extractVariables.filter(v => v.id !== id) });
    };

    // ============= PLAYGROUND =============

    const runTest = async () => {
        if (!cfg.url) return;

        setIsTestRunning(true);
        setPlaygroundResult(null);

        const startTime = Date.now();

        try {
            // Build URL with query params
            let url = cfg.url;
            const enabledParams = cfg.queryParams.filter(p => p.enabled && p.key);
            if (enabledParams.length > 0) {
                const params = new URLSearchParams();
                enabledParams.forEach(p => params.append(p.key, p.value));
                url += (url.includes('?') ? '&' : '?') + params.toString();
            }

            // Build headers
            const headers: Record<string, string> = {};
            cfg.headers.filter(h => h.enabled && h.key).forEach(h => {
                headers[h.key] = h.value;
            });

            // Add auth headers
            if (cfg.authType === 'bearer' && cfg.authConfig.bearerToken) {
                headers['Authorization'] = `Bearer ${cfg.authConfig.bearerToken}`;
            } else if (cfg.authType === 'basic' && cfg.authConfig.basicUsername) {
                const credentials = btoa(`${cfg.authConfig.basicUsername}:${cfg.authConfig.basicPassword || ''}`);
                headers['Authorization'] = `Basic ${credentials}`;
            } else if (cfg.authType === 'api-key' && cfg.authConfig.apiKeyName && cfg.authConfig.apiKeyLocation === 'header') {
                headers[cfg.authConfig.apiKeyName] = cfg.authConfig.apiKeyValue || '';
            }

            // Set content type for body
            if (cfg.bodyType === 'json') {
                headers['Content-Type'] = 'application/json';
            } else if (cfg.bodyType === 'x-www-form-urlencoded') {
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }

            // Make request through our backend proxy to avoid CORS
            const response = await fetch('/api/flows/test-api-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: cfg.method,
                    url,
                    headers,
                    body: cfg.bodyType !== 'none' ? cfg.body : undefined,
                    timeout: cfg.timeout * 1000,
                }),
            });

            const result = await response.json();
            const endTime = Date.now();

            if (result.ok) {
                setPlaygroundResult({
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers || {},
                    body: result.body,
                    time: endTime - startTime,
                });
            } else {
                setPlaygroundResult({
                    status: 0,
                    statusText: 'Error',
                    headers: {},
                    body: null,
                    time: endTime - startTime,
                    error: result.error || 'Request failed',
                });
            }
        } catch (error) {
            setPlaygroundResult({
                status: 0,
                statusText: 'Error',
                headers: {},
                body: null,
                time: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setIsTestRunning(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // ============= RENDER =============

    const methodColors: Record<string, string> = {
        GET: 'bg-green-500',
        POST: 'bg-blue-500',
        PUT: 'bg-yellow-500',
        PATCH: 'bg-orange-500',
        DELETE: 'bg-red-500',
    };

    return (
        <div className="space-y-4">

            {/* Method & URL Section */}
            <div className="flex gap-3 h-11">
                {/* Combined Input Group (Omnibar) */}
                <div className="flex-1 flex items-center bg-gray-900 border border-gray-700 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all shadow-sm">

                    {/* Method Selector */}
                    <div className="relative border-r border-gray-800 h-full shrink-0"> {/* shrink-0 evita que se aplaste */}
                        <select
                            value={cfg.method}
                            onChange={(e) => update({ method: e.target.value as ApiCallConfig['method'] })}
                            className={`h-full appearance-none pl-4 pr-9 bg-gray-900 font-bold text-sm outline-none cursor-pointer transition-colors ${cfg.method === 'GET' ? 'text-green-400' :
                                cfg.method === 'POST' ? 'text-yellow-400' :
                                    cfg.method === 'DELETE' ? 'text-red-400' :
                                        cfg.method === 'PUT' ? 'text-blue-400' : 'text-gray-300'
                                }`}
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                            <ChevronDown className="w-3 h-3" />
                        </div>
                    </div>

                    {/* URL Input CORREGIDO */}
                    <input
                        type="text"
                        value={cfg.url}
                        onChange={(e) => update({ url: e.target.value })}
                        placeholder="https://api.example.com/v1/resource"
                        // Claves aquí: outline-none, w-full, bg-transparent
                        className="flex-1 w-full h-full px-4 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-gray-200 placeholder-gray-600 text-sm font-mono"
                        spellCheck={false}
                    />
                </div>

                {/* Test / Send Button */}
                <button
                    onClick={() => setShowPlayground(!showPlayground)}
                    className={`px-4 h-full rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-lg shrink-0 ${showPlayground
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                        }`}
                >
                    {showPlayground ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            <span className="hidden sm:inline">Ocultar</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4 fill-current" />
                        </>
                    )}
                </button>
            </div>

            {/* Variable hint */}
            <p className="text-xs text-gray-400">
                💡 Usa variables: <code className="bg-gray-700 px-1 rounded">{'{{variables.token}}'}</code>, <code className="bg-gray-700 px-1 rounded">{'{{user.id}}'}</code>
            </p>

            {/* --- TABS & CONTENT SECTION --- */}
            <div className="flex flex-col gap-4">

                {/* Navigation Tabs (Segmented Control Style) */}
                <div className="bg-gray-900/50 p-1 rounded-lg flex gap-1 border border-gray-800">
                    {([
                        { id: 'params', label: 'Params', icon: <ListFilter className="w-3.5 h-3.5" /> },
                        { id: 'headers', label: 'Headers', icon: <Hash className="w-3.5 h-3.5" />, count: cfg.headers.length },
                        { id: 'body', label: 'Body', icon: <FileCode className="w-3.5 h-3.5" /> },
                        { id: 'auth', label: 'Auth', icon: <ShieldCheck className="w-3.5 h-3.5" /> }
                    ] as const).map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-gray-700 text-white shadow-sm ring-1 ring-white/10'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {'count' in tab && tab.count ? (
                                <span className={`text-[10px] px-1.5 rounded-full ${activeTab === tab.id ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                    {tab.count}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>

                {/* Tab Content Area */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* --- QUERY PARAMS TAB --- */}
                    {activeTab === 'params' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-gray-500 ">Parámetros de URL</span>
                                <button onClick={addQueryParam} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                                    <Plus className="w-3 h-3" /> Añadir
                                </button>
                            </div>

                            {cfg.queryParams.length === 0 ? (
                                <div className="border border-dashed border-gray-700 rounded-lg py-8 text-center">
                                    <p className="text-sm text-gray-500">No hay parámetros configurados.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {cfg.queryParams.map((param) => (
                                        <div key={param.id} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded border border-gray-700/50 group hover:border-gray-600 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={param.enabled}
                                                onChange={(e) => updateQueryParam(param.id, 'enabled', e.target.checked)}
                                                className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={param.key}
                                                onChange={(e) => updateQueryParam(param.id, 'key', e.target.value)}
                                                placeholder="Key"
                                                className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none border-b border-transparent focus:border-blue-500/50 transition-colors"
                                            />
                                            <div className="w-px h-4 bg-gray-700 mx-1"></div>
                                            <input
                                                type="text"
                                                value={param.value}
                                                onChange={(e) => updateQueryParam(param.id, 'value', e.target.value)}
                                                placeholder="Value"
                                                className="flex-1 min-w-0 bg-transparent text-sm text-blue-300 placeholder-gray-600 outline-none border-b border-transparent focus:border-blue-500/50 transition-colors"
                                            />
                                            <button
                                                onClick={() => removeQueryParam(param.id)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- HEADERS TAB --- */}
                    {activeTab === 'headers' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-gray-500 ">Headers HTTP</span>
                                <button onClick={addHeader} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                                    <Plus className="w-3 h-3" /> Añadir
                                </button>
                            </div>
                            {cfg.headers.length === 0 ? (
                                <div className="border border-dashed border-gray-700 rounded-lg py-8 text-center">
                                    <p className="text-sm text-gray-500">No hay headers personalizados.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {cfg.headers.map((header) => (
                                        <div key={header.id} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded border border-gray-700/50 group hover:border-gray-600 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={header.enabled}
                                                onChange={(e) => updateHeader(header.id, 'enabled', e.target.checked)}
                                                className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={header.key}
                                                onChange={(e) => updateHeader(header.id, 'key', e.target.value)}
                                                placeholder="Header-Name"
                                                className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none border-b border-transparent focus:border-blue-500/50 transition-colors font-mono"
                                            />
                                            <div className="w-px h-4 bg-gray-700 mx-1"></div>
                                            <input
                                                type="text"
                                                value={header.value}
                                                onChange={(e) => updateHeader(header.id, 'value', e.target.value)}
                                                placeholder="Value"
                                                className="flex-1 min-w-0 bg-transparent text-sm text-green-300 placeholder-gray-600 outline-none border-b border-transparent focus:border-blue-500/50 transition-colors"
                                            />
                                            <button
                                                onClick={() => removeHeader(header.id)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- BODY TAB --- */}
                    {activeTab === 'body' && (
                        <div className="space-y-4">
                            {/* Body Type Selector */}
                            <div className="bg-gray-900/50 p-1 rounded-lg inline-flex border border-gray-800 overflow-x-auto max-w-full">
                                {(['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => update({ bodyType: type })}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${cfg.bodyType === type
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                            }`}
                                    >
                                        {type === 'x-www-form-urlencoded' ? 'x-www-form' : type.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            {/* Editor Area */}
                            {cfg.bodyType !== 'none' && (
                                <div className="relative group">
                                    <textarea
                                        value={cfg.body}
                                        onChange={(e) => update({ body: e.target.value })}
                                        placeholder={cfg.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body content...'}
                                        className="w-full h-56 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 font-mono text-sm leading-relaxed resize-y focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                                        spellCheck={false}
                                    />
                                    {/* Dynamic Hint Overlay */}
                                    <div className="absolute top-2 right-2 pointer-events-none">
                                        <span className="text-[10px] text-gray-600 bg-gray-800/80 px-2 py-1 rounded border border-gray-700">
                                            {cfg.bodyType}
                                        </span>
                                    </div>
                                    {cfg.bodyType === 'json' && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                            <Info className="w-3.5 h-3.5" />
                                            <span>Puedes usar variables dinámicas como <code className="text-blue-400">{'{{variables.token}}'}</code></span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {cfg.bodyType === 'none' && (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                                    <FileCode className="w-8 h-8 mb-2 opacity-20" />
                                    <span className="text-sm">Esta petición no tiene cuerpo.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- AUTH TAB --- */}
                    {activeTab === 'auth' && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ">Tipo de Autenticación</label>
                                <div className="relative">
                                    <select
                                        value={cfg.authType}
                                        onChange={(e) => update({ authType: e.target.value as ApiCallConfig['authType'] })}
                                        className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer"
                                    >
                                        <option value="none">No Authentication</option>
                                        <option value="bearer">Bearer Token</option>
                                        <option value="basic">Basic Auth</option>
                                        <option value="api-key">API Key</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            {cfg.authType !== 'none' && (
                                <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    {cfg.authType === 'bearer' && (
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400">Bearer Token</label>
                                            <div className="relative group">
                                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                                                <input
                                                    type="password"
                                                    value={cfg.authConfig.bearerToken || ''}
                                                    onChange={(e) => update({ authConfig: { ...cfg.authConfig, bearerToken: e.target.value } })}
                                                    placeholder="eyJhbGciOiJIUzI1..."
                                                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {cfg.authType === 'basic' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-400">Username</label>
                                                <input
                                                    type="text"
                                                    value={cfg.authConfig.basicUsername || ''}
                                                    onChange={(e) => update({ authConfig: { ...cfg.authConfig, basicUsername: e.target.value } })}
                                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-400">Password</label>
                                                <input
                                                    type="password"
                                                    value={cfg.authConfig.basicPassword || ''}
                                                    onChange={(e) => update({ authConfig: { ...cfg.authConfig, basicPassword: e.target.value } })}
                                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {cfg.authType === 'api-key' && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-400">Key</label>
                                                    <input
                                                        type="text"
                                                        value={cfg.authConfig.apiKeyName || ''}
                                                        onChange={(e) => update({ authConfig: { ...cfg.authConfig, apiKeyName: e.target.value } })}
                                                        placeholder="X-API-Key"
                                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-400">Value</label>
                                                    <input
                                                        type="password"
                                                        value={cfg.authConfig.apiKeyValue || ''}
                                                        onChange={(e) => update({ authConfig: { ...cfg.authConfig, apiKeyValue: e.target.value } })}
                                                        placeholder="secret-key..."
                                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-400">Ubicación</label>
                                                <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700 w-fit">
                                                    <button
                                                        onClick={() => update({ authConfig: { ...cfg.authConfig, apiKeyLocation: 'header' } })}
                                                        className={`px-3 py-1 text-xs rounded transition-colors ${cfg.authConfig.apiKeyLocation === 'header' || !cfg.authConfig.apiKeyLocation ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
                                                            }`}
                                                    >
                                                        Header
                                                    </button>
                                                    <button
                                                        onClick={() => update({ authConfig: { ...cfg.authConfig, apiKeyLocation: 'query' } })}
                                                        className={`px-3 py-1 text-xs rounded transition-colors ${cfg.authConfig.apiKeyLocation === 'query' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
                                                            }`}
                                                    >
                                                        Query Params
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* --- PLAYGROUND SECTION --- */}
            {showPlayground && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                    <div className="border border-gray-700 rounded-xl overflow-hidden shadow-2xl bg-[#0d1117]">
                        {/* Terminal Header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            </div>
                            <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                                <Zap className="w-3 h-3" /> Console Output
                            </span>
                            <button
                                onClick={runTest}
                                disabled={!cfg.url || isTestRunning}
                                className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                {isTestRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                {isTestRunning ? 'Sending...' : 'Run Request'}
                            </button>
                        </div>

                        {/* Terminal Body */}
                        <div className="p-4 font-mono text-sm overflow-x-auto">
                            {!playgroundResult ? (
                                <div className="text-gray-600 italic">Waiting for request...</div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className={`px-2 py-0.5 rounded ${playgroundResult.error ? 'bg-red-500/20 text-red-400' :
                                            playgroundResult.status < 300 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            STATUS: {playgroundResult.status || 'ERR'} {playgroundResult.statusText}
                                        </span>
                                        <span className="text-gray-500">TIME: {playgroundResult.time}ms</span>
                                    </div>

                                    {playgroundResult.body && (
                                        <div className="relative group">
                                            <pre className="text-gray-300 whitespace-pre-wrap break-all pl-2 border-l-2 border-gray-700 hover:border-blue-500 transition-colors">
                                                {typeof playgroundResult.body === 'string' ? playgroundResult.body : JSON.stringify(playgroundResult.body, null, 2)}
                                            </pre>
                                            <button
                                                onClick={() => copyToClipboard(JSON.stringify(playgroundResult.body, null, 2))}
                                                className="absolute top-0 right-0 p-1 bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}

                                    {/* JSON Path Helper */}
                                    {!playgroundResult.error && (
                                        <div className="mt-4 p-2 bg-blue-900/20 border border-blue-900/50 rounded text-xs text-blue-300 flex items-start gap-2">
                                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>💡 Para extraer datos, usa JSON path. Ejemplo: si la respuesta es <code className="bg-blue-800/50 px-1 rounded">{`{"user":{"name":"John"}}`}</code>, usa <code className="bg-blue-800/50 px-1 rounded">user.name</code> para obtener "John"</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Extract Variables Section (Compact & Responsive) */}
            <div className={`border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm group/block transition-all hover:border-blue-300 dark:hover:border-blue-700 ${showAdvanced
                ? 'border-gray-700 bg-gray-800'
                : 'border-gray-700 bg-gray-800/40 hover:bg-gray-800'
                }`}>
                {/* Header Compacto */}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full px-4 py-3 flex items-center justify-between group transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Variable className={`w-4 h-4 ${showAdvanced ? 'text-purple-400' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-200">Extracción de Variables</span>
                    </div>
                    {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {/* Content */}
                {showAdvanced && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-1 duration-150">
                        <div className="h-px bg-gray-700 w-full mb-3" />

                        {/* List Header (Solo visible en Desktop para ahorrar espacio) */}
                        {cfg.extractVariables.length > 0 && (
                            <div className="hidden md:flex items-center gap-2 mb-2 px-1">
                                <span className="flex-1 text-[10px] text-gray-500 font-semibold">Nombre Variable</span>
                                <span className="w-6"></span> {/* Spacer for arrow */}
                                <span className="flex-[2] text-[10px] text-gray-500 font-semibold">JSON Path</span>
                                <span className="w-24 text-[10px] text-gray-500 font-semiboldtext-center">Default</span>
                                <span className="w-8"></span> {/* Spacer for delete */}
                            </div>
                        )}
                        <div className="space-y-2">
                            {cfg.extractVariables.map((v) => (
                                <div key={v.id} className="bg-gray-900/50 rounded border border-gray-700/50 p-2 md:p-1 flex flex-col md:flex-row items-center gap-2 hover:border-gray-600 transition-colors">

                                    {/* 1. Variable Name (FLEX-1: Ocupa espacio principal) */}
                                    <div className="w-full md:flex-1 relative">
                                        <span className="md:hidden text-[10px] text-gray-500 mb-1 block">Nombre Variable</span>
                                        <input
                                            type="text"
                                            value={v.variableName}
                                            onChange={(e) => updateExtractVariable(v.id, 'variableName', e.target.value)}
                                            placeholder="ej: user_id"
                                            className="w-full h-9 bg-gray-800 border border-gray-700 rounded px-2 text-sm text-purple-300 font-medium placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                                        />
                                    </div>

                                    {/* 2. Arrow Icon */}
                                    <div className="text-gray-600 shrink-0">
                                        <ArrowLeftFromLine className="hidden md:block w-3 h-3" />
                                        <ArrowDown className="block md:hidden w-3 h-3" />
                                    </div>

                                    {/* 3. JSON Path (FLEX-1: Comparte el espacio con Variable Name) */}
                                    <div className="w-full md:flex-1 relative">
                                        <span className="md:hidden text-[10px] text-gray-500 mb-1 block">JSON Path</span>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-mono">$.</span>
                                            <input
                                                type="text"
                                                value={v.jsonPath}
                                                onChange={(e) => updateExtractVariable(v.id, 'jsonPath', e.target.value)}
                                                placeholder="data.id"
                                                className="w-full h-9 bg-gray-800 border border-gray-700 rounded pl-6 pr-2 text-sm text-blue-300 font-mono placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* 4. Default & Delete (Ancho FIJO pequeño: w-20) */}
                                    <div className="w-full md:w-auto flex items-center gap-2 shrink-0">
                                        <div className="flex-1 md:w-20 md:flex-none">
                                            <span className="md:hidden text-[10px] text-gray-500 mb-1 block">Default</span>
                                            <input
                                                type="text"
                                                value={v.defaultValue || ''}
                                                onChange={(e) => updateExtractVariable(v.id, 'defaultValue', e.target.value)}
                                                placeholder="-"
                                                className="w-full h-9 bg-gray-800 border border-gray-700 rounded px-2 text-sm text-gray-400 text-center focus:border-gray-500 outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeExtractVariable(v.id)}
                                            className="h-9 w-9 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors mt-auto md:mt-0"
                                            title="Eliminar variable"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={addExtractVariable}
                            className="w-full mt-2 py-1.5 flex items-center justify-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-dashed border-gray-700 hover:border-blue-500/30 rounded transition-all"
                        >
                            <Plus className="w-3 h-3" /> Agregar Mapeo
                        </button>

                        {/* Global Options Footer */}
                        <div className="mt-4 pt-3 border-t border-gray-700/50 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-700 rounded px-2 h-9">
                                <Save className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                <input
                                    type="text"
                                    value={cfg.saveResponseTo || ''}
                                    onChange={(e) => update({ saveResponseTo: e.target.value })}
                                    placeholder="Variable para Respuesta Completa"
                                    className="w-full bg-transparent border-none text-xs text-gray-200 placeholder-gray-600 focus:ring-0 px-0 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-700 rounded px-2 h-9">
                                <Activity className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                <input
                                    type="text"
                                    value={cfg.saveStatusCodeTo || ''}
                                    onChange={(e) => update({ saveStatusCodeTo: e.target.value })}
                                    placeholder="Variable para Status Code"
                                    className="w-full bg-transparent border-none text-xs text-gray-200 placeholder-gray-600 focus:ring-0 px-0 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Advanced Settings Section */}
            <div className={`border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm group/block transition-all hover:border-blue-300 dark:hover:border-blue-700`}>
                <button
                    onClick={() => { }} // Asumo que aquí va tu lógica de toggle, ej: setShowSettings(!showSettings)
                    className="w-full px-4 py-3 flex items-center justify-between group transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Settings className={`w-4 h-4 ${true /* showSettings */ ? 'text-blue-400' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-200">Configuración Avanzada</span>
                    </div>
                </button>
                <div className="px-4 pb-4 animate-in slide-in-from-top-1 duration-150 space-y-5">
                    <div className="h-px bg-gray-700 w-full" />

                    {/* 1. Network & Resilience Group */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-gray-500 ">Control de Ejecución</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Timeout */}
                            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 flex items-center gap-2 relative focus-within:border-blue-500 transition-colors">
                                <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <label className="text-[10px] text-gray-500 block leading-none mb-0.5">Timeout</label>
                                    <input
                                        type="number"
                                        value={cfg.timeout}
                                        onChange={(e) => update({ timeout: parseInt(e.target.value) || 30 })}
                                        className="w-full bg-transparent border-none p-0 text-sm text-gray-200 focus:ring-0 h-5 outline-none focus:outline-none"
                                        placeholder="30"
                                    />
                                </div>
                                <span className="text-xs text-gray-600 font-medium select-none">seg</span>
                            </div>

                            {/* Retries */}
                            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 flex items-center gap-2 relative focus-within:border-blue-500 transition-colors">
                                <RefreshCw className="w-4 h-4 text-gray-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <label className="text-[10px] text-gray-500 block leading-none mb-0.5">Reintentos</label>
                                    <input
                                        type="number"
                                        value={cfg.retryCount}
                                        onChange={(e) => update({ retryCount: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-transparent border-none p-0 text-sm text-gray-200 focus:ring-0 h-5 outline-none focus:outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Retry Delay */}
                            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 flex items-center gap-2 relative focus-within:border-blue-500 transition-colors">
                                <Hourglass className="w-4 h-4 text-gray-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <label className="text-[10px] text-gray-500 block leading-none mb-0.5">Delay</label>
                                    <input
                                        type="number"
                                        value={cfg.retryDelay}
                                        onChange={(e) => update({ retryDelay: parseInt(e.target.value) || 5 })}
                                        className="w-full bg-transparent border-none p-0 text-sm text-gray-200 focus:ring-0 h-5 outline-none focus:outline-none"
                                        placeholder="5"
                                    />
                                </div>
                                <span className="text-xs text-gray-600 font-medium select-none">seg</span>
                            </div>
                        </div>

                        {/* Success Codes */}
                        <div className="bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-3 focus-within:border-green-500/50 transition-colors">
                            <CheckCircle className="w-4 h-4 text-green-500/70 shrink-0" />
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-500 block leading-none mb-1">Códigos HTTP de Éxito</label>
                                <input
                                    type="text"
                                    value={cfg.successCodes.join(', ')}
                                    onChange={(e) => {
                                        const codes = e.target.value.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
                                        update({ successCodes: codes.length > 0 ? codes : [200] });
                                    }}
                                    placeholder="200, 201, 204"
                                    className="w-full bg-transparent border-none p-0 text-sm text-gray-200 placeholder-gray-600 focus:ring-0 font-mono outline-none focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Error Handling Group */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-gray-500 ">Manejo de Fallos</h4>

                        {/* Strategy Segmented Control */}
                        <div className="bg-gray-900 p-1 rounded-lg border border-gray-700 flex flex-col sm:flex-row gap-1">
                            <button
                                onClick={() => update({ onError: 'continue' })}
                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${cfg.onError === 'continue' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                <ArrowRightCircle className="w-3.5 h-3.5" /> Continuar
                            </button>
                            <button
                                onClick={() => update({ onError: 'stop' })}
                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${cfg.onError === 'stop' ? 'bg-red-600/90 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                <XCircle className="w-3.5 h-3.5" /> Detener
                            </button>
                            <button
                                onClick={() => update({ onError: 'goto_node' })}
                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${cfg.onError === 'goto_node' ? 'bg-orange-600/90 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                <GitMerge className="w-3.5 h-3.5" /> Saltar a Nodo
                            </button>
                        </div>

                        {/* Conditional Error Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {cfg.onError === 'goto_node' && (
                                <div className="relative animate-in fade-in zoom-in-95 duration-200">
                                    <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                                    <select
                                        value={cfg.errorNodeId || ''}
                                        onChange={(e) => update({ errorNodeId: e.target.value })}
                                        className="w-full pl-9 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">Seleccionar destino...</option>
                                        {flowNodes.filter(n => n.type !== 'trigger').map((node) => (
                                            <option key={node.id} value={node.id}>{node.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                                </div>
                            )}

                            {/* Error Variable (Always useful if onError != stop, but visible always for consistency) */}
                            <div className={`relative ${cfg.onError !== 'goto_node' ? 'sm:col-span-2' : ''}`}>
                                <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500/70" />
                                <input
                                    type="text"
                                    value={cfg.saveErrorTo || ''}
                                    onChange={(e) => update({ saveErrorTo: e.target.value })}
                                    placeholder="Variable para guardar error (ej: api_error)"
                                    className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="p-3 bg-gray-700/50 rounded-lg text-sm text-gray-300">
                <p>
                    <span className={`font-bold ${methodColors[cfg.method].replace('bg-', 'text-').replace('500', '400')}`}>
                        {cfg.method}
                    </span>{' '}
                    {cfg.url || '(sin URL)'}{' '}
                    {cfg.timeout && <span className="text-gray-500">• {cfg.timeout}s timeout</span>}{' '}
                    {cfg.retryCount > 0 && <span className="text-gray-500">• {cfg.retryCount} reintentos</span>}
                </p>
                {cfg.extractVariables.length > 0 && (
                    <p className="text-purple-400 mt-1">
                        📦 Extrae: {cfg.extractVariables.map(v => v.variableName).filter(Boolean).join(', ') || '(configurar)'}
                    </p>
                )}
            </div>
        </div>
    );
}