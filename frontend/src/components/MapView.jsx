import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Helper component to auto-pan map when bus moves
const MapController = ({ center, autoCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (autoCenter && center && center[0] && center[1]) {
      map.setView(center, map.getZoom() || 14, { animate: true });
    }
  }, [center, autoCenter, map]);

  return null;
};

// Create custom bus marker with rotating direction heading
const createBusIcon = (heading = 0, isRunning = true) => {
  return L.divIcon({
    className: 'custom-bus-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        ${isRunning ? '<div class="bus-marker-pulse" style="position: absolute; inset: 0; border-radius: 9999px; background-color: rgba(37, 99, 235, 0.35);"></div>' : ''}
        <div style="position: relative; width: 36px; height: 36px; background-color: #2563eb; border: 3px solid #ffffff; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.5s ease;">
          <svg style="width: 20px; height: 20px; color: #ffffff;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8m-8 4h8m-6 4h4M5 3h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm2 14v2m10-2v2"></path>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

// Create custom stop marker with sequence number or highlighted user stop
const createStopIcon = (sequenceNumber, isUserStop = false) => {
  const bgColor = isUserStop ? '#f59e0b' : '#334155';
  const ring = isUserStop ? 'stop-user-glow' : '';

  return L.divIcon({
    className: `custom-stop-marker ${ring}`,
    html: `
      <div style="width: 28px; height: 28px; background-color: ${bgColor}; border: 2.5px solid #ffffff; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 11px; font-weight: 700;">
        ${isUserStop ? '★' : sequenceNumber || '•'}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

export const MapView = ({
  busLocation,
  routeStops = [],
  userStopId = null,
  autoCenter = true,
  busDetails = {},
  height = '500px',
}) => {
  // Default coordinates: Bangalore (College Campus area) or first stop or bus location
  const defaultCenter = busLocation?.latitude && busLocation?.longitude
    ? [busLocation.latitude, busLocation.longitude]
    : routeStops[0]?.location?.coordinates
    ? [routeStops[0].location.coordinates[1], routeStops[0].location.coordinates[0]]
    : [12.9250, 77.6850];

  // Build polyline route array [lat, lng]
  const polylinePositions = routeStops
    .filter((s) => s.location && Array.isArray(s.location.coordinates))
    .map((s) => [s.location.coordinates[1], s.location.coordinates[0]]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController center={defaultCenter} autoCenter={autoCenter} />

        {/* Route Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#2563eb',
              weight: 5,
              opacity: 0.75,
              dashArray: '1, 8',
              lineCap: 'round',
            }}
          />
        )}

        {/* Stops Markers */}
        {routeStops.map((stop, idx) => {
          if (!stop.location || !Array.isArray(stop.location.coordinates)) return null;
          const lat = stop.location.coordinates[1];
          const lng = stop.location.coordinates[0];
          const isUserStop = userStopId && (stop._id === userStopId || stop.id === userStopId);

          return (
            <Marker
              key={stop._id || stop.id || idx}
              position={[lat, lng]}
              icon={createStopIcon(stop.sequenceNumber || idx + 1, isUserStop)}
            >
              <Popup>
                <div className="p-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    {isUserStop && <span className="text-amber-500 font-extrabold text-sm">★ YOUR STOP</span>}
                    <span>{stop.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Stop #{stop.sequenceNumber || idx + 1}</p>
                  {stop.scheduledTime && (
                    <p className="text-xs font-medium text-blue-600 mt-1">Scheduled: {stop.scheduledTime}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Live Bus Marker */}
        {busLocation && busLocation.latitude && busLocation.longitude && (
          <Marker
            position={[busLocation.latitude, busLocation.longitude]}
            icon={createBusIcon(busLocation.heading || 0, busLocation.speed > 0)}
          >
            <Popup>
              <div className="p-2 min-w-[160px]">
                <div className="font-bold text-sm text-blue-700 flex items-center gap-1">
                  <span>🚍</span> {busDetails.busNumber || 'College Bus'}
                </div>
                {busDetails.route && (
                  <p className="text-xs text-slate-600 mt-1">Route: <strong>{busDetails.route.name || busDetails.route.routeNumber}</strong></p>
                )}
                <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-xs">
                  <div>
                    <span className="text-slate-400">Speed:</span>
                    <p className="font-semibold text-slate-700">{(busLocation.speed || 0).toFixed(1)} km/h</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Heading:</span>
                    <p className="font-semibold text-slate-700">{Math.round(busLocation.heading || 0)}°</p>
                  </div>
                </div>
                {busLocation.timestamp && (
                  <p className="text-[10px] text-slate-400 mt-2">
                    Updated: {new Date(busLocation.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default MapView;
