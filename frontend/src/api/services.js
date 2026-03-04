import { apiClient } from './client.js';

export function getServices() {
  return apiClient.get('/services');
}

export function createService(payload) {
  return apiClient.post('/services', payload);
}

export function updateService(id, payload) {
  return apiClient.put(`/services/${id}`, payload);
}

export function deleteService(id) {
  return apiClient.delete(`/services/${id}`);
}
