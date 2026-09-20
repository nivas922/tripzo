import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl, setCustomBackendUrl, checkBackendHealth } from '../services/api';
import { 
  Bus, 
  KeyRound, 
  Mail, 
  AlertCircle, 
  ShieldCheck, 
  User, 
  Compass, 
  ArrowRight,
  Server,
  Settings,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const Login = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Backend connection status & configuration
  const [backendUrl, setBackendUrl] = useState(getApiBaseUrl());
  const [editingUrl, setEditingUrl] = useState(false);
  const [customInput, setCustomInput] = useState(getApiBaseUrl());
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'offline'

  const pingServer = async (target) => {
    setServerStatus('checking');
    const res = await checkBackendHealth(target || backendUrl);
    setServerStatus(res.ok ? 'online' : 'offline');
  };

  useEffect(() => {
    pingServer();
  }, [backendUrl]);

  const handleSaveBackendUrl = (e) => {
    e.preventDefault();
    setCustomBackendUrl(customInput);
    const resolved = getApiBaseUrl();
    setBackendUrl(resolved);
    setEditingUrl(false);
    pingServer(resolved);
  };

  const handleResetToOrigin = () => {
    setCustomBackendUrl(window.location.origin);
    const resolved = getApiBaseUrl();
    setCustomInput(resolved);
    setBackendUrl(resolved);
    setEditingUrl(false);
    pingServer(resolved);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await login(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      console.error('Login error:', err);
      const isNetError = !err.response || err.code === 'ERR_NETWORK';
      setError(
        isNetError
          ? `Could not reach backend at ${backendUrl}. If using Render, ensure your backend service is running, or click "Change Backend URL" below to enter your Render URL.`
          : (err.response?.data?.message || err.response?.data?.error || 'Login failed. Please check your credentials.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-center py-10 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 ring-4 ring-blue-500/20">
            <Bus className="w-9 h-9" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-white">
          TripZo <span className="text-blue-400">Live</span>
        </h2>
        <p className="mt-1 text-center text-sm text-slate-300">
          College Bus Live GPS Tracking & Fleet System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-white/20">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-600/25 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 transition"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Accounts */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center mb-3">
              One-Click Demo Credentials
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('student1@tripzo.edu', 'StudentPass123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 text-xs font-medium transition"
              >
                <User className="w-4 h-4 mb-1 text-blue-600" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('driver@tripzo.edu', 'DriverPass123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100/70 text-amber-700 text-xs font-medium transition"
              >
                <Compass className="w-4 h-4 mb-1 text-amber-600" />
                <span>Driver</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('admin@tripzo.edu', 'AdminPass123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-purple-200 bg-purple-50/70 hover:bg-purple-100/70 text-purple-700 text-xs font-medium transition"
              >
                <ShieldCheck className="w-4 h-4 mb-1 text-purple-600" />
                <span>Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Backend Connection & Configuration Widget */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-800/80 backdrop-blur border border-slate-700/80 text-xs text-slate-300 shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-slate-400">Backend: </span>
                <span className="font-mono text-blue-300 font-medium">{backendUrl}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {serverStatus === 'online' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              ) : serverStatus === 'checking' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Pinging...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-950/60 border border-red-700/50 px-2 py-0.5 rounded-full">
                  Offline
                </span>
              )}

              <button
                type="button"
                onClick={() => setEditingUrl(!editingUrl)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Change Backend URL"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editable Backend URL Drawer */}
          {editingUrl && (
            <form onSubmit={handleSaveBackendUrl} className="mt-3 pt-3 border-t border-slate-700 space-y-2">
              <label className="block text-[11px] font-medium text-slate-300">
                Enter your Render Backend URL (or leave blank to auto-detect):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="https://your-backend-app.onrender.com"
                  className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-600 text-white font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
                >
                  Save
                </button>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                <span>Example: <code>https://tripzo-backend.onrender.com</code></span>
                <button
                  type="button"
                  onClick={handleResetToOrigin}
                  className="text-blue-400 hover:underline"
                >
                  Use Current Domain
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
