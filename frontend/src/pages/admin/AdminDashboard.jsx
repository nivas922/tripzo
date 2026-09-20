import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import { 
  Bus, 
  Map, 
  Users, 
  UserCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  AlertCircle, 
  Route as RouteIcon,
  Shield,
  Activity,
  Search
} from 'lucide-react';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('buses'); // 'buses' | 'routes' | 'students' | 'trips'
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [students, setStudents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Modal / Form states
  const [showBusModal, setShowBusModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // New Bus form
  const [newBus, setNewBus] = useState({
    busNumber: '',
    registrationNumber: '',
    capacity: 40,
    routeId: '',
    driverId: '',
  });

  // New Route form
  const [newRoute, setNewRoute] = useState({
    routeNumber: '',
    name: '',
    description: '',
  });

  // New Stop form
  const [newStop, setNewStop] = useState({
    name: '',
    sequenceNumber: 1,
    latitude: 12.9250,
    longitude: 77.6850,
    scheduledTime: '08:00 AM',
  });

  // Student Assignment form
  const [assignment, setAssignment] = useState({
    busId: '',
    routeId: '',
    stopId: '',
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [busRes, routeRes, studentRes, driverRes, tripRes] = await Promise.allSettled([
        adminApi.getBuses(),
        adminApi.getRoutes(),
        adminApi.getStudents(),
        adminApi.getDrivers(),
        adminApi.getAllTrips(),
      ]);

      if (busRes.status === 'fulfilled') setBuses(busRes.value.data?.data?.buses || busRes.value.data?.buses || []);
      if (routeRes.status === 'fulfilled') setRoutes(routeRes.value.data?.data?.routes || routeRes.value.data?.routes || []);
      if (studentRes.status === 'fulfilled') setStudents(studentRes.value.data?.data?.students || studentRes.value.data?.students || []);
      if (driverRes.status === 'fulfilled') setDrivers(driverRes.value.data?.data?.drivers || driverRes.value.data?.drivers || []);
      if (tripRes.status === 'fulfilled') setTrips(tripRes.value.data?.data?.trips || tripRes.value.data?.trips || []);
    } catch (err) {
      console.error('[Admin] Load data failed:', err);
      setErrorMsg('Failed to load some admin data from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handlers
  const handleCreateBus = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createBus(newBus);
      setActionMsg('Bus created successfully!');
      setShowBusModal(false);
      setNewBus({ busNumber: '', registrationNumber: '', capacity: 40, routeId: '', driverId: '' });
      loadAllData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create bus');
    }
  };

  const handleDeleteBus = async (busId) => {
    if (!window.confirm('Are you sure you want to delete this bus?')) return;
    try {
      await adminApi.deleteBus(busId);
      setActionMsg('Bus deleted successfully');
      loadAllData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete bus');
    }
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createRoute(newRoute);
      setActionMsg('Route created successfully!');
      setShowRouteModal(false);
      setNewRoute({ routeNumber: '', name: '', description: '' });
      loadAllData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create route');
    }
  };

  const handleAddStop = async (e) => {
    e.preventDefault();
    if (!selectedRouteId) return;
    try {
      await adminApi.addStop(selectedRouteId, {
        name: newStop.name,
        sequenceNumber: parseInt(newStop.sequenceNumber, 10),
        latitude: parseFloat(newStop.latitude),
        longitude: parseFloat(newStop.longitude),
        scheduledTime: newStop.scheduledTime,
      });
      setActionMsg('Stop added to route successfully!');
      setShowStopModal(false);
      setNewStop({ name: '', sequenceNumber: 1, latitude: 12.9250, longitude: 77.6850, scheduledTime: '08:00 AM' });
      loadAllData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to add stop');
    }
  };

  const handleAssignStudent = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      await adminApi.assignStudent(selectedStudent._id || selectedStudent.id, {
        busId: assignment.busId,
        routeId: assignment.routeId,
        stopId: assignment.stopId,
      });
      setActionMsg('Student assigned successfully!');
      setSelectedStudent(null);
      loadAllData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to assign student');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading Fleet Management Console...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Notifications */}
      {actionMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{actionMsg}</span>
          </div>
          <button onClick={() => setActionMsg(null)} className="text-xs font-bold text-emerald-600 hover:text-emerald-800">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-600 hover:text-red-800">Dismiss</button>
        </div>
      )}

      {/* Admin Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-purple-600" />
            <span>Fleet Administration Console</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage college buses, routes, GPS tracking, and student fleet assignments.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBusModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Bus</span>
          </button>
          <button
            onClick={() => setShowRouteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Route</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Total Buses</p>
            <p className="text-2xl font-black text-slate-800">{buses.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <RouteIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Active Routes</p>
            <p className="text-2xl font-black text-slate-800">{routes.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Students</p>
            <p className="text-2xl font-black text-slate-800">{students.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Live Trips</p>
            <p className="text-2xl font-black text-slate-800">
              {trips.filter((t) => t.status === 'RUNNING' || t.status === 'in_progress').length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('buses')}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'buses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Bus className="w-4 h-4" />
            <span>Buses Fleet ({buses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'routes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <RouteIcon className="w-4 h-4" />
            <span>Routes & Stops ({routes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'students'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Assignments ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('trips')}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'trips'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Trips Log ({trips.length})</span>
          </button>
        </nav>
      </div>

      {/* TAB CONTENT: BUSES */}
      {activeTab === 'buses' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="px-6 py-3.5">Bus</th>
                  <th className="px-6 py-3.5">Registration</th>
                  <th className="px-6 py-3.5">Capacity</th>
                  <th className="px-6 py-3.5">Assigned Route</th>
                  <th className="px-6 py-3.5">Driver</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buses.map((bus) => (
                  <tr key={bus._id || bus.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{bus.busNumber}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{bus.registrationNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{bus.capacity || 40} Seats</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {bus.route?.name || bus.route?.routeNumber || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {bus.driver?.name || bus.driver?.email || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={bus.status || 'NOT_STARTED'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteBus(bus._id || bus.id)}
                        className="text-slate-400 hover:text-red-600 transition p-1"
                        title="Delete Bus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ROUTES */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {routes.map((route) => (
            <div key={route._id || route.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs uppercase font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    Route #{route.routeNumber}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{route.name}</h3>
                  {route.description && <p className="text-xs text-slate-500 mt-0.5">{route.description}</p>}
                </div>

                <button
                  onClick={() => {
                    setSelectedRouteId(route._id || route.id);
                    setShowStopModal(true);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stop</span>
                </button>
              </div>

              {/* Stops list */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Stops Sequence ({route.stops?.length || 0})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {route.stops && route.stops.length > 0 ? (
                    route.stops.map((s, idx) => (
                      <div key={s._id || s.id || idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold">
                            {s.sequenceNumber || idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800">{s.name}</span>
                        </div>
                        {s.scheduledTime && (
                          <span className="text-slate-500 font-mono text-[11px]">{s.scheduledTime}</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic py-2">No stops yet. Click "Add Stop" to add one.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: STUDENTS */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Assigned Bus</th>
                  <th className="px-6 py-3.5">Route</th>
                  <th className="px-6 py-3.5">Designated Stop</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student._id || student.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{student.name || 'Student'}</td>
                    <td className="px-6 py-4 text-slate-600">{student.email}</td>
                    <td className="px-6 py-4 text-slate-800 font-medium">
                      {student.assignedBus?.busNumber || 'None'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {student.assignedRoute?.name || 'None'}
                    </td>
                    <td className="px-6 py-4 text-amber-700 font-semibold">
                      {student.assignedStop?.name || 'None'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setAssignment({
                            busId: student.assignedBus?._id || '',
                            routeId: student.assignedRoute?._id || '',
                            stopId: student.assignedStop?._id || '',
                          });
                        }}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                      >
                        Assign / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TRIPS */}
      {activeTab === 'trips' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="px-6 py-3.5">Bus</th>
                  <th className="px-6 py-3.5">Direction</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Started At</th>
                  <th className="px-6 py-3.5">Ended At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.length > 0 ? (
                  trips.map((t) => (
                    <tr key={t._id || t.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 font-bold text-slate-900">{t.bus?.busNumber || 'Bus'}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{t.direction || 'MORNING'}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {t.startedAt ? new Date(t.startedAt).toLocaleString() : '--'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {t.endedAt ? new Date(t.endedAt).toLocaleString() : '--'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400 italic">
                      No historical trips recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE BUS MODAL */}
      {showBusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add New College Bus</h3>
            <form onSubmit={handleCreateBus} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bus Name/Number</label>
                <input
                  type="text"
                  required
                  value={newBus.busNumber}
                  onChange={(e) => setNewBus({ ...newBus, busNumber: e.target.value })}
                  placeholder="e.g. Bus 1 or Campus Shuttle A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  required
                  value={newBus.registrationNumber}
                  onChange={(e) => setNewBus({ ...newBus, registrationNumber: e.target.value })}
                  placeholder="e.g. KA-01-EA-2024"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Seating Capacity</label>
                <input
                  type="number"
                  value={newBus.capacity}
                  onChange={(e) => setNewBus({ ...newBus, capacity: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBusModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  Create Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROUTE MODAL */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add New Route</h3>
            <form onSubmit={handleCreateRoute} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Route Number</label>
                <input
                  type="text"
                  required
                  value={newRoute.routeNumber}
                  onChange={(e) => setNewRoute({ ...newRoute, routeNumber: e.target.value })}
                  placeholder="e.g. 12 or R-05"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Route Name</label>
                <input
                  type="text"
                  required
                  value={newRoute.name}
                  onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                  placeholder="e.g. South Campus to Central City"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={newRoute.description}
                  onChange={(e) => setNewRoute({ ...newRoute, description: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRouteModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  Create Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STOP MODAL */}
      {showStopModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add Stop to Route</h3>
            <form onSubmit={handleAddStop} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stop Name</label>
                <input
                  type="text"
                  required
                  value={newStop.name}
                  onChange={(e) => setNewStop({ ...newStop, name: e.target.value })}
                  placeholder="e.g. Silk Board Junction"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sequence #</label>
                  <input
                    type="number"
                    required
                    value={newStop.sequenceNumber}
                    onChange={(e) => setNewStop({ ...newStop, sequenceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Time</label>
                  <input
                    type="text"
                    value={newStop.scheduledTime}
                    onChange={(e) => setNewStop({ ...newStop, scheduledTime: e.target.value })}
                    placeholder="08:15 AM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newStop.latitude}
                    onChange={(e) => setNewStop({ ...newStop, latitude: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newStop.longitude}
                    onChange={(e) => setNewStop({ ...newStop, longitude: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowStopModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  Save Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN STUDENT MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Assign Fleet to {selectedStudent.name || selectedStudent.email}
            </h3>
            <form onSubmit={handleAssignStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Bus</label>
                <select
                  required
                  value={assignment.busId}
                  onChange={(e) => setAssignment({ ...assignment, busId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Bus --</option>
                  {buses.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.busNumber} ({b.registrationNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Route</label>
                <select
                  required
                  value={assignment.routeId}
                  onChange={(e) => setAssignment({ ...assignment, routeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Route --</option>
                  {routes.map((r) => (
                    <option key={r._id || r.id} value={r._id || r.id}>
                      Route #{r.routeNumber} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designated Stop</label>
                <select
                  required
                  value={assignment.stopId}
                  onChange={(e) => setAssignment({ ...assignment, stopId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Designated Stop --</option>
                  {routes
                    .find((r) => (r._id || r.id) === assignment.routeId)
                    ?.stops?.map((s) => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        Stop #{s.sequenceNumber}: {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
