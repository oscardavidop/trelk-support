/**
 * PolicyAlertsProvider - Premium Zinc Refactor
 * Global system alerts and maintenance screens with high-fidelity UI.
 */

import { useEffect, useState } from 'react';
import { usePolicyStore } from '../stores/policyStore';
import { 
  AlertTriangle, AlertOctagon, Info, X, ShieldAlert, 
  CheckCircle2, AlertCircle, Lock 
} from 'lucide-react';

// ============= CONFIGURATION =============

const ALERT_STYLES: Record<string, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  button: string;
  shadow: string;
}> = {
  critical: {
    icon: AlertOctagon,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    button: 'bg-red-600 hover:bg-red-500 text-zinc-50 shadow-red-500/20',
    shadow: 'shadow-red-500/10'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    button: 'bg-amber-600 hover:bg-amber-500 text-zinc-50 shadow-amber-500/20',
    shadow: 'shadow-amber-500/10'
  },
  info: {
    icon: Info,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    button: 'bg-indigo-600 hover:bg-indigo-500 text-zinc-50 shadow-indigo-500/20',
    shadow: 'shadow-indigo-500/10'
  }
};

// ============= COMPONENT =============

export function PolicyAlertsProvider({ children }: { children: React.ReactNode }) {
  const { 
    globalAlert, 
    maintenanceMode, 
    maintenanceMessage, 
    warnings, 
    alertAcknowledged, 
    maintenanceAcknowledged, 
    acknowledgeAlert, 
    acknowledgeMaintenanceMode 
  } = usePolicyStore();
  
  const [showWarnings, setShowWarnings] = useState(true);

  // Auto-hide warnings
  useEffect(() => {
    if (warnings && warnings.length > 0) {
      setShowWarnings(true);
      const timer = setTimeout(() => setShowWarnings(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [warnings]);

  const showGlobalAlert = globalAlert?.enabled && !alertAcknowledged;
  const showMaintenance = maintenanceMode && !maintenanceAcknowledged;

  return (
    <>
      {children}

      {/* === MAINTENANCE MODE MODAL === */}
      {showMaintenance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-600/20 rounded-full blur-[120px] pointer-events-none opacity-50" />

          <div className="relative w-full max-w-lg mx-4 bg-zinc-950 border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 animate-in zoom-in-95 duration-300">
            {/* Striped Warning Bar */}
            <div className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#f59e0b_10px,#f59e0b_20px)] opacity-80" />
            
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/10 rounded-full mb-6 ring-1 ring-amber-500/20 shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)]">
                <ShieldAlert className="w-10 h-10 text-amber-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-zinc-50 tracking-tight mb-3">
                Modo de Mantenimiento
              </h2>
              
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                {maintenanceMessage || 'El sistema está en mantenimiento programado. El acceso está restringido temporalmente para asegurar la integridad de los datos.'}
              </p>
              
              <button
                onClick={acknowledgeMaintenanceMode}
                className="w-full py-3 px-6 bg-amber-600 hover:bg-amber-500 text-zinc-50 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Entendido
              </button>
            </div>
            
            <div className="bg-zinc-900/50 p-3 text-center border-t border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase st font-medium flex items-center justify-center gap-2">
                <Lock className="w-3 h-3" /> Acceso Limitado
              </p>
            </div>
          </div>
        </div>
      )}

      {/* === GLOBAL ALERT MODAL === */}
      {showGlobalAlert && globalAlert && (
        <div className={`fixed inset-0 z-[99] flex items-center justify-center ${globalAlert.showFullScreen ? 'bg-zinc-950' : 'bg-black/80 backdrop-blur-md'} animate-in fade-in duration-300`}>
          
          <div className={`
            relative w-full mx-4 bg-zinc-900 border rounded-2xl shadow-2xl overflow-hidden
            ${globalAlert.showFullScreen ? 'max-w-2xl border-zinc-800' : 'max-w-lg border-zinc-800'}
            ${ALERT_STYLES[globalAlert.type].shadow}
          `}>
            {/* Type-based Accent Line */}
            <div className={`absolute top-0 left-0 w-1 h-full ${ALERT_STYLES[globalAlert.type].bg.replace('/10', '')}`} />

            <div className="p-8">
              <div className="flex flex-col items-center text-center">
                
                {/* Dynamic Icon */}
                <div className={`mb-6 p-4 rounded-2xl ${ALERT_STYLES[globalAlert.type].bg} ${ALERT_STYLES[globalAlert.type].border} border`}>
                  {(() => {
                    const Icon = ALERT_STYLES[globalAlert.type].icon;
                    return <Icon className={`w-8 h-8 ${ALERT_STYLES[globalAlert.type].color}`} />;
                  })()}
                </div>

                <h2 className="text-xl font-bold text-zinc-50 mb-2">
                  {globalAlert.title}
                </h2>
                
                <div className="text-zinc-400 text-sm leading-relaxed mb-8 whitespace-pre-wrap max-w-md">
                  {globalAlert.message}
                </div>

                {globalAlert.requireAcknowledge ? (
                  <button
                    onClick={acknowledgeAlert}
                    className={`
                      px-8 py-2.5 rounded-xl text-sm font-bold uppercase  transition-all shadow-lg
                      ${ALERT_STYLES[globalAlert.type].button}
                    `}
                  >
                    Confirmar Lectura
                  </button>
                ) : (
                  <button
                    onClick={acknowledgeAlert}
                    className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === WARNINGS TOASTS (Top Right) === */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {showWarnings && warnings && warnings.length > 0 && warnings.map((warning, index) => (
          <div
            key={index}
            className="pointer-events-auto flex items-start gap-3 w-80 p-4 bg-zinc-900/90 backdrop-blur-md border border-amber-500/20 rounded-xl shadow-2xl shadow-black/50 animate-in slide-in-from-right-full fade-in duration-300"
          >
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-amber-500 uppercase  mb-1">Advertencia</h4>
              <p className="text-sm text-zinc-300 leading-snug">
                {warning}
              </p>
            </div>
            <button
              onClick={() => setShowWarnings(false)}
              className="text-zinc-500 hover:text-zinc-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}