/**
 * MFAModals - Reusable MFA setup modals for Telegram and TOTP
 * Used in both MySettingsPage and MFASetupRequired
 */

import { useState, useEffect, useRef } from "react";
import {
  Shield,
  Smartphone,
  Loader2,
  Check,
  AlertTriangle,
  RefreshCw,
  Clock,
  Send,
  Key,
  ShieldCheck,
  AlertCircle,
  QrCode,
  Copy,
  Eye,
  EyeOff,
  Download,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";

// ==================== SHARED UTILITIES ====================

// Get device fingerprint
const getDeviceFingerprint = async (): Promise<string> => {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Format time for countdown
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Download backup codes
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

export function Modal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

// Step indicator component
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-zinc-800">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              i < currentStep
                ? "bg-emerald-500 text-white"
                : i === currentStep
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={`w-8 h-0.5 ${i < currentStep ? "bg-emerald-500" : "bg-zinc-700"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== TELEGRAM MFA MODAL ====================

interface TelegramMFAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TelegramMFAModal({
  isOpen,
  onClose,
  onSuccess,
}: TelegramMFAModalProps) {
  const updateAgentFields = useAuthStore((s) => s.updateAgentFields);

  const [step, setStep] = useState(0); // 0: info, 1: verify
  const [loginToken, setLoginToken] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setLoginToken("");
      setCode(["", "", "", "", "", ""]);
      setError("");
      setTimeLeft(0);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Focus input when step changes
  useEffect(() => {
    if (step === 1 && isOpen) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step, isOpen]);

  const startActivation = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/activate/start", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (data.ok) {
        setLoginToken(data.loginToken);
        setTimeLeft(data.expiresIn || 120);
        setStep(1);
      } else {
        setError(data.error || "Error al iniciar activación");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((d) => d) && newCode.join("").length === 6) {
      verifyCode(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData("Text").trim();
    if (!/^\d+$/.test(pasteData)) return;
    const digits = pasteData.split("");
    const newCode = [...code];
    for (let i = 0; i < digits.length; i++) {
      if (index + i < 6) {
        newCode[index + i] = digits[i];
      }
    }
    setCode(newCode);
    const nextIndex = Math.min(5, index + digits.length - 1);
    inputRefs.current[nextIndex]?.focus();
    e.preventDefault();
    if (newCode.every((d) => d) && newCode.join("").length === 6) {
      verifyCode(newCode.join(""));
    }
  };

  const verifyCode = async (codeString?: string) => {
    const fullCode = codeString || code.join("");
    if (fullCode.length !== 6) return;

    setLoading(true);
    setError("");

    try {
      const fingerprint = await getDeviceFingerprint();
      const res = await fetch("/api/auth/mfa/activate/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          loginToken,
          code: fullCode,
          trustDevice: true,
          deviceFingerprint: fingerprint,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        updateAgentFields({ mfaEnabled: true });
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Código incorrecto");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/activate/start", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (data.ok) {
        setLoginToken(data.loginToken);
        setTimeLeft(data.expiresIn || 120);
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setError(data.error || "Error al reenviar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <StepIndicator currentStep={step} totalSteps={2} />

      <div className="p-6">
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                <Send className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Configurar Telegram MFA
              </h3>
              <p className="text-sm text-zinc-400">
                Recibirás un código de 6 dígitos en tu Telegram cada vez que
                inicies sesión
              </p>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
              <h4 className="text-sm font-medium text-white mb-2">
                ¿Cómo funciona?
              </h4>
              <ul className="text-xs text-zinc-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center text-[10px] mt-0.5">
                    1
                  </span>
                  <span>
                    Al iniciar sesión, enviaremos un código a tu Telegram
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center text-[10px] mt-0.5">
                    2
                  </span>
                  <span>El código expira en 2 minutos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center text-[10px] mt-0.5">
                    3
                  </span>
                  <span>Cada código solo puede usarse una vez</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={startActivation}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Enviar Código"
                )}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                <Key className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Ingresa el Código
              </h3>
              <p className="text-sm text-zinc-400">
                Te hemos enviado un código de 6 dígitos a tu Telegram
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Clock
                className={`w-4 h-4 ${timeLeft < 30 ? "text-amber-400" : "text-zinc-400"}`}
              />
              <span
                className={`text-sm font-mono ${timeLeft < 30 ? "text-amber-400" : "text-zinc-400"}`}
              >
                {timeLeft > 0 ? formatTime(timeLeft) : "Expirado"}
              </span>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handlePaste(index, e)}
                  disabled={loading || timeLeft === 0}
                  className={`w-11 h-13 text-center text-xl font-bold rounded-lg border-2 transition-all
                    ${digit ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-800"}
                    ${loading || timeLeft === 0 ? "opacity-50" : "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"}
                    text-white outline-none`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={resendCode}
                disabled={loading || timeLeft > 90}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Reenviar
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

interface TOTPMFAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TOTPMFAModal({
  isOpen,
  onClose,
  onSuccess,
}: TOTPMFAModalProps) {
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

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setSetupData(null);
      setCode(["", "", "", "", "", ""]);
      setError("");
      setShowSecret(false);
      setSecretCopied(false);
      setBackupCodesCopied(false);
    }
  }, [isOpen]);

  // Focus input when step changes
  useEffect(() => {
    if (step === 2 && isOpen) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step, isOpen]);

  const startSetup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/totp/setup", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (data.ok) {
        setSetupData({
          secret: data.secret,
          qrCodeUri: data.qrCodeUri,
          backupCodes: data.backupCodes,
        });
        setStep(1);
      } else {
        setError(data.error || "Error al iniciar configuración");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((d) => d) && newCode.join("").length === 6) {
      verifyCode(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (codeString?: string) => {
    const fullCode = codeString || code.join("");
    if (fullCode.length !== 6) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: fullCode }),
      });

      const data = await res.json();

      if (data.ok) {
        updateAgentFields({ mfaEnabled: true });
        setStep(3); // Show backup codes
      } else {
        setError(data.error || "Código incorrecto");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    if (!setupData?.secret) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {}
  };

  const copyBackupCodes = async () => {
    if (!setupData?.backupCodes) return;
    try {
      await navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
      setBackupCodesCopied(true);
      setTimeout(() => setBackupCodesCopied(false), 2000);
    } catch {}
  };

  const finishSetup = () => {
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    if (step === 3) {
      finishSetup();
    } else {
      onClose();
    }
  };

  const handleCodePaste = (index: number, e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData("Text").trim();
    if (!/^\d+$/.test(pasteData)) return;
    const digits = pasteData.split("");
    const newCode = [...code];
    for (let i = 0; i < digits.length; i++) {
      if (index + i < 6) {
        newCode[index + i] = digits[i];
      }
    }
    setCode(newCode);
    const nextIndex = Math.min(5, index + digits.length - 1);
    inputRefs.current[nextIndex]?.focus();
    e.preventDefault();
    if (newCode.every((d) => d) && newCode.join("").length === 6) {
      verifyCode(newCode.join(""));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <StepIndicator currentStep={step} totalSteps={4} />

      <div className="p-6">
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                <QrCode className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Configurar App Autenticador
              </h3>
              <p className="text-sm text-zinc-400">
                Usa Google Authenticator, Authy, 1Password u otra app compatible
              </p>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
              <h4 className="text-sm font-medium text-white mb-2">Ventajas</h4>
              <ul className="text-xs text-zinc-400 space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Funciona sin conexión a internet</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Códigos de respaldo para emergencias</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Compatible con múltiples apps</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={startSetup}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Continuar"
                )}
              </button>
            </div>
          </div>
        )}

        {step === 1 && setupData && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-2">
                Escanea el Código QR
              </h3>
              <p className="text-sm text-zinc-400">
                Abre tu app autenticador y escanea este código
              </p>
            </div>

            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.qrCodeUri)}`}
                  alt="QR Code"
                  className="w-44 h-44"
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
              <p className="text-xs text-zinc-500 mb-2">
                ¿No puedes escanear? Ingresa manualmente:
              </p>
              <div className="flex items-center gap-2">
                <code
                  className={`flex-1 px-2 py-1.5 bg-zinc-800 rounded text-xs font-mono ${showSecret ? "text-white" : "text-transparent"}`}
                  style={{
                    textShadow: showSecret
                      ? "none"
                      : "0 0 8px rgba(255,255,255,0.5)",
                  }}
                >
                  {setupData.secret}
                </code>
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded"
                >
                  {showSecret ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={copySecret}
                  className="p-1.5 text-zinc-400 hover:text-white rounded"
                >
                  {secretCopied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors"
              >
                Ya lo escaneé
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                <Key className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Verifica la Configuración
              </h3>
              <p className="text-sm text-zinc-400">
                Ingresa el código de 6 dígitos de tu app
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handleCodePaste(index, e)}
                  disabled={loading}
                  autoComplete="one-time-code"
                  className={`w-11 h-13 text-center text-xl font-bold rounded-lg border-2 transition-all
                    ${digit ? "border-purple-500 bg-purple-500/10" : "border-zinc-700 bg-zinc-800"}
                    ${loading ? "opacity-50" : "focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"}
                    text-white outline-none`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Atrás
              </button>
              <button
                onClick={() => verifyCode()}
                disabled={loading || code.join("").length !== 6}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Verificar"
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && setupData && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-4">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                ¡Configuración Exitosa!
              </h3>
              <p className="text-sm text-zinc-400">
                Guarda estos códigos de respaldo en un lugar seguro
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">
                  Si pierdes acceso a tu app, necesitarás estos códigos. Cada
                  uno solo puede usarse una vez.
                </p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500">
                  Códigos de respaldo
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadBackupCodes(setupData.backupCodes)}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    <Download className="w-3 h-3" />
                    Descargar
                  </button>
                  <button
                    onClick={copyBackupCodes}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {backupCodesCopied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {backupCodesCopied ? "Copiados" : "Copiar"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {setupData.backupCodes.map((codeItem, i) => (
                  <code
                    key={i}
                    className="px-2 py-1.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300 text-center"
                  >
                    {codeItem}
                  </code>
                ))}
              </div>
            </div>

            <button
              onClick={finishSetup}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
            >
              Entendido, ya los guardé
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
