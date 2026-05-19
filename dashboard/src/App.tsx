// Trelk Support Dashboard - Main App
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { FlowsPage } from './components/flows';
import { ToastContainer } from './components/ui';
import { ThemeProvider } from './components/ThemeProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PolicyAlertsProvider } from './components/PolicyAlertsProvider';
import './index.css';

// ─── Auth pages (small, eager-load) ────────────────────────────────────────
import LoginPage from './pages/LoginPage';
import MFAVerifyPage from './pages/MFAVerifyPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForceChangePasswordPage from './pages/ForceChangePasswordPage';

// ─── Layout (shared shell, eager-load) ─────────────────────────────────────
import DashboardLayout from './pages/DashboardLayout';

// ─── Feature pages (lazy-load for code splitting) ──────────────────────────
const OverviewPage             = lazy(() => import('./pages/OverviewPage'));
const ChatPage                 = lazy(() => import('./pages/ChatPage'));
const AgentsPage               = lazy(() => import('./pages/AgentsPage'));
const SettingsPage             = lazy(() => import('./pages/SettingsPage'));
const SavedRepliesPage         = lazy(() => import('./pages/SavedRepliesPage'));
const SupervisorPage           = lazy(() => import('./pages/SupervisorPage'));
const AuditPage                = lazy(() => import('./pages/AuditPage'));
const ExportsPage              = lazy(() => import('./pages/ExportsPage'));
const MySettingsPage           = lazy(() => import('./pages/MySettingsPage'));
const CustomFieldsPage         = lazy(() => import('./pages/CustomFieldsPage'));
const SystemPage               = lazy(() => import('./pages/SystemPage'));
const SystemControlPage        = lazy(() => import('./pages/SystemControlPage'));
const TextsPage                = lazy(() => import('./pages/TextsPage'));
const ContactsPage             = lazy(() => import('./pages/ContactsPage'));
const BroadcastPage            = lazy(() => import('./pages/BroadcastPage'));
const InternalBroadcastsPage   = lazy(() => import('./pages/BroadcastsPage'));
const PermissionsPage          = lazy(() => import('./pages/PermissionsPage'));
const LiveChatPage             = lazy(() => import('./pages/LiveChatPage'));
const AgentRulesPage           = lazy(() => import('./pages/AgentRulesPage'));
const DispositionsPage         = lazy(() => import('./pages/DispositionsPage'));
const MediaPage                = lazy(() => import('./pages/MediaPage'));
const QAPage                   = lazy(() => import('./pages/QAPage'));
const PlaybooksPage            = lazy(() => import('./pages/PlaybooksPage'));
const TranslationSettingsPage  = lazy(() => import('./pages/TranslationSettingsPage'));
const WallboardPage            = lazy(() => import('./pages/WallboardPage'));
const AgentEnginePage          = lazy(() => import('./pages/AgentEnginePage'));

// ─── Helpers ────────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-64 text-zinc-500">
      <div className="animate-spin w-6 h-6 border-2 border-zinc-600 border-t-transparent rounded-full" />
    </div>
  );
}

