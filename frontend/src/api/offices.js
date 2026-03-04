import { apiClient } from './client.js';

export function getMainOffice() {
  return apiClient.get('/offices/main');
}

export function updateMainOffice(payload) {
  return apiClient.put('/offices/main', payload);
}
