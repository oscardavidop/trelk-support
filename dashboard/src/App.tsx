// Trelk Support Dashboard - Main App
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForceChangePasswordPage from './pages/ForceChangePasswordPage';
import MFAVerifyPage from './pages/MFAVerifyPage';
import DashboardLayout from './pages/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import SavedRepliesPage from './pages/SavedRepliesPage';
import SupervisorPage from './pages/SupervisorPage';
import AuditPage from './pages/AuditPage';
import ExportsPage from './pages/ExportsPage';
import MySettingsPage from './pages/MySettingsPage';
import CustomFieldsPage from './pages/CustomFieldsPage';
import SystemPage from './pages/SystemPage';
import SystemControlPage from './pages/SystemControlPage';
import TextsPage from './pages/TextsPage';
import ContactsPage from './pages/ContactsPage';
import BroadcastPage from './pages/BroadcastPage';
import InternalBroadcastsPage from './pages/BroadcastsPage';
import PermissionsPage from './pages/PermissionsPage';
import LiveChatPage from './pages/LiveChatPage';
import AgentRulesPage from './pages/AgentRulesPage';
import DispositionsPage from './pages/DispositionsPage';
import MediaPage from './pages/MediaPage';
import QAPage from './pages/QAPage';
import PlaybooksPage from './pages/PlaybooksPage';
import TranslationSettingsPage from './pages/TranslationSettingsPage';
import WallboardPage from './pages/WallboardPage';
import AgentEnginePage from './pages/AgentEnginePage';
import { lazy } from 'react';

// // Páginas de Autenticación
// const LoginPage = lazy(() => import('./pages/LoginPage'));
// const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
// const ForceChangePasswordPage = lazy(() => import('./pages/ForceChangePasswordPage'));
// const MFAVerifyPage = lazy(() => import('./pages/MFAVerifyPage'));

// // Layout Principal
// const DashboardLayout = lazy(() => import('./pages/DashboardLayout'));

// // Páginas de Contenido
// const OverviewPage = lazy(() => import('./pages/OverviewPage'));
// const ChatPage = lazy(() => import('./pages/ChatPage'));
// const AgentsPage = lazy(() => import('./pages/AgentsPage'));
// const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// const SavedRepliesPage = lazy(() => import('./pages/SavedRepliesPage'));
// const SupervisorPage = lazy(() => import('./pages/SupervisorPage'));
// const AuditPage = lazy(() => import('./pages/AuditPage'));
// const ExportsPage = lazy(() => import('./pages/ExportsPage'));
// const MySettingsPage = lazy(() => import('./pages/MySettingsPage'));
// const CustomFieldsPage = lazy(() => import('./pages/CustomFieldsPage'));
// const SystemPage = lazy(() => import('./pages/SystemPage'));
// const SystemControlPage = lazy(() => import('./pages/SystemControlPage'));
// const TextsPage = lazy(() => import('./pages/TextsPage'));
// const ContactsPage = lazy(() => import('./pages/ContactsPage'));
// const BroadcastPage = lazy(() => import('./pages/BroadcastPage'));
// const InternalBroadcastsPage = lazy(() => import('./pages/BroadcastsPage'));
// const PermissionsPage = lazy(() => import('./pages/PermissionsPage'));
// const LiveChatPage = lazy(() => import('./pages/LiveChatPage'));
// const AgentRulesPage = lazy(() => import('./pages/AgentRulesPage'));
// const DispositionsPage = lazy(() => import('./pages/DispositionsPage'));
// const MediaPage = lazy(() => import('./pages/MediaPage'));
// const QAPage = lazy(() => import('./pages/QAPage'));
import { FlowsPage } from './components/flows';
import { ToastContainer } from './components/ui';
import { ThemeProvider } from './components/ThemeProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PolicyAlertsProvider } from './components/PolicyAlertsProvider';
import './index.css';

