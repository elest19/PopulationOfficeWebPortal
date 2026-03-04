import { apiClient } from './client.js';

export function submitFeedback(payload) {
  return apiClient.post('/feedback', payload);
}

export function submitClientSatisfactionFeedback(payload) {
  return apiClient.post('/feedback/client-satisfaction', payload);
}

export function getFeedback(params) {
  return apiClient.get('/feedback', { params });
}

export function getClientSatisfactionFeedback(params) {
  return apiClient.get('/feedback/client-satisfaction', { params });
}

export function getClientSatisfactionFeedbackById(id) {
  return apiClient.get(`/feedback/client-satisfaction/${id}`);
}

export function deleteClientSatisfactionFeedback(id) {
  return apiClient.delete(`/feedback/client-satisfaction/${id}`);
}

export function updateFeedbackStatus(id, status) {
  return apiClient.patch(`/feedback/${id}`, { status });
}

export function getFeedbackAnalytics() {
  return apiClient.get('/feedback/analytics');
}

export function getFeedbackById(id) {
  return apiClient.get(`/feedback/${id}`);
}

export function deleteFeedback(id) {
  return apiClient.delete(`/feedback/${id}`);
}
