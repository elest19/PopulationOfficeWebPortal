import { apiClient } from './client.js';

export function getUsers(params) {
  return apiClient.get('/users', { params });
}

export function createUser(payload) {
  return apiClient.post('/users', payload);
}

export function updateUser(id, payload) {
  return apiClient.put(`/users/${id}`, payload);
}

export function setUserActive(id, isActive) {
  return apiClient.patch(`/users/${id}/active`, { isActive });
}

export function deleteUser(id) {
  // Soft-delete: deactivate the user using the existing backend route
  return apiClient.patch(`/users/${id}/active`, { isActive: false });
}

export function updateMyProfile(payload) {
  return apiClient.put('/users/me', payload);
}

export function deleteMyAccount() {
  return apiClient.delete('/users/me');
}

export function getUsersAnalytics() {
  return apiClient.get('/users/analytics');
}
