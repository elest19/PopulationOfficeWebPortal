import { apiClient } from './client.js';

export function getLatestNews() {
  return apiClient.get('/news/latest');
}

// Public listing (published only)
export function getNewsList(params) {
  return apiClient.get('/news', { params });
}

// Admin listing: can see both published and archived
export function getNewsAdminList(params) {
  return apiClient.get('/news/admin', { params });
}

export function getNewsById(id) {
  return apiClient.get(`/news/${id}`);
}

export function createNews(payload) {
  return apiClient.post('/news', payload);
}

export function updateNews(id, payload) {
  return apiClient.put(`/news/${id}`, payload);
}

export function archiveNews(id) {
  return apiClient.put(`/news/${id}/archive`);
}

export function unarchiveNews(id) {
  return apiClient.put(`/news/${id}/unarchive`);
}

// Hard delete remains available for rare maintenance cases
export function deleteNews(id) {
  return apiClient.delete(`/news/${id}`);
}
