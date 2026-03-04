import { apiClient } from './client.js';

export function createPreMarriageAppointment(payload) {
  return apiClient.post('/appointments/pre-marriage', payload);
}

export function createUsapanAppointment(payload) {
  return apiClient.post('/appointments/usapan-series', payload);
}

export function getMyUsapanAppointments() {
  return apiClient.get('/appointments/usapan-series/me');
}

export function getMyPreMarriageAppointments() {
  return apiClient.get('/appointments/pre-marriage/me');
}

export function getAllAppointments() {
  return apiClient.get('/appointments');
}

export function updateAppointmentStatus(id, status) {
  return apiClient.patch(`/appointments/${id}/status`, { status });
}
