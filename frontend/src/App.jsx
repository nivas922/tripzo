import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import StudentDashboard from './pages/student/StudentDashboard';
import DriverConsole from './pages/driver/DriverConsole';
import AdminDashboard from './pages/admin/AdminDashboard';
import { Eye, Shield, Compass, User } from 'lucide-react';

const AppContent = () => {
  const { user, role, loading } = useAuth();
  const [adminViewOverride, setAdminViewOverride] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Connecting to TripZo Live...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const activeRole = (role === 'ADMIN' && adminViewOverride) ? adminViewOverride : role;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Navbar />

      {/* Admin Role Preview Bar */}
      {role === 'ADMIN' && (
        <div className="bg-purple-900 text-purple-100 px-4 py-2 border-b border-purple-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-300" />
            <span className="font-semibold">Admin Mode Preview:</span>
            <span>Viewing as <strong className="text-white uppercase">{activeRole}</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAdminViewOverride(null)}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                !adminViewOverride ? 'bg-white text-purple-900 shadow-sm' : 'hover:bg-purple-800 text-purple-200'
              }`}
            >
              Admin Dashboard
            </button>
            <button
              onClick={() => setAdminViewOverride('STUDENT')}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                adminViewOverride === 'STUDENT' ? 'bg-white text-purple-900 shadow-sm' : 'hover:bg-purple-800 text-purple-200'
              }`}
            >
              Student View
            </button>
            <button
              onClick={() => setAdminViewOverride('DRIVER')}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                adminViewOverride === 'DRIVER' ? 'bg-white text-purple-900 shadow-sm' : 'hover:bg-purple-800 text-purple-200'
              }`}
            >
              Driver Console
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        {activeRole === 'DRIVER' ? (
          <DriverConsole />
        ) : activeRole === 'ADMIN' ? (
          <AdminDashboard />
        ) : (
          <StudentDashboard />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>TripZo Live • Standalone College Bus GPS Tracking System</p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
