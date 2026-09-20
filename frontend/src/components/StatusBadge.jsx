import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  WifiOff, 
  Clock, 
  Navigation, 
  MapPin, 
  PauseCircle,
  Bus
} from 'lucide-react';

export const StatusBadge = ({ status, customLabel, className = '' }) => {
  const normStatus = (status || 'NOT_STARTED').toUpperCase();

  switch (normStatus) {
    case 'RUNNING':
    case 'IN_PROGRESS':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm ${className}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-0.5" />
          <Navigation className="w-3.5 h-3.5" />
          {customLabel || 'Bus is running'}
        </span>
      );

    case 'APPROACHING':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm ${className}`}>
          <Navigation className="w-3.5 h-3.5 animate-bounce" />
          {customLabel || 'Bus approaching your stop'}
        </span>
      );

    case 'REACHED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 shadow-sm ${className}`}>
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          {customLabel || 'Bus reached your stop'}
        </span>
      );

    case 'OFF_ROUTE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300 shadow-sm animate-pulse ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          {customLabel || 'Bus is off route'}
        </span>
      );

    case 'OFFLINE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300 shadow-sm ${className}`}>
          <WifiOff className="w-3.5 h-3.5 text-orange-600" />
          {customLabel || 'Bus temporarily offline'}
        </span>
      );

    case 'PAUSED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 shadow-sm ${className}`}>
          <PauseCircle className="w-3.5 h-3.5 text-purple-600" />
          {customLabel || 'Bus is paused'}
        </span>
      );

    case 'COMPLETED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-300 shadow-sm ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          {customLabel || 'Bus trip completed'}
        </span>
      );

    case 'NOT_STARTED':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 shadow-sm ${className}`}>
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {customLabel || 'Bus not started'}
        </span>
      );
  }
};

export default StatusBadge;