// Redirect /chat/:sessionId to /dashboard/chat?session=:sessionId (preserving hash)
function ChatRedirect() {
  const { sessionId } = useParams();
  const location = useLocation();
  return <Navigate to={`/chat?session=${sessionId}${location.hash}`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mfa-verify" element={<MFAVerifyPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/force-change-password" element={<ForceChangePasswordPage />} />
          {/* Redirect legacy /chat/:sessionId URLs to new format */}
          <Route path="/chat/:sessionId" element={<ChatRedirect />} />
          <Route path="/" element={<DashboardLayout />}>
            {/* Overview - todos pueden ver */}
            <Route path='/dashboard' index element={<OverviewPage />} />
            
            {/* Chat - requiere chats.read */}
            <Route path="chat" element={
              <ProtectedRoute permission="chats.read">
                <ChatPage />
              </ProtectedRoute>
            } />
            
            {/* Supervisor - requiere supervisor.monitor */}
            <Route path="supervisor" element={
              <ProtectedRoute permission="supervisor.monitor">
                <SupervisorPage />
              </ProtectedRoute>
            } />
            
            {/* Audit - requiere system.audit */}
            <Route path="audit" element={
              <ProtectedRoute permission="system.audit">
                <AuditPage />
              </ProtectedRoute>
            } />
            
            {/* Exports - requiere exports.create */}
            <Route path="exports" element={
              <ProtectedRoute permission="exports.create">
                <ExportsPage />
              </ProtectedRoute>
            } />
            
            {/* Saved Replies - requiere replies.read */}
            <Route path="saved-replies" element={
              <ProtectedRoute permission="replies.read">
                <SavedRepliesPage />
              </ProtectedRoute>
            } />
            
            {/* Agents - requiere agents.read */}
            <Route path="agents" element={
              <ProtectedRoute permission="agents.read">
                <AgentsPage />
              </ProtectedRoute>
            } />
            
            {/* Settings - requiere settings.read */}
            <Route path="settings" element={
              <ProtectedRoute permission="settings.read">
                <SettingsPage />
              </ProtectedRoute>
            } />
            
            {/* My Settings - todos pueden ver su propia configuración */}
            <Route path="my-settings" element={<MySettingsPage />} />
            <Route path="my-settings/:tab" element={<MySettingsPage />} />
            
            {/* Flows - requiere flows.read */}
            <Route path="flows" element={
              <ProtectedRoute permission="flows.read">
                <FlowsPage />
              </ProtectedRoute>
            } />
            <Route path="flows/:flowId" element={
              <ProtectedRoute permission="flows.read">
                <FlowsPage />
              </ProtectedRoute>
            } />
            
            {/* Custom Fields - requiere customFields.read */}
            <Route path="custom-fields" element={
              <ProtectedRoute permission="customFields.read">
                <CustomFieldsPage />
              </ProtectedRoute>
            } />
            
            {/* System - requiere system.read */}
            <Route path="system" element={
              <ProtectedRoute permission="system.read">
                <SystemPage />
              </ProtectedRoute>
            } />
            
            {/* System Control - requiere system.manage */}
            <Route path="system-control" element={
              <ProtectedRoute permission="system.manage">
                <SystemControlPage />
              </ProtectedRoute>
            } />
            
            {/* Texts - requiere settings.write */}
            <Route path="texts" element={
              <ProtectedRoute permission="settings.write">
                <TextsPage />
              </ProtectedRoute>
            } />
            
            {/* Contacts - requiere contacts.read */}
            <Route path="contacts" element={
              <ProtectedRoute permission="contacts.read">
                <ContactsPage />
              </ProtectedRoute>
            } />
            
            {/* Broadcast - requiere broadcasts.read */}
            <Route path="broadcast" element={
              <ProtectedRoute permission="broadcasts.read">
                <BroadcastPage />
              </ProtectedRoute>
            } />
            
            {/* Internal Broadcasts (Admin announcements) - requiere system.admin */}
            <Route path="internal-broadcasts" element={
              <ProtectedRoute permission="system.admin">
                <InternalBroadcastsPage />
              </ProtectedRoute>
            } />
            
            {/* Permissions - requiere agents.permissions */}
            <Route path="permissions" element={
              <ProtectedRoute permission="agents.permissions">
                <PermissionsPage />
              </ProtectedRoute>
            } />
            
            {/* Live Chat - requiere settings.read (supervisors and admins) */}
            <Route path="live-chat" element={
              <ProtectedRoute permission="settings.read">
                <LiveChatPage />
              </ProtectedRoute>
            } />
            
            {/* Agent Rules - requiere settings.read */}
            <Route path="agent-rules" element={
              <ProtectedRoute permission="settings.read">
                <AgentRulesPage />
              </ProtectedRoute>
            } />
            
            {/* Dispositions (Tipificaciones) - requiere settings.read */}
            <Route path="dispositions" element={
              <ProtectedRoute permission="settings.read">
                <DispositionsPage />
              </ProtectedRoute>
            } />
            
            {/* Media Admin - requiere system.manage (admin/supervisor) */}
            <Route path="media" element={
              <ProtectedRoute permission="system.manage">
                <MediaPage />
              </ProtectedRoute>
            } />
            
            {/* QA & Coaching - requiere supervisor.monitor (admin/supervisor) */}
            <Route path="qa" element={
              <ProtectedRoute permission="supervisor.monitor">
                <QAPage />
              </ProtectedRoute>
            } />
            
            {/* Playbooks - requiere playbooks.read */}
            <Route path="playbooks" element={
              <ProtectedRoute permission="playbooks.read">
                <PlaybooksPage />
              </ProtectedRoute>
            } />
            
            {/* Translation Settings - requiere settings.read (admin/supervisor) */}
            <Route path="translation" element={
              <ProtectedRoute permission="settings.read">
                <TranslationSettingsPage />
              </ProtectedRoute>
            } />

            {/* Wallboard - requiere supervisor.monitor */}
            <Route path="wallboard" element={
              <ProtectedRoute permission="supervisor.monitor">
                <WallboardPage />
              </ProtectedRoute>
            } />

            {/* Agent Engine - requiere settings.read */}
            <Route path="agent-engine" element={
              <ProtectedRoute permission="settings.read">
                <AgentEnginePage />
              </ProtectedRoute>
            } />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <PolicyAlertsProvider>
          {/* PolicyAlertsProvider shows alerts/maintenance mode after login */}
          <></>
        </PolicyAlertsProvider>
        <ToastContainer />
      </BrowserRouter>
    </ThemeProvider>
  );
}
