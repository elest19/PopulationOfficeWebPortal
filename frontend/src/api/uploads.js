import { apiClient } from './client.js';

export function uploadImage(file, { onProgress, bucket } = {}) {
  const formData = new FormData();
  formData.append('image', file);

  const bucketParam = bucket ? `?bucket=${encodeURIComponent(bucket)}` : '';

  return apiClient.post(`/uploads/image${bucketParam}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress) return;
      const total = evt.total || 0;
      if (!total) return;
      const pct = Math.round((evt.loaded / total) * 100);
      onProgress(pct);
    }
  });
}

export function uploadNewsImage(file, opts) {
  return uploadImage(file, { ...opts, bucket: 'news' });
}

export function uploadAnnouncementImage(file, opts) {
  return uploadImage(file, { ...opts, bucket: 'announcements' });
}

export function uploadAboutUsImage(file, opts) {
  return uploadImage(file, { ...opts, bucket: 'about_us_image' });
}

export function uploadEducationWebImage(file, opts) {
  return uploadImage(file, { ...opts, bucket: 'education_corner_web' });
}

export function uploadEducationBookletImage(file, opts) {
  return uploadImage(file, { ...opts, bucket: 'education_corner_booklet' });
}
