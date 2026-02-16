import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { usePermissionStore } from "../stores/permissionStore";
import { usePolicyStore } from "../stores/policyStore";
import {
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Send,
  QrCode,
  X,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// Helper to generate device fingerprint
// Get or create a persistent random device ID
// In incognito mode or after clearing cookies, a NEW id is generated
// which ensures the fingerprint is unique per storage context
const getOrCreateDeviceId = (): string => {
  const KEY = "trelk_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    id = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // localStorage not available (incognito in some browsers)
    }
  }
  return id;
};

const getDeviceFingerprint = async (): Promise<string> => {
  const deviceId = getOrCreateDeviceId();
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceId, // unique per browser storage context
  ].join("|");

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Also store for QR polling
  try {
    localStorage.setItem("deviceFingerprint", fingerprint);
  } catch {
    // ignore
  }
  return fingerprint;
};

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

  // QR Login state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [qrStatus, setQrStatus] = useState<
    | "loading"
    | "pending"
    | "scanned"
    | "approved"
    | "rejected"
    | "expired"
    | "error"
  >("loading");
  const [qrRemainingSeconds, setQrRemainingSeconds] = useState(60);
  const [qrAgentName, setQrAgentName] = useState("");
  const [qrError, setQrError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const deviceFingerprint = await getDeviceFingerprint();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceFingerprint }),
        credentials: "include",
      });

      const data = await res.json();

      if (data.ok) {
        // Check if MFA is required
        if (data.mfaRequired) {
          // Redirect to MFA verification page with state
          navigate("/mfa-verify", {
            state: {
              loginToken: data.mfaLoginToken,
              expiresIn: data.mfaExpiresIn || 120,
              email: email,
              // Multi-method MFA fields
              availableMethods: data.mfaAvailableMethods || ["telegram"],
              preferredMethod: data.mfaPreferredMethod,
              selectedMethod: data.mfaSelectedMethod,
              // New: indicates user needs to select method first (no code sent yet)
              pendingMethodSelection: data.mfaPendingMethodSelection || false,
            },
            replace: true,
          });
          return;
        }

        // Normal login - update auth store
        useAuthStore.setState({
          agent: data.agent,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
          forcePasswordChange: data.forcePasswordChange || false,
        });

        // Store permissions from login response
        if (data.permissions) {
          usePermissionStore
            .getState()
            .setPermissions(
              data.permissions,
              data.agent?.permissionVersion || 1,
            );
        }

        // Store policy results
        usePolicyStore.getState().setLoginPolicyResults({
          redirect: data.redirect,
          profileIncomplete: data.profileIncomplete,
          globalAlert: data.globalAlert,
          policyAcceptanceRequired: data.policyAcceptanceRequired,
          readOnlyMode: data.readOnlyMode,
          maintenanceMode: data.maintenanceMode,
          maintenanceMessage: data.maintenanceMessage,
          warnings: data.warnings,
        });

        // Redirect based on password change requirement or policy redirect
        if (data.forcePasswordChange) {
          navigate("/force-change-password", { replace: true });
        } else if (data.redirect) {
          // Use policy-defined redirect
          navigate(data.redirect, { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        setError(data.error || "Credenciales inválidas");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);

    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();

      if (data.ok) {
        setForgotSuccess(true);
      } else {
        setForgotError(data.error || "Error al procesar la solicitud");
      }
    } catch {
      setForgotError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail("");
    setForgotSuccess(false);
    setForgotError("");
  };

  // ============= QR LOGIN FUNCTIONS =============

  const startQRLogin = async () => {
    setShowQRModal(true);
    setQrStatus("loading");
    setQrError("");
    setQrAgentName("");

    try {
      const res = await fetch("/api/auth/qr/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          deviceFingerprint: await getDeviceFingerprint(),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setQrToken(data.token);
        setQrUrl(data.qrUrl);
        setQrRemainingSeconds(data.expiresIn || 60);
        setQrStatus("pending");
        startPolling(data.token);
        startCountdown();
      } else {
        setQrError(data.error || "Error al generar código QR");
        setQrStatus("error");
      }
    } catch {
      setQrError("Error de conexión. Inténtalo de nuevo.");
      setQrStatus("error");
    }
  };

  const startPolling = (token: string) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    const deviceFingerprint = localStorage.getItem("deviceFingerprint") || "";

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/auth/qr/status/${token}?deviceFingerprint=${deviceFingerprint}`,
          {
            credentials: "include",
          },
        );

        const data = await res.json();

        if (!data.ok) {
          setQrError(data.error || "Error al verificar estado");
          setQrStatus("error");
          stopPolling();
          return;
        }

        // Update agent name when scanned
        if (data.agentName) {
          setQrAgentName(data.agentName);
        }

        // Update remaining seconds
        if (data.remainingSeconds !== undefined) {
          setQrRemainingSeconds(data.remainingSeconds);
        }

        setQrStatus(data.status);

        // Handle terminal states
        if (data.status === "approved") {
          stopPolling();
          stopCountdown();

          // Check if MFA is required after QR approval
          if (data.mfaRequired && data.mfaLoginToken) {
            setTimeout(() => {
              navigate("/mfa-verify", {
                state: {
                  loginToken: data.mfaLoginToken,
                  methods: data.mfaMethods || ['telegram'],
                  agentName: data.agentName,
                  fromQR: true,
                },
                replace: true,
              });
            }, 500);
            return;
          }

          if (!data.agent) return;

          // Update auth store
          useAuthStore.setState({
            agent: data.agent,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
            forcePasswordChange: data.forcePasswordChange || false,
          });

          // Store permissions
          if (data.permissions) {
            usePermissionStore
              .getState()
              .setPermissions(
                data.permissions,
                data.agent?.permissionVersion || 1,
              );
          }

          // Brief delay to show success state
          setTimeout(() => {
            if (data.forcePasswordChange) {
              navigate("/force-change-password", { replace: true });
            } else {
              navigate("/dashboard", { replace: true });
            }
          }, 1000);
        } else if (data.status === "rejected") {
          stopPolling();
          stopCountdown();
        } else if (data.status === "expired") {
          stopPolling();
          stopCountdown();
        }
      } catch {
        // Silently ignore polling errors, will retry
      }
    }, 2500); // Poll every 2.5 seconds
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    countdownRef.current = setInterval(() => {
      setQrRemainingSeconds((prev) => {
        if (prev <= 1) {
          stopCountdown();
          setQrStatus("expired");
          stopPolling();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const closeQRModal = () => {
    stopPolling();
    stopCountdown();
    setShowQRModal(false);
    setQrToken("");
    setQrUrl("");
    setQrStatus("loading");
    setQrError("");
    setQrAgentName("");
  };

  const regenerateQR = () => {
    stopPolling();
    stopCountdown();
    startQRLogin();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      stopCountdown();
    };
  }, []);

  const parseRemainingSeconds = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Logo Section */}

        {/* Login Card */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center">
              <img
                src="/assets/img/logo-dark.png"
                alt="Trelk Logo"
                className="h-20 w-auto"
              />
            </div>
            {!showForgotPassword && (
              <>
                <h1 className="text-3xl font-bold text-zinc-50 tracking-tight mb-2">
                  Bienvenido de nuevo
                </h1>
                <p className="text-zinc-400 text-sm">
                  Ingresa a tu cuenta de agente para continuar
                </p>
              </>
            )}
          </div>
          {/* Forgot Password View */}
          {showForgotPassword ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {forgotSuccess ? (
                // Success State
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-50 mb-2">
                    ¡Solicitud enviada!
                  </h3>
                  <p className="text-zinc-400 text-sm mb-6">
                    Si tu correo está registrado, recibirás un enlace de
                    recuperación en tu Telegram vinculado.
                  </p>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                    <p className="text-amber-300 text-xs">
                      <strong>Nota:</strong> El enlace expirará en 15 minutos.
                      Asegúrate de revisar tu Telegram.
                    </p>
                  </div>
                  <button
                    onClick={resetForgotPassword}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-50 font-medium rounded-xl transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                // Request Form
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-500/20 rounded-full mb-4">
                      <KeyRound className="w-7 h-7 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-zinc-50 mb-2">
                      ¿Olvidaste tu contraseña?
                    </h3>
                    <p className="text-zinc-400 text-sm">
                      Ingresa tu correo y te enviaremos un enlace de
                      recuperación a tu Telegram.
                    </p>
                  </div>

                  {/* Error Message */}
                  {forgotError && (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in slide-in-from-top-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{forgotError}</span>
                    </div>
                  )}

                  {/* Email Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="forgot-email"
                      className="block text-xs font-bold text-zinc-500 pl-1"
                    >
                      Correo Electrónico
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="tu-correo@trelk.com"
                        required
                        autoFocus
                        className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-zinc-50 font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Enviar enlace de recuperación</span>
                      </>
                    )}
                  </button>

                  {/* Back Link */}
                  <button
                    type="button"
                    onClick={resetForgotPassword}
                    className="w-full flex items-center justify-center gap-2 py-3 text-zinc-400 hover:text-zinc-50 text-sm transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </form>
              )}
            </div>
          ) : (
            // Login Form
            <form
              onSubmit={handleSubmit}
              className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300"
            >
              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-xs font-bold text-zinc-500 uppercasepl-1"
                >
                  Correo Electrónico
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@trelk.com"
                    required
                    className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pl-1">
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold text-zinc-500 "
                  >
                    Contraseña
                  </label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-zinc-50 font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Forgot Password Link */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Quick Methods Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900/40 px-3 text-zinc-500">
                    Métodos rápidos
                  </span>
                </div>
              </div>

              {/* QR Login Button */}
              <button
                type="button"
                onClick={startQRLogin}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-300 hover:text-zinc-50 font-medium rounded-xl transition-all group"
              >
                <QrCode className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300" />
                <span>Iniciar sesión con Telegram</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs mt-8">
          © {new Date().getFullYear()} Trelk Support Platform v2.4.0
        </p>
      </div>
      {/* QR Login Modal - Premium Zinc Style */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={closeQRModal}
          />

          {/* Modal Card */}
          <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Close button */}
            <button
              onClick={closeQRModal}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-50 rounded-xl hover:bg-zinc-800 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Content */}
            <div className="overflow-y-auto p-6 scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-5 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]">
                  <Smartphone className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-50 tracking-tight mb-2">
                  Iniciar sesión con Telegram
                </h3>
                <p className="text-zinc-400 text-sm max-w-[260px] mx-auto leading-relaxed">
                  Escanea el código QR con tu cámara para acceder
                  instantáneamente.
                </p>
              </div>

              {/* QR Content Area */}
              <div className="flex flex-col items-center justify-center min-h-[220px]">
                {/* 1. Loading State */}
                {qrStatus === "loading" && (
                  <div className="w-56 h-56 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                    <span className="text-xs font-bold text-zinc-500 uppercase st animate-pulse">
                      Generando QR...
                    </span>
                  </div>
                )}

                {/* 2. Pending (Show QR) */}
                {qrStatus === "pending" && qrUrl && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">
                    <div className="p-3 bg-white rounded-2xl shadow-xl ring-4 ring-white/5 mb-6">
                      <QRCodeSVG
                        value={qrUrl}
                        size={180}
                        level="M"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#09090b" // Zinc-950
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-xs text-zinc-400 font-medium">
                        Expira en{" "}
                        <span className="text-zinc-200 font-mono font-bold tab-nums">
                          {parseRemainingSeconds(qrRemainingSeconds)}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Scanned State */}
                {qrStatus === "scanned" && (
                  <div className="w-64 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                    <div className="relative w-20 h-20 flex items-center justify-center mb-4">
                      <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-full animate-ping" />
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/50">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      </div>
                    </div>
                    <p className="text-lg font-bold text-zinc-50">
                      {qrAgentName ? `¡Hola, ${qrAgentName}!` : "QR Detectado"}
                    </p>
                    <p className="text-sm text-indigo-300/80 mt-1">
                      Por favor confirma el inicio de sesión en tu
                      dispositivo...
                    </p>
                  </div>
                )}

                {/* 4. Approved State */}
                {qrStatus === "approved" && (
                  <div className="w-64 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <p className="text-lg font-bold text-zinc-50">
                      ¡Acceso Autorizado!
                    </p>
                    <p className="text-sm text-zinc-400 mt-1">
                      Redirigiendo al panel...
                    </p>
                  </div>
                )}

                {/* 5. Error/Rejected/Expired States */}
                {(qrStatus === "rejected" ||
                  qrStatus === "expired" ||
                  qrStatus === "error") && (
                  <div className="w-64 flex flex-col items-center justify-center text-center animate-in shake">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                        qrStatus === "expired"
                          ? "bg-zinc-900 border border-zinc-800 text-zinc-400"
                          : "bg-red-500/10 border border-red-500/20 text-red-400"
                      }`}
                    >
                      {qrStatus === "expired" ? (
                        <RefreshCw className="w-8 h-8" />
                      ) : (
                        <X className="w-8 h-8" />
                      )}
                    </div>

                    <p className="text-base font-bold text-zinc-200">
                      {qrStatus === "expired"
                        ? "Código Expirado"
                        : "Acceso Denegado"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 mb-6 leading-relaxed px-4">
                      {qrStatus === "expired"
                        ? "El código QR ha caducado por seguridad."
                        : qrError ||
                          "La solicitud fue rechazada o ocurrió un error."}
                    </p>

                    <button
                      onClick={regenerateQR}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" /> Generar Nuevo
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions Footer */}
              {(qrStatus === "pending" || qrStatus === "loading") && (
                <div className="mt-5 pt-4 border-t border-zinc-800/50">
                  <p className="text-zinc-500 text-xs font-bold uppercase r mb-4 text-center">
                    Pasos a seguir
                  </p>
                  <div className="space-y-3">
                    {[
                      {
                        step: 1,
                        text: "Abre la cámara de tu teléfono y escanea el código QR",
                      },
                      {
                        step: 2,
                        text: "Toca el enlace que aparece para abrir Telegram",
                      },
                      {
                        step: 3,
                        text: "Presiona 'Confirmar' en el mensaje que recibirás",
                      },
                    ].map((item) => (
                      <div
                        key={item.step}
                        className="flex items-start gap-3 p-2 rounded-xl hover:bg-zinc-900/50 transition-colors"
                      >
                        <span className="flex-shrink-0 w-6 h-6 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-bold flex items-center justify-center mt-0.5">
                          {item.step}
                        </span>
                        <span className="text-sm text-zinc-400 leading-tight">
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* o BUTTON con click DIRECT, crear */}
              

              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
