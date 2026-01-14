// Trelk Support Dashboard - Main App
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
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
import { FlowsPage } from './components/flows';
import { ToastContainer } from './components/ui';
import { ThemeProvider } from './components/ThemeProvider';
import './index.css';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="supervisor" element={<SupervisorPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="exports" element={<ExportsPage />} />
            <Route path="saved-replies" element={<SavedRepliesPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="my-settings" element={<MySettingsPage />} />
            <Route path="my-settings/:tab" element={<MySettingsPage />} />
            <Route path="flows" element={<FlowsPage />} />
            <Route path="flows/:flowId" element={<FlowsPage />} />
            <Route path="custom-fields" element={<CustomFieldsPage />} />
            <Route path="system" element={<SystemPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ThemeProvider>
  );
}
