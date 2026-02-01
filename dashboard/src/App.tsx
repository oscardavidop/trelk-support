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
import PermissionsPage from './pages/PermissionsPage';
import { FlowsPage } from './components/flows';
import { ToastContainer } from './components/ui';
import { ThemeProvider } from './components/ThemeProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import './index.css';

// Redirect /chat/:sessionId to /dashboard/chat?session=:sessionId (preserving hash)
function ChatRedirect() {
  const { sessionId } = useParams();
  const location = useLocation();
  return <Navigate to={`/dashboard/chat?session=${sessionId}${location.hash}`} replace />;
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
          <Route path="/dashboard" element={<DashboardLayout />}>
            {/* Overview - todos pueden ver */}
            <Route index element={<OverviewPage />} />
            
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
            
            {/* Permissions - requiere agents.permissions */}
            <Route path="permissions" element={
              <ProtectedRoute permission="agents.permissions">
                <PermissionsPage />
              </ProtectedRoute>
            } />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ThemeProvider>
  );
}
