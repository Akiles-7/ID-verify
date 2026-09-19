import { configureStore, createSlice } from '@reduxjs/toolkit';

const initialUser = (() => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
  },
  reducers: {
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      localStorage.setItem('token', action.payload.token);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    },
  },
});

const scanSlice = createSlice({
  name: 'scan',
  initialState: {
    currentScan: null,
    isProcessing: false,
    activeModuleStep: 1,
  },
  reducers: {
    setCurrentScan: (state, action) => {
      state.currentScan = action.payload;
    },
    setProcessing: (state, action) => {
      state.isProcessing = action.payload;
    },
    setActiveModuleStep: (state, action) => {
      state.activeModuleStep = action.payload;
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export const { setCurrentScan, setProcessing, setActiveModuleStep } = scanSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    scan: scanSlice.reducer,
  },
});
