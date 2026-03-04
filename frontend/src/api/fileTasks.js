import { apiClient } from './client';

// Admin: list file tasks
export function getAdminFileTasks(params) {
  return apiClient.get('/file-tasks/admin', { params });
}

// Admin: create file task
export function createAdminFileTask(payload) {
  return apiClient.post('/file-tasks/admin', payload);
}

// Admin: update file task
export function updateAdminFileTask(id, payload) {
  return apiClient.put(`/file-tasks/admin/${id}`, payload);
}

// Admin: delete file task (hard delete)
export function deleteAdminFileTask(id) {
  return apiClient.delete(`/file-tasks/admin/${id}`);
}

// Admin: archive logical file task (soft delete)
export function archiveAdminFileTask(id) {
  return apiClient.patch(`/file-tasks/admin/${id}/archive`);
}

// Admin: unarchive logical file task
export function unarchiveAdminFileTask(id) {
  return apiClient.patch(`/file-tasks/admin/${id}/unarchive`);
}

// Barangay Officer: get my assigned file tasks
export function getMyFileTasks() {
  // Return the full Axios response so callers can access res.data.meta, etc.
  return apiClient.get('/file-tasks/me');
}

// Barangay Officer: submit a file for a task (first submission)
export async function submitTaskFile(fileTaskId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post(`/file-tasks/me/${fileTaskId}/submit`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

// Barangay Officer: replace an existing submission
export async function replaceTaskFile(fileTaskId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.put(`/file-tasks/me/${fileTaskId}/submit`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

// Barangay Officer: delete a submission
export async function deleteTaskFile(fileTaskId) {
  const response = await apiClient.delete(`/file-tasks/me/${fileTaskId}/submit`);
  return response.data;
}

// Backwards-compatible aliases used by ProfileModal.jsx
export function submitMyFileTask(fileTaskId, file) {
  return submitTaskFile(fileTaskId, file);
}

export function replaceMyFileTaskSubmission(fileTaskId, file) {
  return replaceTaskFile(fileTaskId, file);
}

export function deleteMyFileTaskSubmission(fileTaskId) {
  return deleteTaskFile(fileTaskId);
}
