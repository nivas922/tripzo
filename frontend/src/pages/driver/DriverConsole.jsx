import React, { useState, useEffect, useRef, useCallback } from 'react';
import { driverApi } from '../../services/api';
import { getSocket } from '../../services/socket';
import MapView from '../../components/MapView';
import StatusBadge from '../../components/StatusBadge';
import { 
  Play, 
  Square, 
  Pause, 
  Compass, 
  Gauge, 
  AlertTriangle, 
  Navigation, 
  Radio, 
  RotateCcw,
  CheckCircle,
  Clock
} from 'lucide-react';

export const DriverConsole = () => {
  const [trip, setTrip] = useState(null);
  const [bus, setBus] = useState(null);
  const [direction, setDirection] = useState('MORNING');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Live Telemetry states
  const [currentCoords, setCurrentCoords] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastPingTime, setLastPingTime] = useState(null);
  const [pingsCount, setPingsCount] = useState(0);

  const watchIdRef = useRef(null);
  const simIntervalRef = useRef(null);
  const routeStops = trip?.route?.stops || bus?.route?.stops || [];

  // Fetch current active trip for driver's assigned bus
  const loadActiveTrip = useCallback(async () => {
    try {
      setError(null);
      const res = await driverApi.getCurrentTrip();
      const current = res.data?.data?.trip || res.data?.trip || null;
      setTrip(current);

      if (current?.bus) {
        setBus(current.bus);
        if (current.bus.currentLocation) {
          setCurrentCoords({
            latitude: current.bus.currentLocation.latitude,
            longitude: current.bus.currentLocation.longitude,
          });
          setSpeed(current.bus.currentLocation.speed || 0);
          setHeading(current.bus.currentLocation.heading || 0);
        }
      }
    } catch (err) {
      console.warn('[Driver] Failed to fetch current trip:', err);
      // Not an error if driver has no active trip yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveTrip();
  }, [loadActiveTrip]);

  // Send GPS location update to backend API and Socket
  const transmitLocation = useCallback(async (lat, lng, spd = 25, hdg = 90) => {
    const busId = bus?._id || bus?.id || trip?.bus?._id || trip?.bus?.id;
    if (!busId) return;

    const payload = {
      busId,
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6)),
      speed: Math.max(0, Math.round(spd)),
      heading: Math.round(hdg),
      timestamp: new Date().toISOString(),
    };

    try {
      await driverApi.updateLocation(payload);
      setLastPingTime(new Date());
      setPingsCount((prev) => prev + 1);

      // Direct Socket emit
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('driver:location_update', payload);
      }
    } catch (err) {
      console.warn('[Driver] Location sync error:', err.response?.data?.message || err.message);
    }
  }, [bus, trip]);

  // Handle GPS Watcher (Real Geolocation)
  useEffect(() => {
    const isTripActive = trip && (trip.status === 'RUNNING' || trip.status === 'in_progress');

    if (isTripActive && !isSimulating) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const spd = (pos.coords.speed || 0) * 3.6; // convert m/s to km/h
            const hdg = pos.coords.heading || 0;

            setCurrentCoords({ latitude: lat, longitude: lng });
            setSpeed(spd);
            setHeading(hdg);

            transmitLocation(lat, lng, spd, hdg);
          },
          (err) => {
            console.warn('[Driver] Geolocation watch error:', err.message);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [trip, isSimulating, transmitLocation]);

  // Handle GPS Simulation along route coordinates (for testing/development)
  useEffect(() => {
    if (isSimulating && trip && (trip.status === 'RUNNING' || trip.status === 'in_progress')) {
      // Collect route stop coordinates or default Bangalore campus path
      const coordsList = routeStops.length > 0
        ? routeStops.map((s) => [s.location.coordinates[1], s.location.coordinates[0]])
        : [
            [12.9250, 77.6850],
            [12.9220, 77.6880],
            [12.9180, 77.6920],
            [12.9140, 77.6960],
          ];

      let step = 0;
      simIntervalRef.current = setInterval(() => {
        const [targetLat, targetLng] = coordsList[step % coordsList.length];
        // Add small jitter
        const jitterLat = targetLat + (Math.random() - 0.5) * 0.0005;
        const jitterLng = targetLng + (Math.random() - 0.5) * 0.0005;

        setCurrentCoords({ latitude: jitterLat, longitude: jitterLng });
        setSpeed(32 + Math.floor(Math.random() * 8));
        setHeading((step * 45) % 360);

        transmitLocation(jitterLat, jitterLng, 35, (step * 45) % 360);
        step++;
      }, 3500);
    } else {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    }

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isSimulating, trip, routeStops, transmitLocation]);

  // Actions
  const handleStartTrip = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const busId = bus?._id || bus?.id;
      const res = await driverApi.startTrip(busId, direction);
      const newTrip = res.data?.data?.trip || res.data?.trip || res.data;
      setTrip(newTrip);
      if (newTrip?.bus) setBus(newTrip.bus);
    } catch (err) {
      console.error('Failed to start trip:', err);
      setError(err.response?.data?.message || 'Failed to start trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseTrip = async () => {
    if (!trip?._id && !trip?.id) return;
    setActionLoading(true);
    try {
      const tripId = trip._id || trip.id;
      const res = await driverApi.pauseTrip(tripId);
      setTrip(res.data?.data?.trip || res.data?.trip || { ...trip, status: 'PAUSED' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to pause trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeTrip = async () => {
    if (!trip?._id && !trip?.id) return;
    setActionLoading(true);
    try {
      const tripId = trip._id || trip.id;
      const res = await driverApi.resumeTrip(tripId);
      setTrip(res.data?.data?.trip || res.data?.trip || { ...trip, status: 'RUNNING' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resume trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!trip?._id && !trip?.id) return;
    if (!window.confirm('Are you sure you want to end this trip? Telemetry will conclude.')) return;

    setActionLoading(true);
    try {
      const tripId = trip._id || trip.id;
      await driverApi.endTrip(tripId);
      setIsSimulating(false);
      setTrip(null);
      await loadActiveTrip();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to end trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const isRunning = trip && (trip.status === 'RUNNING' || trip.status === 'in_progress');
  const isPaused = trip && trip.status === 'PAUSED';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Initializing driver telemetry console...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Off-Route Alert */}
      {trip?.status === 'OFF_ROUTE' && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-300 text-red-900 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-bold">OFF-ROUTE DETECTED</p>
            <p className="text-xs">Your vehicle is more than 2.5 km away from assigned route stops. Return to designated route.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Compass className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Driver Telemetry Console
              </h1>
              <p className="text-xs text-slate-500">
                Assigned Bus: <strong className="text-slate-800">{bus?.busNumber || bus?.registrationNumber || 'KA-01-EA-2024'}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={trip?.status || 'NOT_STARTED'} />
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              <Radio className="w-3 h-3 animate-pulse text-blue-600" />
              Live Broadcasting
            </span>
          )}
        </div>
      </div>

      {/* Controls & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Actions & Speedometer (Col 1) */}
        <div className="space-y-4">
          {/* Trip Control Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Trip Journey Control
            </h3>

            {!trip || trip.status === 'COMPLETED' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Route Direction:
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="MORNING">Morning (City &rarr; Campus)</option>
                    <option value="EVENING">Evening (Campus &rarr; City)</option>
                  </select>
                </div>

                <button
                  onClick={handleStartTrip}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start New Trip</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {isRunning ? (
                    <button
                      onClick={handlePauseTrip}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause Trip</span>
                    </button>
                  ) : isPaused ? (
                    <button
                      onClick={handleResumeTrip}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Resume Trip</span>
                    </button>
                  ) : null}

                  <button
                    onClick={handleEndTrip}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md shadow-red-600/20 transition"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>End Trip</span>
                  </button>
                </div>

                {/* Simulation Mode Toggle (for testing without driving) */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setIsSimulating(!isSimulating)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                      isSimulating
                        ? 'bg-purple-100 border-purple-300 text-purple-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{isSimulating ? 'Demo GPS Simulation (ACTIVE)' : 'Simulate GPS Driving (Dev Mode)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Speedometer & Stats */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>Telemetry Feed</span>
              <span>{pingsCount} updates sent</span>
            </div>

            <div className="text-center py-2">
              <div className="text-5xl font-black tracking-tight text-white flex items-baseline justify-center gap-1">
                <span>{speed.toFixed(0)}</span>
                <span className="text-base font-medium text-slate-400">km/h</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Speedometer</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Heading:</span>
                <p className="font-semibold text-slate-200">{Math.round(heading)}°</p>
              </div>
              <div>
                <span className="text-slate-400">Last Synced:</span>
                <p className="font-semibold text-slate-200">
                  {lastPingTime ? lastPingTime.toLocaleTimeString() : 'Awaiting start'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Map & Route Visualizer (Col 2-3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <MapView
              busLocation={currentCoords ? { ...currentCoords, speed, heading } : null}
              routeStops={routeStops}
              autoCenter={true}
              busDetails={{
                busNumber: bus?.busNumber,
                route: trip?.route || bus?.route,
              }}
              height="450px"
            />
          </div>

          {/* Stops List Checklist */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center justify-between">
              <span>Route Stops Order</span>
              <span className="text-xs font-normal text-slate-500">
                {routeStops.length} Total Stops
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {routeStops.map((stop, i) => (
                <div key={stop._id || stop.id || i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {stop.sequenceNumber || i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{stop.name}</p>
                    {stop.scheduledTime && (
                      <p className="text-[10px] text-slate-500">{stop.scheduledTime}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverConsole;
