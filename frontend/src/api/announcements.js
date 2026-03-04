import { apiClient } from './client.js';

export function getAnnouncements(params) {
  return apiClient.get('/announcements', { params });
}

export function createAnnouncement(payload) {
  return apiClient.post('/announcements', payload);
}

export function updateAnnouncement(id, payload) {
  return apiClient.put(`/announcements/${id}`, payload);
}

export function archiveAnnouncement(id) {
  return apiClient.patch(`/announcements/${id}/archive`);
}

export function unarchiveAnnouncement(id) {
  return apiClient.patch(`/announcements/${id}/unarchive`);
}

export function deleteAnnouncement(id) {
  return apiClient.delete(`/announcements/${id}`);
}
