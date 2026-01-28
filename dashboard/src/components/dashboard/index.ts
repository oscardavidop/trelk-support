/**
 * Dashboard Components Index
 * Central export for all dashboard-related components
 */

// Main dashboard views
export { AdminDashboard } from './AdminDashboard';
export { SupervisorDashboard } from './SupervisorDashboard';
export { AgentDashboard } from './AgentDashboard';

// Reusable components
export {
  MetricCard,
  MetricCardsGrid,
  DashboardSection,
  SystemHealthCard,
  AlertsPanel,
  InsightsPanel,
  AgentStatusTable,
  DashboardSkeleton,
  RefreshButton,
  DateFilter,
} from './DashboardComponents';

// Charts
export {
  BarChart,
  LineChart,
  DonutChart,
  ProgressBar,
  Sparkline,
  GaugeChart,
} from './DashboardCharts';
