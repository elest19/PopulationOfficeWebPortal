import { apiClient } from './client.js';

export function getPmoAdminSchedules() {
  return apiClient.get('/pmo/admin/schedules');
}

export function updatePmoAdminSchedule(id, payload) {
  return apiClient.put(`/pmo/admin/schedules/${id}`, payload);
}

// Hard delete (no longer used in UI; archive instead)
export function deletePmoAdminSchedule(id) {
  return apiClient.delete(`/pmo/admin/schedules/${id}`);
}

export function archivePmoAdminSchedule(id) {
  return apiClient.patch(`/pmo/admin/schedules/${id}/archive`);
}

export function unarchivePmoAdminSchedule(id) {
  return apiClient.patch(`/pmo/admin/schedules/${id}/unarchive`);
}

export function getPmoAdminBookings() {
  return apiClient.get('/pmo/admin/bookings');
}

export function getPmoAdminAnswers() {
  return apiClient.get('/pmo/admin/answers');
}

export function getPmoAdminAnalytics() {
  return apiClient.get('/pmo/admin/analytics');
}

export function getPmoAdminQuestionnaire() {
  return apiClient.get('/pmo/admin/questionnaire');
}

// Public read-only questionnaire for MEIF preview in services
export function getPmoQuestionnairePublic() {
  return apiClient.get('/pmo/questionnaire');
}

export function createPmoAdminQuestion(payload) {
  return apiClient.post('/pmo/admin/questionnaire', payload);
}

export function updatePmoAdminQuestion(id, payload) {
  return apiClient.put(`/pmo/admin/questionnaire/${id}`, payload);
}

export function deletePmoAdminQuestion(id) {
  return apiClient.delete(`/pmo/admin/questionnaire/${id}`);
}

export function getPmoAdminAppointments() {
  return apiClient.get('/pmo/admin/appointments');
}

export function acceptPmoAppointment(id) {
  return apiClient.post(`/pmo/admin/appointments/${id}/accept`);
}

export function rejectPmoAppointment(id, reason) {
  return apiClient.post(`/pmo/admin/appointments/${id}/reject`, { reason });
}

export function cancelPmoAppointment(id, reason) {
  return apiClient.post(`/pmo/admin/appointments/${id}/cancel`, { reason });
}

export function archivePmoAppointment(id) {
  return apiClient.patch(`/pmo/admin/appointments/${id}/archive`);
}

export function unarchivePmoAppointment(id) {
  return apiClient.patch(`/pmo/admin/appointments/${id}/unarchive`);
}

export function getPmoSmsLogs(params) {
  return apiClient.get('/pmo/admin/sms-logs', { params });
}

export function getPmoAdminMeif(appointmentId) {
  return apiClient.get(`/pmo/admin/appointments/${appointmentId}/meif`);
}
