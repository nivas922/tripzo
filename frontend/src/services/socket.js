import { io } from 'socket.io-client';
import { getApiBaseUrl } from './api';

let socket = null;

export const initSocket = (token) => {
  if (socket) {
    if (socket.connected) return socket;
    socket.disconnect();
  }

  const serverUrl = getApiBaseUrl();
  socket = io(serverUrl, {
    auth: {
      token: token || localStorage.getItem('tripzo_token'),
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected with ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const joinBusRoom = (busId) => {
  const s = getSocket();
  if (s && busId) {
    s.emit('join:bus', busId);
    s.emit('bus:join', busId);
  }
};

export const leaveBusRoom = (busId) => {
  const s = getSocket();
  if (s && busId) {
    s.emit('leave:bus', busId);
    s.emit('bus:leave', busId);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
