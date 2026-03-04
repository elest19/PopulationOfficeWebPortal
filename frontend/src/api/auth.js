import { apiClient } from './client.js';

export function loginRequest(username, password) {
  return apiClient.post('/auth/login', { username, password });
}

export function fetchCurrentUser() {
  return apiClient.get('/auth/me');
}

export function registerRequest(payload) {
  return apiClient.post('/auth/register', payload);
}

// Forgot password flow
export function startPasswordReset(identifier) {
  return apiClient.post('/auth/forgot/start', { identifier });
}

export function verifyPasswordReset(identifier, code) {
  return apiClient.post('/auth/forgot/verify', { identifier, code });
}

export function completePasswordReset(identifier, code, newPassword) {
  return apiClient.post('/auth/forgot/reset', { identifier, code, newPassword });
}
