import { io } from 'socket.io-client';

// Derive socket base URL from the API base URL
const rawApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const socketBaseUrl = rawApiBase.endsWith('/api') ? rawApiBase.slice(0, -4) : rawApiBase;

// Connect to the same origin as the REST API (without the /api path)
export const socket = io(socketBaseUrl, {
  withCredentials: true,
  autoConnect: true
});
