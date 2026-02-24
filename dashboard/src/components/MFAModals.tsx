/**
 * MFAModals - Premium Zinc Refactor
 * High-fidelity setup flows for Telegram and TOTP Multi-Factor Authentication.
 */

import { useState, useEffect, useRef } from "react";
import {
  Shield, Smartphone, Loader2, Check, AlertTriangle, RefreshCw,
  Clock, Send, Key, ShieldCheck, AlertCircle, QrCode, Copy, Eye, EyeOff, Download, ArrowRight
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";

// ==================== SHARED UTILITIES ====================

const getDeviceFingerprint = async (): Promise<string> => {
  const data = [
    navigator.userAgent, navigator.language,
    screen.width + "x" + screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const downloadBackupCodes = (codes: string[]) => {
  const content = [
    "===========================================",
    "  TRELK SUPPORT",
    "  CÓDIGOS DE RESPALDO - MFA",
    "  Generados: " + new Date().toLocaleString(),
    "===========================================",
    "",
    "Guarda estos códigos en un lugar seguro.",
    "Cada código solo puede usarse UNA vez.",
    "No compartas estos códigos con nadie.",
    "",
    "-------------------------------------------",
    ...codes.map((code, i) => `  ${i + 1}. ${code}`),
    "-------------------------------------------",
    "",
    "⚠️ Si pierdes acceso a tu app autenticadora,",
    "necesitarás estos códigos para ingresar.",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-codes-${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ==================== MODAL WRAPPER ====================

export function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-130 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {children}
      </div>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < currentStep
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/20 ring-offset-2 ring-offset-zinc-950"
                : i === currentStep
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/20 ring-offset-2 ring-offset-zinc-950"
                  : "bg-zinc-900 border border-zinc-700 text-zinc-500"
            }`}
          >
            {i < currentStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div className={`w-8 h-0.5 rounded-full transition-colors duration-300 ${i < currentStep ? "bg-emerald-500/50" : "bg-zinc-800"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== TELEGRAM MFA MODAL ====================

export function TelegramMFAModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const updateAgentFields = useAuthStore((s) => s.updateAgentFields);

  const [step, setStep] = useState(0); // 0: info, 1: verify
  const [loginToken, setLoginToken] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setStep(0); setLoginToken(""); setCode(["", "", "", "", "", ""]); setError(""); setTimeLeft(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (step === 1 && isOpen) setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [step, isOpen]);

  const startActivation = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/mfa/activate/start", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setLoginToken(data.loginToken); setTimeLeft(data.expiresIn || 120); setStep(1);
      } else { setError(data.error || "Error al iniciar activación"); }
    } catch { setError("Error de conexión"); } 
    finally { setLoading(false); }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode); setError("");

    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newCode.every((d) => d) && newCode.join("").length === 6) verifyCode(newCode.join(""));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (index: number, e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData("Text").trim();
    if (!/^\d+$/.test(pasteData)) return;
    const digits = pasteData.split("");
    const newCode = [...code];
    for (let i = 0; i < digits.length; i++) {
      if (index + i < 6) newCode[index + i] = digits[i];
    }
    setCode(newCode);
    inputRefs.current[Math.min(5, index + digits.length - 1)]?.focus();
    e.preventDefault();
    if (newCode.every((d) => d) && newCode.join("").length === 6) verifyCode(newCode.join(""));
  };

  const verifyCode = async (codeString?: string) => {
    const fullCode = codeString || code.join("");
    if (fullCode.length !== 6) return;

    setLoading(true); setError("");
    try {
      const fingerprint = await getDeviceFingerprint();
      const res = await fetch("/api/auth/mfa/activate/complete", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ loginToken, code: fullCode, trustDevice: true, deviceFingerprint: fingerprint }),
      });
      const data = await res.json();
      if (data.ok) {
        updateAgentFields({ mfaEnabled: true }); onSuccess(); onClose();
      } else {
        setError(data.error || "Código incorrecto"); setCode(["", "", "", "", "", ""]); inputRefs.current[0]?.focus();
      }
    } catch { setError("Error de conexión"); } 
    finally { setLoading(false); }
  };

  const resendCode = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/activate/start", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setLoginToken(data.loginToken); setTimeLeft(data.expiresIn || 120); setCode(["", "", "", "", "", ""]); inputRefs.current[0]?.focus();
      } else { setError(data.error || "Error al reenviar"); }
    } catch { setError("Error de conexión"); } 
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <StepIndicator currentStep={step} totalSteps={2} />

      <div className="p-8">
        {/* STEP 0: Info */}
        {step === 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <div className="relative mx-auto w-16 h-16 mb-5">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative w-full h-full bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-xl">
                  <Send className="w-8 h-8 text-blue-500 translate-x-0.5 -translate-y-0.5" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">Telegram MFA</h3>
              <p className="text-sm text-zinc-400">Recibe códigos de seguridad directamente en tu cuenta de Telegram.</p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">¿Cómo funciona?</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-zinc-300">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">1</div>
                  <span>Inicias sesión en Trelk Support.</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-zinc-300">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">2</div>
                  <span>Te enviamos un código de 6 dígitos a tu Telegram.</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-zinc-300">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">3</div>
                  <span>Ingresas el código para acceder (válido por 2 min).</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={startActivation} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Configurar Ahora <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Verify */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-lg mb-4">
                <Key className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">Verifica tu Identidad</h3>
              <p className="text-sm text-zinc-400">Ingresa el código que enviamos a tu Telegram.</p>
            </div>

            <div className="flex justify-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold transition-colors ${timeLeft < 30 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                <Clock className="w-3.5 h-3.5" />
                {timeLeft > 0 ? formatTime(timeLeft) : "Código Expirado"}
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex justify-center gap-2 sm:gap-3">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handlePaste(index, e)}
                  disabled={loading || timeLeft === 0}
                  className={`
                    w-12 h-14 text-center text-xl font-black rounded-xl border-2 transition-all outline-none
                    ${digit ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "border-zinc-800 bg-zinc-900 text-white"}
                    ${loading || timeLeft === 0 ? "opacity-50 cursor-not-allowed" : "focus:border-indigo-500 focus:bg-indigo-500/5 focus:ring-4 focus:ring-indigo-500/10"}
                  `}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={resendCode} disabled={loading || timeLeft > 90} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Reenviar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ==================== TOTP MFA MODAL ====================

interface TOTPSetupData {
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
}

export function TOTPMFAModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const updateAgentFields = useAuthStore((s) => s.updateAgentFields);

  const [step, setStep] = useState(0); // 0: info, 1: qr, 2: verify, 3: backup
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setStep(0); setSetupData(null); setCode(["", "", "", "", "", ""]); setError(""); setShowSecret(false); setSecretCopied(false); setBackupCodesCopied(false);
    }
  }, [isOpen]);

  useEffect(() => { if (step === 2 && isOpen) setTimeout(() => inputRefs.current[0]?.focus(), 100); }, [step, isOpen]);

  const startSetup = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/mfa/totp/setup", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setSetupData({ secret: data.secret, qrCodeUri: data.qrCodeUri, backupCodes: data.backupCodes });
        setStep(1);
      } else { setError(data.error || "Error al iniciar configuración"); }
    } catch { setError("Error de conexión"); } 
    finally { setLoading(false); }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode); setError("");
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newCode.every((d) => d) && newCode.join("").length === 6) verifyCode(newCode.join(""));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleCodePaste = (index: number, e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData("Text").trim();
    if (!/^\d+$/.test(pasteData)) return;
    const digits = pasteData.split("");
    const newCode = [...code];
    for (let i = 0; i < digits.length; i++) {
      if (index + i < 6) newCode[index + i] = digits[i];
    }
    setCode(newCode);
    inputRefs.current[Math.min(5, index + digits.length - 1)]?.focus();
    e.preventDefault();
    if (newCode.every((d) => d) && newCode.join("").length === 6) verifyCode(newCode.join(""));
  };

  const verifyCode = async (codeString?: string) => {
    const fullCode = codeString || code.join("");
    if (fullCode.length !== 6) return;

    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/mfa/totp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ code: fullCode }),
      });
      const data = await res.json();
      if (data.ok) {
        updateAgentFields({ mfaEnabled: true }); setStep(3);
      } else {
        setError(data.error || "Código incorrecto"); setCode(["", "", "", "", "", ""]); inputRefs.current[0]?.focus();
      }
    } catch { setError("Error de conexión"); } 
    finally { setLoading(false); }
  };

  const copySecret = async () => {
    if (!setupData?.secret) return;
    try { await navigator.clipboard.writeText(setupData.secret); setSecretCopied(true); setTimeout(() => setSecretCopied(false), 2000); } catch {}
  };

  const copyBackupCodes = async () => {
    if (!setupData?.backupCodes) return;
    try { await navigator.clipboard.writeText(setupData.backupCodes.join("\n")); setBackupCodesCopied(true); setTimeout(() => setBackupCodesCopied(false), 2000); } catch {}
  };

  const finishSetup = () => { onSuccess(); onClose(); };
  const handleClose = () => { if (step === 3) { finishSetup(); } else { onClose(); } };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <StepIndicator currentStep={step} totalSteps={4} />

      <div className="p-8">
        {/* STEP 0: Info */}
        {step === 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <div className="relative mx-auto w-16 h-16 mb-5">
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative w-full h-full bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-xl">
                  <Smartphone className="w-8 h-8 text-purple-500" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">App Autenticadora</h3>
              <p className="text-sm text-zinc-400">Google Authenticator, Authy, 1Password u otra app compatible.</p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ventajas Clave</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" /> <span>Funciona sin conexión a internet.</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" /> <span>Genera códigos de respaldo para emergencias.</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" /> <span>Máximo nivel de seguridad estándar.</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={startSetup} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuar <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Scan QR */}
        {step === 1 && setupData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">Escanea el Código QR</h3>
              <p className="text-sm text-zinc-400">Abre tu app autenticadora y escanea esta imagen.</p>
            </div>

            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-2xl shadow-xl ring-1 ring-white/20">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.qrCodeUri)}`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">¿No puedes escanear?</p>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 p-1.5 rounded-lg">
                <code className={`flex-1 px-3 py-2 text-sm font-mono text-center tracking-wider ${showSecret ? "text-indigo-400" : "text-transparent bg-zinc-800 rounded"}`}>
                  {showSecret ? setupData.secret : "••••••••••••••••"}
                </code>
                <button onClick={() => setShowSecret(!showSecret)} className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors" title="Mostrar secreto">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={copySecret} className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors" title="Copiar secreto">
                  {secretCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={() => setStep(2)} className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all">
                Siguiente Paso
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Verify Code */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-lg mb-4">
                <Key className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">Ingresa el Código</h3>
              <p className="text-sm text-zinc-400">Revisa tu app autenticadora e ingresa los 6 dígitos generados.</p>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex justify-center gap-2 sm:gap-3">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handleCodePaste(index, e)}
                  disabled={loading}
                  autoComplete="one-time-code"
                  className={`
                    w-12 h-14 text-center text-xl font-black rounded-xl border-2 transition-all outline-none
                    ${digit ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "border-zinc-800 bg-zinc-900 text-white"}
                    ${loading ? "opacity-50 cursor-not-allowed" : "focus:border-indigo-500 focus:bg-indigo-500/5 focus:ring-4 focus:ring-indigo-500/10"}
                  `}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold rounded-xl transition-colors">
                Atrás
              </button>
              <button onClick={() => verifyCode()} disabled={loading || code.join("").length !== 6} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Backup Codes */}
        {step === 3 && setupData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <div className="relative mx-auto w-16 h-16 mb-5">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative w-full h-full bg-zinc-900 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-xl">
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">¡Configuración Exitosa!</h3>
              <p className="text-sm text-zinc-400">Guarda estos códigos de recuperación en un lugar seguro y secreto.</p>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/90 leading-relaxed">
                <strong>CRÍTICO:</strong> Si pierdes acceso a tu teléfono o app, esta será la única forma de acceder a tu cuenta. Cada código es de un solo uso.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-zinc-800/50 bg-zinc-900/50">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Códigos de Respaldo</span>
                <div className="flex items-center gap-1">
                  <button onClick={copyBackupCodes} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                    {backupCodesCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {backupCodesCopied ? "Copiados" : "Copiar"}
                  </button>
                  <button onClick={() => downloadBackupCodes(setupData.backupCodes)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </button>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {setupData.backupCodes.map((codeItem, i) => (
                  <code key={i} className="px-3 py-2 bg-zinc-950 border border-zinc-800/80 rounded-lg text-sm font-mono text-zinc-300 text-center tracking-widest shadow-inner">
                    {codeItem}
                  </code>
                ))}
              </div>
            </div>

            <button onClick={finishSetup} className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0">
              Entendido, ya los guardé de forma segura
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}