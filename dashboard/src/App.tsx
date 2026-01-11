// Trelk Support Dashboard - Main App
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import SavedRepliesPage from './pages/SavedRepliesPage';
import { ToastContainer } from './components/ui';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="saved-replies" element={<SavedRepliesPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
