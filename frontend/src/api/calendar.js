import { apiClient } from './client.js';

export function getCalendarEvents(params) {
  return apiClient.get('/calendar/events', { params });
}

export function createCalendarEvent(payload) {
  return apiClient.post('/calendar/events', payload);
}

export function updateCalendarEvent(id, payload) {
  return apiClient.put(`/calendar/events/${id}`, payload);
}

export function cancelCalendarEvent(id) {
  return apiClient.patch(`/calendar/events/${id}/cancel`);
}

export function deleteCalendarEvent(id) {
  return apiClient.delete(`/calendar/events/${id}`);
}

export function archiveCalendarEvent(id) {
  return apiClient.patch(`/calendar/events/${id}/archive`);
}

export function unarchiveCalendarEvent(id) {
  return apiClient.patch(`/calendar/events/${id}/unarchive`);
}

export function getArchivedUsapanSchedules() {
  return apiClient.get('/calendar/usapan/admin/schedules/archived');
}
