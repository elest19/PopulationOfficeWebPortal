import { apiClient } from './client.js';

export function getHierarchy() {
  return apiClient.get('/hierarchy');
}

export function createHierarchyEntry(payload) {
  return apiClient.post('/hierarchy', payload);
}

export function updateHierarchyEntry(id, payload) {
  return apiClient.put(`/hierarchy/${id}`, payload);
}

export function deleteHierarchyEntry(id) {
  return apiClient.delete(`/hierarchy/${id}`);
}