function ChatRedirect() {
  const { sessionId } = useParams();
  const location = useLocation();
  return <Navigate to={`/chat?session=${sessionId}${location.hash}`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Public ───────────────────────────────────────────────── */}
            <Route path="/login"                  element={<LoginPage />} />
            <Route path="/mfa-verify"             element={<MFAVerifyPage />} />
            <Route path="/reset-password"         element={<ResetPasswordPage />} />
            <Route path="/force-change-password"  element={<ForceChangePasswordPage />} />
            {/* legacy deep-link redirect */}
            <Route path="/chat/:sessionId"        element={<ChatRedirect />} />

            {/* ── Protected shell ──────────────────────────────────────── */}
            <Route path="/" element={<DashboardLayout />}>
              <Route path="dashboard" element={<OverviewPage />} />

              <Route path="chat" element={
                <ProtectedRoute permission="chats.read"><ChatPage /></ProtectedRoute>
              } />
              <Route path="supervisor" element={
                <ProtectedRoute permission="supervisor.monitor"><SupervisorPage /></ProtectedRoute>
              } />
              <Route path="audit" element={
                <ProtectedRoute permission="system.audit"><AuditPage /></ProtectedRoute>
              } />
              <Route path="exports" element={
                <ProtectedRoute permission="exports.create"><ExportsPage /></ProtectedRoute>
              } />
              <Route path="saved-replies" element={
                <ProtectedRoute permission="replies.read"><SavedRepliesPage /></ProtectedRoute>
              } />
              <Route path="agents" element={
                <ProtectedRoute permission="agents.read"><AgentsPage /></ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute permission="settings.read"><SettingsPage /></ProtectedRoute>
              } />
              <Route path="my-settings"     element={<MySettingsPage />} />
              <Route path="my-settings/:tab" element={<MySettingsPage />} />
              <Route path="flows" element={
                <ProtectedRoute permission="flows.read"><FlowsPage /></ProtectedRoute>
              } />
              <Route path="flows/:flowId" element={
                <ProtectedRoute permission="flows.read"><FlowsPage /></ProtectedRoute>
              } />
              <Route path="custom-fields" element={
                <ProtectedRoute permission="customFields.read"><CustomFieldsPage /></ProtectedRoute>
              } />
              <Route path="system" element={
                <ProtectedRoute permission="system.read"><SystemPage /></ProtectedRoute>
              } />
              <Route path="system-control" element={
                <ProtectedRoute permission="system.manage"><SystemControlPage /></ProtectedRoute>
              } />
              <Route path="texts" element={
                <ProtectedRoute permission="settings.write"><TextsPage /></ProtectedRoute>
              } />
              <Route path="contacts" element={
                <ProtectedRoute permission="contacts.read"><ContactsPage /></ProtectedRoute>
              } />
              <Route path="broadcast" element={
                <ProtectedRoute permission="broadcasts.read"><BroadcastPage /></ProtectedRoute>
              } />
              <Route path="internal-broadcasts" element={
                <ProtectedRoute permission="system.admin"><InternalBroadcastsPage /></ProtectedRoute>
              } />
              <Route path="permissions" element={
                <ProtectedRoute permission="agents.permissions"><PermissionsPage /></ProtectedRoute>
              } />
              <Route path="live-chat" element={
                <ProtectedRoute permission="settings.read"><LiveChatPage /></ProtectedRoute>
              } />
              <Route path="agent-rules" element={
                <ProtectedRoute permission="settings.read"><AgentRulesPage /></ProtectedRoute>
              } />
              <Route path="dispositions" element={
                <ProtectedRoute permission="settings.read"><DispositionsPage /></ProtectedRoute>
              } />
              <Route path="media" element={
                <ProtectedRoute permission="system.manage"><MediaPage /></ProtectedRoute>
              } />
              <Route path="qa" element={
                <ProtectedRoute permission="supervisor.monitor"><QAPage /></ProtectedRoute>
              } />
              <Route path="playbooks" element={
                <ProtectedRoute permission="playbooks.read"><PlaybooksPage /></ProtectedRoute>
              } />
              <Route path="translation" element={
                <ProtectedRoute permission="settings.read"><TranslationSettingsPage /></ProtectedRoute>
              } />
              <Route path="wallboard" element={
                <ProtectedRoute permission="supervisor.monitor"><WallboardPage /></ProtectedRoute>
              } />
              <Route path="agent-engine" element={
                <ProtectedRoute permission="settings.read"><AgentEnginePage /></ProtectedRoute>
              } />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>

        <PolicyAlertsProvider><></></PolicyAlertsProvider>
        <ToastContainer />
      </BrowserRouter>
    </ThemeProvider>
  );
}
