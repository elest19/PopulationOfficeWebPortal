import { apiClient } from './client.js';

export function listBooklets() {
  return apiClient.get('/education-corner/booklets');
}

export function createBooklet(payload) {
  return apiClient.post('/education-corner/booklets', payload);
}

export function updateBooklet(id, payload) {
  return apiClient.put(`/education-corner/booklets/${id}`, payload);
}

export function archiveBooklet(id) {
  return apiClient.put(`/education-corner/booklets/${id}/archive`);
}

export function listBookletPages(bookletId) {
  return apiClient.get(`/education-corner/booklets/${bookletId}/pages`);
}

export function createBookletPage(bookletId, payload) {
  return apiClient.post(`/education-corner/booklets/${bookletId}/pages`, payload);
}

export function updateBookletPage(id, payload) {
  return apiClient.put(`/education-corner/booklet-pages/${id}`, payload);
}

export function deleteBookletPage(id) {
  return apiClient.delete(`/education-corner/booklet-pages/${id}`);
}
