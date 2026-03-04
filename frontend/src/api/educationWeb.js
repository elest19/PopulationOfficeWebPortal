import { apiClient } from './client.js';

export function listEducationWeb() {
  return apiClient.get('/education-corner/web');
}

export function createEducationWeb(payload) {
  return apiClient.post('/education-corner/web', payload);
}

export function updateEducationWeb(id, payload) {
  return apiClient.put(`/education-corner/web/${id}`, payload);
}

export function archiveEducationWeb(id) {
  return apiClient.put(`/education-corner/web/${id}/archive`);
}

export function unarchiveEducationWeb(id) {
  return apiClient.put(`/education-corner/web/${id}/unarchive`);
}

export function listEducationWebKeyConcepts(webId) {
  return apiClient.get(`/education-corner/web/${webId}/key-concepts`);
}

export function upsertEducationWebKeyConcepts(webId, concepts) {
  return apiClient.put(`/education-corner/web/${webId}/key-concepts`, { concepts });
}
