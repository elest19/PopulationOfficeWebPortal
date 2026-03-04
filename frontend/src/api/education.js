import { apiClient } from './client.js';

export function getEducationMaterials() {
  return apiClient.get('/education-materials');
}

export function getEducationMaterial(slug) {
  return apiClient.get(`/education-materials/${slug}`);
}

export function createEducationMaterial(payload) {
  return apiClient.post('/education-materials', payload);
}

export function updateEducationMaterial(id, payload) {
  return apiClient.put(`/education-materials/${id}`, payload);
}

export function deleteEducationMaterial(id) {
  return apiClient.delete(`/education-materials/${id}`);
}
