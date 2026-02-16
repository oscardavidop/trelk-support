// Policy store using Zustand - Handles login policy results
import { create } from 'zustand';

interface GlobalAlert {
  enabled: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
  requireAcknowledge: boolean;
  showFullScreen: boolean;
}

interface LoginPolicyState {
  // Policy results from login
  redirect?: string;
  profileIncomplete?: boolean;
  globalAlert?: GlobalAlert;
  policyAcceptanceRequired?: boolean;
  readOnlyMode?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  warnings?: string[];
  
  // UI states
  alertAcknowledged: boolean;
  maintenanceAcknowledged: boolean;
  
  // Actions
  setLoginPolicyResults: (results: Partial<LoginPolicyState>) => void;
  acknowledgeAlert: () => void;
  acknowledgeMaintenanceMode: () => void;
  clearPolicyState: () => void;
  hasActiveAlert: () => boolean;
  hasMaintenanceMode: () => boolean;
}

export const usePolicyStore = create<LoginPolicyState>()((set, get) => ({
  redirect: undefined,
  profileIncomplete: undefined,
  globalAlert: undefined,
  policyAcceptanceRequired: undefined,
  readOnlyMode: undefined,
  maintenanceMode: undefined,
  maintenanceMessage: undefined,
  warnings: undefined,
  alertAcknowledged: false,
  maintenanceAcknowledged: false,

  setLoginPolicyResults: (results) => {
    set({
      redirect: results.redirect,
      profileIncomplete: results.profileIncomplete,
      globalAlert: results.globalAlert,
      policyAcceptanceRequired: results.policyAcceptanceRequired,
      readOnlyMode: results.readOnlyMode,
      maintenanceMode: results.maintenanceMode,
      maintenanceMessage: results.maintenanceMessage,
      warnings: results.warnings,
      // Reset acknowledgements when new policy results come in
      alertAcknowledged: false,
      maintenanceAcknowledged: false,
    });
  },

  acknowledgeAlert: () => {
    set({ alertAcknowledged: true });
  },

  acknowledgeMaintenanceMode: () => {
    set({ maintenanceAcknowledged: true });
  },

  clearPolicyState: () => {
    set({
      redirect: undefined,
      profileIncomplete: undefined,
      globalAlert: undefined,
      policyAcceptanceRequired: undefined,
      readOnlyMode: undefined,
      maintenanceMode: undefined,
      maintenanceMessage: undefined,
      warnings: undefined,
      alertAcknowledged: false,
      maintenanceAcknowledged: false,
    });
  },

  hasActiveAlert: () => {
    const state = get();
    return !!(state.globalAlert?.enabled && !state.alertAcknowledged);
  },

  hasMaintenanceMode: () => {
    const state = get();
    return !!(state.maintenanceMode && !state.maintenanceAcknowledged);
  },
}));
