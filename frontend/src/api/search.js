import { apiClient } from './client.js';

export function searchSite(params) {
  return apiClient.get('/search', { params });
}
