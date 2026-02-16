import {
    Maximize, Minimize, Settings, X, Eye,
    Layout, Monitor, Sidebar, PanelRight,
    GripHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';
import useFocusModeStore from '../hooks/useFocusMode';
import { useRef, useState } from 'react';
import usePermissions from '../hooks/usePermissions';


// ============= COMPONENT: FLOATING DRAGGABLE INDICATOR =============

export function FocusModeIndicator() {
    const {
        isForce,
        isEnabled, disableFocusMode,
        position, setPosition,
        isDocked, toggleDock
    } = useFocusModeStore();

    const [showSettings, setShowSettings] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // modo isla de iphone en mitad de la pantalla, el indicador se vuelve difícil de arrastrar porque el cursor se va a los bordes. Este ref guarda el offset del cursor al iniciar el drag para evitar que el indicador "salte" al cursor y mejorar la experiencia de arrastre.
    // CENTRO HORIZONTAL
    const xPositionInicial = typeof window !== 'undefined'
        ? (window.innerWidth / 2) - 150
        : 0;
    const yPositionInicialTop = 32;
    const dragOffset = useRef({ x: xPositionInicial, y: yPositionInicialTop });

    const { isSuperior } = usePermissions();

    const isUserSuperior = isSuperior();
  
    // Manejador del inicio del arrastre
    const handlePointerDown = (e: React.PointerEvent) => {
        // Evitar drag si clicamos en botones
        if ((e.target as HTMLElement).closest('button')) return;

        setIsDragging(true);
        // Calcular el offset relativo al cursor para evitar que salte
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        // Capturar puntero para drag suave incluso si sale rápido del div
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;

        // Nueva posición
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;

        setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
    };

    if (!isEnabled) return null;

    return (
        <>
            <div
                className="fixed z-50 flex flex-col items-center gap-3 touch-none"
                style={{
                    left: position.x,
                    top: position.y,
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >

                {/* Settings Popover (Solo si no está minimizado) */}
                {showSettings && !isDocked && (
                    <div className="mb-2 animate-in slide-in-from-bottom-2 fade-in zoom-in-95 duration-200 cursor-default">
                        <FocusModeSettings onClose={() => setShowSettings(false)} />
                    </div>
                )}

                {/* --- MAIN BAR / CAPSULE --- */}
                <div
                    className={`
            relative flex items-center transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
            bg-zinc-950/90 backdrop-blur-xl border border-zinc-800/80 shadow-2xl shadow-black/50 ring-1 ring-white/5
            ${isDocked
                            ? 'w-12 h-12 rounded-full justify-center p-0'
                            : 'pl-2 pr-1.5 py-1.5 rounded-full gap-1'
                        }
          `}
                >

                    {/* DRAG GRIP (Visible solo expandido) */}
                    {!isDocked && (
                        <div className="text-zinc-600 pl-2 cursor-grab active:cursor-grabbing">
                            <GripHorizontal className="w-4 h-4" />
                        </div>
                    )}

                    {/* CONTENIDO (Visible solo expandido) */}
                    {!isDocked && (
                        <>
                            <div className="flex items-center gap-2.5 mx-2 select-none">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                <span className="text-xs font-bold text-zinc-200  uppercase whitespace-nowrap">
                                    Enfoque
                                </span>
                            </div>

                            <div className="h-4 w-px bg-zinc-800 mx-1" />

                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'}`}
                                title="Configuración"
                            >
                                <Settings className="w-4 h-4" />
                            </button>

                            <button
                                onClick={toggleDock}
                                className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-full transition-colors"
                                title="Minimizar (Ocultar)"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {
                                isForce && !isUserSuperior ? (
                                    <span className="text-xs text-red-400 font-medium ml-1 px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/20">
                                        Forzado
                                    </span>
                                ) : (
                                    isUserSuperior && (
                                        <button
                                            onClick={disableFocusMode}
                                            className="ml-1 px-3 py-1.5 bg-zinc-800 hover:bg-red-500/10 hover:text-red-400 text-zinc-300 text-xs font-medium rounded-full transition-all border border-transparent hover:border-red-500/20"
                                        >
                                            Salir
                                        </button>
                                    )
                                )
                            }
                        </>
                    )}

                    {/* ESTADO MINIMIZADO (DOCKED) */}
                    {isDocked && (
                        <button
                            onClick={toggleDock}
                            className="w-full h-full flex items-center justify-center text-indigo-400 hover:text-zinc-50 hover:bg-indigo-500/20 rounded-full transition-all group"
                            title="Expandir controles"
                        >
                            <span className="absolute inset-0 rounded-full border border-indigo-500/30 animate-pulse group-hover:border-indigo-400/50"></span>
                            <Monitor className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Vignette Overlay (Efecto visual de enfoque en pantalla completa) */}
            <div className="fixed inset-0 pointer-events-none z-30 bg-radial-gradient from-transparent to-black/20" />
        </>
    );
}

// ============= COMPONENT: TOGGLE BUTTON =============

interface ToggleProps {
    className?: string;
}

export function FocusModeToggle({ className = '' }: ToggleProps) {
    const { isEnabled, toggleFocusMode } = useFocusModeStore();

    return (
        <button
            onClick={toggleFocusMode}
            className={`relative p-2.5 rounded-xl transition-all duration-300 border
        ${isEnabled
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]'
                    : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                } 
        ${className}
      `}
            title={isEnabled ? 'Salir de Modo Enfoque' : 'Entrar en Modo Enfoque'}
        >
            {isEnabled ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}

            {/* Active Dot */}
            {isEnabled && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            )}
        </button>
    );
}

// ============= COMPONENT: SETTINGS PANEL =============

interface SettingsProps {
    className?: string;
    onClose?: () => void;
}

export function FocusModeSettings({ className = '', onClose }: SettingsProps) {
    const {
        hideSidebar, hideInfoPanel, hideOtherSessions,
        dimInactiveSessions, zenMode, setSettings
    } = useFocusModeStore();

    const settings = [
        { key: 'hideSidebar', label: 'Ocultar Sidebar', desc: 'Esconde la lista de chats', value: hideSidebar, icon: Sidebar },
        { key: 'hideInfoPanel', label: 'Ocultar Info', desc: 'Esconde detalles del contacto', value: hideInfoPanel, icon: PanelRight },
        { key: 'dimInactiveSessions', label: 'Atenuar Inactivos', desc: 'Reduce distracción visual', value: dimInactiveSessions, icon: Eye },
        { key: 'zenMode', label: 'Modo Zen', desc: 'Interfaz ultra minimalista', value: zenMode, icon: Monitor },
    ];

    return (
        <div className={`bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-5 w-72 ${className}`}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-500" /> Configuración
                </h4>
                {onClose && (
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-50 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {settings.map((setting) => {
                    // @ts-ignore - Dynamic key access
                    const Icon = setting.icon;
                    return (
                        <label
                            key={setting.key}
                            className="flex items-center justify-between group cursor-pointer"
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 p-1.5 rounded-lg transition-colors ${setting.value ? 'bg-zinc-800 text-indigo-400' : 'bg-zinc-900 text-zinc-600'}`}>
                                    <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <p className={`text-xs font-medium transition-colors ${setting.value ? 'text-zinc-200' : 'text-zinc-500'}`}>
                                        {setting.label}
                                    </p>
                                    <p className="text-[10px] text-zinc-600">{setting.desc}</p>
                                </div>
                            </div>

                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={Boolean(setting.value)}
                                    // @ts-ignore
                                    onChange={(e) => setSettings({ [setting.key]: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                            </div>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}