import multer from 'multer';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'wearora/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (_req, file) =>
      `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
  },
});

export const UPLOAD_ROOT = null;

export const productImageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPG, PNG or WEBP images are allowed', 400));
    }
  },
});