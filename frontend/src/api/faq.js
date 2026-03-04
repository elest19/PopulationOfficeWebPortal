import { apiClient } from './client.js';

export function getFaqs() {
  return apiClient.get('/faqs');
}

export function getFaqTopics() {
  return apiClient.get('/faqs/topics');
}

export function createFaq(payload) {
  return apiClient.post('/faqs', payload);
}

export function updateFaq(id, payload) {
  return apiClient.put(`/faqs/${id}`, payload);
}

export function deleteFaq(id) {
  return apiClient.delete(`/faqs/${id}`);
}
