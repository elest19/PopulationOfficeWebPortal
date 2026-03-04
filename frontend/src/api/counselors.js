import { apiClient } from './client.js';

export function getActiveCounselors() {
  return apiClient.get('/counselors/active');
}

export function getCounselors() {
  return apiClient.get('/counselors');
}

export function createCounselor(payload) {
  return apiClient.post('/counselors', payload);
}

export function updateCounselor(id, payload) {
  return apiClient.put(`/counselors/${id}`, payload);
}

export function deleteCounselor(id) {
  return apiClient.delete(`/counselors/${id}`);
}
