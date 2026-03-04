import { apiClient } from './client.js';

export function createPmoBooking(payload) {
  return apiClient.post('/pmo/bookings', payload);
}

export function getPmoAvailableSchedules() {
  return apiClient.get('/pmo/schedules');
}

export function getPmoQuestionnaire() {
  return apiClient.get('/pmo/questionnaire');
}

export function getMyPmoAppointments() {
  return apiClient.get('/pmo/appointments/me');
}
