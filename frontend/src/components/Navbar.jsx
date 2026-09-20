import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bus, LogOut, User, Shield, Compass } from 'lucide-react';

export const Navbar = () => {
  const { user, role, logout } = useAuth();

  const getRoleBadge = () => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</span>;
      case 'DRIVER':
        return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Compass className="w-3 h-3" /> Driver</span>;
      case 'STUDENT':
      default:
        return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><User className="w-3 h-3" /> Student</span>;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">TripZo<span className="text-blue-600">Live</span></span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">GPS Tracker</span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">College Bus Live GPS Tracking System</p>
          </div>
        </div>

        {/* User Info & Actions */}
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-sm font-semibold text-slate-800">{user.name || user.email}</span>
                {getRoleBadge()}
              </div>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Navbar;
