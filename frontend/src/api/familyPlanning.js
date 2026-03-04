import { apiClient } from './client.js';

export function createFamilyPlanningBooking(payload) {
  return apiClient.post('/family-planning/bookings', payload);
}

export function getFamilyPlanningBookings(params) {
  return apiClient.get('/family-planning/admin/bookings', { params });
}

export function getMyFamilyPlanningBookings() {
  return apiClient.get('/family-planning/bookings/me');
}

export function deleteFamilyPlanningBooking(id) {
  return apiClient.delete(`/family-planning/admin/bookings/${id}`);
}

export function approveFamilyPlanningBooking(id, note) {
  return apiClient.post(`/family-planning/admin/bookings/${id}/approve`, note ? { note } : {});
}

export function rejectFamilyPlanningBooking(id, reason) {
  return apiClient.post(`/family-planning/admin/bookings/${id}/reject`, { reason });
}

export function cancelFamilyPlanningBooking(id, reason) {
  return apiClient.post(`/family-planning/admin/bookings/${id}/cancel`, { reason });
}

export function archiveFamilyPlanningBooking(id) {
  return apiClient.post(`/family-planning/admin/bookings/${id}/archive`);
}

export function unarchiveFamilyPlanningBooking(id) {
  return apiClient.post(`/family-planning/admin/bookings/${id}/unarchive`);
}

export function getFamilyPlanningAnalytics() {
  return apiClient.get('/family-planning/admin/analytics');
}