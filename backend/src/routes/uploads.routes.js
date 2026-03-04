const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

const config = require('../config/env');
const { getSupabaseClient } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isImage = file?.mimetype?.startsWith('image/');
    if (!isImage) {
      const err = new Error('Only image uploads are allowed');
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

router.post(
  '/image',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: { message: 'Image file is required' } });
      }

      const supabase = getSupabaseClient();
      const requestedBucket = String(req.query.bucket || '').trim();
      const allowedBuckets = ['news', 'announcements', 'about_us_image', 'education_corner_web', 'education_corner_booklet'];
      const bucket = allowedBuckets.includes(requestedBucket)
        ? requestedBucket
        : config.supabase.storageBucket;

      if (!bucket) {
        return res.status(500).json({ success: false, error: { message: 'Supabase storage bucket is not configured' } });
      }

      if (requestedBucket && !allowedBuckets.includes(requestedBucket)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid bucket for image upload.' } });
      }

      const processedBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1000, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;
      const path = `${year}/${month}/${fileName}`;

      const { error } = await supabase.storage.from(bucket).upload(path, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

      if (error) {
        const err = new Error(error.message || 'Failed to upload image');
        err.status = 500;
        throw err;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data?.publicUrl;

      if (!publicUrl) {
        const err = new Error('Failed to generate public URL');
        err.status = 500;
        throw err;
      }

      res.json({ success: true, data: { publicUrl, path } });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
