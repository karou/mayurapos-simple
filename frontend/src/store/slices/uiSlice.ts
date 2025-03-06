import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

interface UIState {
  isOfflineMode: boolean;
  isOnline: boolean;
  hasPendingSync: boolean;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  toasts: Toast[];
}

const initialState: UIState = {
  isOfflineMode: false,
  isOnline: navigator.onLine,
  hasPendingSync: false,
  pendingSyncCount: 0,
  lastSyncTime: null,
  toasts: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.isOfflineMode = action.payload;
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setPendingSync: (state, action: PayloadAction<{ hasPending: boolean; count: number }>) => {
      state.hasPendingSync = action.payload.hasPending;
      state.pendingSyncCount = action.payload.count;
    },
    setLastSyncTime: (state, action: PayloadAction<string>) => {
      state.lastSyncTime = action.payload;
    },
    addToast: (state, action: PayloadAction<Omit<Toast, 'id'>>) => {
      const id = Math.random().toString(36).substring(2, 9);
      state.toasts.push({
        id,
        ...action.payload,
      });
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload);
    },
  },
});

export const {
  setOfflineMode,
  setOnlineStatus,
  setPendingSync,
  setLastSyncTime,
  addToast,
  removeToast,
} = uiSlice.actions;

export default uiSlice.reducer;