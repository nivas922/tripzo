import React, { useState, useEffect, useCallback } from 'react';
import { studentApi } from '../../services/api';
import { getSocket, joinBusRoom, leaveBusRoom } from '../../services/socket';
import MapView from '../../components/MapView';
import StatusBadge from '../../components/StatusBadge';
import { 
  Bus, 
  MapPin, 
  Clock, 
  Gauge, 
  RotateCw, 
  AlertTriangle, 
  WifiOff, 
  Navigation2, 
  Crosshair,
  Calendar,
  Compass
} from 'lucide-react';

export const StudentDashboard = () => {
  const [busData, setBusData] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Real-time dynamic telemetry states
  const [busLocation, setBusLocation] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('NOT_STARTED');
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [etaData, setEtaData] = useState(null);
  const [autoCenter, setAutoCenter] = useState(true);

  // Fetch initial student assignments & route
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    setError(null);

    try {
      // 1. Fetch assigned bus
      const busRes = await studentApi.getMyBus();
      const bus = busRes.data?.data?.bus || busRes.data?.bus || busRes.data;
      setBusData(bus);

      if (bus?.currentLocation) {
        setBusLocation({
          latitude: bus.currentLocation.latitude,
          longitude: bus.currentLocation.longitude,
          speed: bus.currentLocation.speed || 0,
          heading: bus.currentLocation.heading || 0,
          timestamp: bus.currentLocation.timestamp,
        });
      }

      const initialStatus = busRes.data?.data?.status || bus?.status || 'NOT_STARTED';
      setCurrentStatus(initialStatus);
      if (initialStatus === 'OFF_ROUTE') setIsOffRoute(true);
      if (initialStatus === 'OFFLINE') setIsOffline(true);

      // 2. Fetch assigned route & stops
      const routeRes = await studentApi.getMyRoute();
      const route = routeRes.data?.data?.route || routeRes.data?.route || routeRes.data;
      setRouteData(route);

      // 3. Fetch student profile to get designated home stop
      const profileRes = await studentApi.getMyProfile();
      const profile = profileRes.data?.data || profileRes.data;
      setStudentProfile(profile);

      // Calculate or set initial ETA if available
      if (busRes.data?.data?.eta) {
        setEtaData(busRes.data.data.eta);
      }
    } catch (err) {
      console.error('[Student] Failed to fetch data:', err);
      setError(
        err.response?.data?.message ||
        'Unable to load your assigned bus and route. Ensure an administrator has assigned a bus and route to your account.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Join WebSocket bus room for live telemetry broadcasts
  useEffect(() => {
    const busId = busData?._id || busData?.id;
    if (!busId) return;

    joinBusRoom(busId);
    const socket = getSocket();

    const handleLocation = (payload) => {
      if (payload.busId === busId || !payload.busId) {
        setBusLocation({
          latitude: payload.latitude,
          longitude: payload.longitude,
          speed: payload.speed || 0,
          heading: payload.heading || 0,
          timestamp: payload.timestamp || new Date(),
        });

        // Clear offline warning on live ping
        setIsOffline(false);
      }
    };

    const handleOffRoute = (payload) => {
      if (payload.busId === busId || !payload.busId) {
        setIsOffRoute(true);
        setCurrentStatus('OFF_ROUTE');
      }
    };

    const handleOffline = (payload) => {
      if (payload.busId === busId || !payload.busId) {
        setIsOffline(true);
        setCurrentStatus('OFFLINE');
      }
    };

    const handleOnline = (payload) => {
      if (payload.busId === busId || !payload.busId) {
        setIsOffline(false);
        if (currentStatus === 'OFFLINE') setCurrentStatus('RUNNING');
      }
    };

    const handleTripStarted = (payload) => {
      if (payload.busId === busId || !payload.busId) {
        setCurrentStatus('RUNNING');
        setIsOffRoute(false);
        setIsOffline(false);
      }
    };

    const handleTripEnded = (payload) => {
      if (payload.busId === busId || !payload.busId) {
        setCurrentStatus('COMPLETED');
      }
    };

    const handleStatusChanged = (payload) => {
      if (payload.busId === busId || !payload.busId) {
        setCurrentStatus(payload.status);
      }
    };

    socket.on('bus:location', handleLocation);
    socket.on('bus:off_route', handleOffRoute);
    socket.on('bus:offline', handleOffline);
    socket.on('bus:online', handleOnline);
    socket.on('bus:trip_started', handleTripStarted);
    socket.on('bus:trip_ended', handleTripEnded);
    socket.on('bus:trip_status_changed', handleStatusChanged);

    return () => {
      leaveBusRoom(busId);
      socket.off('bus:location', handleLocation);
      socket.off('bus:off_route', handleOffRoute);
      socket.off('bus:offline', handleOffline);
      socket.off('bus:online', handleOnline);
      socket.off('bus:trip_started', handleTripStarted);
      socket.off('bus:trip_ended', handleTripEnded);
      socket.off('bus:trip_status_changed', handleStatusChanged);
    };
  }, [busData]);

  // Compute distance and ETA to student's stop
  const userStop = studentProfile?.assignedStop || 
    routeData?.stops?.find((s) => s._id === studentProfile?.assignedStop?._id || s.id === studentProfile?.assignedStop);

  // Derive dynamic status badge based on distance if running
  const getComputedStatus = () => {
    if (isOffline) return 'OFFLINE';
    if (isOffRoute) return 'OFF_ROUTE';
    if (currentStatus === 'COMPLETED') return 'COMPLETED';
    if (currentStatus !== 'RUNNING' && currentStatus !== 'IN_PROGRESS') return currentStatus;

    // If running and we have coordinates of both bus and user stop, compute proximity
    if (busLocation && userStop?.location?.coordinates) {
      const stopLng = userStop.location.coordinates[0];
      const stopLat = userStop.location.coordinates[1];
      
      const R = 6371; // km
      const dLat = ((stopLat - busLocation.latitude) * Math.PI) / 180;
      const dLon = ((stopLng - busLocation.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((busLocation.latitude * Math.PI) / 180) *
        Math.cos((stopLat * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = R * c;

      if (distKm <= 0.1) return 'REACHED';
      if (distKm <= 1.0) return 'APPROACHING';
    }

    return 'RUNNING';
  };

  const computedStatus = getComputedStatus();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading your college bus tracker...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Alert Notices */}
      {isOffRoute && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 flex items-center gap-3 text-red-800 shadow-sm animate-pulse">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">Bus is off route</p>
            <p className="text-xs text-red-700">The bus may be temporarily away from its normal route due to road diversion or traffic.</p>
          </div>
        </div>
      )}

      {isOffline && !isOffRoute && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-300 flex items-center gap-3 text-orange-800 shadow-sm">
          <WifiOff className="w-6 h-6 text-orange-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">Bus temporarily offline</p>
            <p className="text-xs text-orange-700">Last known location is displayed. Reconnecting to GPS signal...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-3 text-amber-900 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Main Bus Header & Status Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-inner">
            <Bus className="w-8 h-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900">
                {busData?.busNumber || 'Assigned Bus'}
              </h1>
              <StatusBadge status={computedStatus} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Registration: <span className="font-semibold text-slate-700">{busData?.registrationNumber || 'N/A'}</span>
              {routeData && (
                <> • Route: <span className="font-semibold text-blue-600">{routeData.name || routeData.routeNumber}</span></>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto">
          <button
            onClick={() => setAutoCenter(!autoCenter)}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              autoCenter 
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Keep map centered on bus"
          >
            <Crosshair className="w-4 h-4" />
            <span>Auto-Center: {autoCenter ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
            title="Refresh location data"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Primary Grid: Live Map & Trip Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Map View (Col 1-2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <div className="flex items-center gap-2">
                <Navigation2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Live GPS Radar</span>
              </div>
              {busLocation?.timestamp && (
                <span className="text-[11px] text-slate-400">
                  Last ping: {new Date(busLocation.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>

            <MapView
              busLocation={busLocation}
              routeStops={routeData?.stops || []}
              userStopId={userStop?._id || userStop?.id}
              autoCenter={autoCenter}
              busDetails={{
                busNumber: busData?.busNumber,
                route: routeData,
              }}
              height="480px"
            />
          </div>

          {/* Telemetry Metrics Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase">Live Speed</p>
                <p className="text-lg font-bold text-slate-800">
                  {busLocation ? `${(busLocation.speed || 0).toFixed(1)} km/h` : '--'}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase">Heading</p>
                <p className="text-lg font-bold text-slate-800">
                  {busLocation ? `${Math.round(busLocation.heading || 0)}°` : '--'}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase">Trip State</p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {computedStatus.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Student Home Stop & Route Stops (Col 3) */}
        <div className="space-y-4">
          {/* User's Home Stop ETA Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-600/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200 bg-white/10 px-2.5 py-1 rounded-full">
                Your Designated Stop
              </span>
              <MapPin className="w-5 h-5 text-amber-300" />
            </div>

            <h3 className="text-xl font-extrabold tracking-tight">
              {userStop?.name || studentProfile?.assignedStopName || 'Assigned Stop'}
            </h3>
            <p className="text-xs text-blue-100 mt-0.5">
              Sequence: #{userStop?.sequenceNumber || '1'} on Route
            </p>

            <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-blue-200">Estimated Arrival</p>
                <p className="text-2xl font-black mt-0.5">
                  {computedStatus === 'REACHED' ? (
                    <span className="text-amber-300">At Your Stop!</span>
                  ) : computedStatus === 'APPROACHING' ? (
                    <span className="text-amber-300">&lt; 2 mins</span>
                  ) : computedStatus === 'RUNNING' ? (
                    etaData?.estimatedMinutes ? `~${etaData.estimatedMinutes} mins` : 'Calculating...'
                  ) : (
                    <span className="text-sm text-blue-200">Waiting for start</span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-blue-200">Distance</p>
                <p className="text-2xl font-black mt-0.5">
                  {computedStatus === 'RUNNING' && etaData?.distanceKm ? (
                    `${etaData.distanceKm} km`
                  ) : (
                    '--'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Route Stops Timeline */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center justify-between">
              <span>Route Stops</span>
              <span className="text-xs font-normal text-slate-400">
                {routeData?.stops?.length || 0} Total
              </span>
            </h4>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {routeData?.stops && routeData.stops.length > 0 ? (
                routeData.stops.map((stop, idx) => {
                  const targetUserStopId = userStop?._id || userStop?.id || studentProfile?.assignedStop?._id || studentProfile?.assignedStop;
                  const currentStopId = stop._id || stop.id;
                  const isHome = Boolean(targetUserStopId && currentStopId && String(currentStopId) === String(targetUserStopId));
                  return (
                    <div
                      key={stop._id || stop.id || idx}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border transition ${
                        isHome
                          ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/50'
                          : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/60'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                          isHome
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {stop.sequenceNumber || idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {stop.name}
                          </p>
                          {isHome && (
                            <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              Your Stop
                            </span>
                          )}
                        </div>
                        {stop.scheduledTime && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Scheduled: {stop.scheduledTime}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No stops found for this route.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
