import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import cloudinary, { isCloudinaryConfigured } from './cloudinary.config';

<<<<<<< HEAD
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function createStorage(folder: string): StorageEngine {
  const inner = new CloudinaryStorage({
    cloudinary,
    params: async () => ({
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    }),
  });

  // Wrap the engine so Cloudinary failures become readable HTTP errors
  // (instead of an opaque "Internal server error") and are logged.
  return {
    _handleFile(req, file, cb) {
      if (!isCloudinaryConfigured) {
        return cb(
          new BadGatewayException(
            'Image upload is not configured on the server (missing Cloudinary keys in .env).',
          ),
        );
      }
      inner._handleFile(req, file, (err, info) => {
        if (err) {
          const e = err as any;
          const detail = e?.message ?? e?.error?.message ?? String(e);
          // eslint-disable-next-line no-console
          console.error('[Cloudinary] upload failed:', e);
          return cb(
            new BadGatewayException(`Image upload failed: ${detail}`),
          );
        }
        cb(null, info);
      });
    },
    _removeFile(req, file, cb) {
      inner._removeFile(req, file, cb);
    },
  };
}

export const productStorage = createStorage('stock-management/products');
export const variantStorage = createStorage(
  'stock-management/product-variants',
);

/** Multer options shared by every endpoint that accepts product images. */
export const imageUploadOptions = {
  storage: productStorage,
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    // Some clients send `application/octet-stream` for a perfectly good
    // image; Cloudinary still validates the real content (allowed_formats),
    // so only reject types we know are unsupported.
    const mime = (file.mimetype || '').toLowerCase();
    const looksGeneric = !mime || mime === 'application/octet-stream';
    if (!looksGeneric && !ALLOWED_MIME.includes(mime)) {
      return cb(
        new BadRequestException(
          `Unsupported image type "${mime}" (${file.originalname}). Only JPG, PNG or WEBP are allowed.`,
        ),
        false,
      );
    }
    cb(null, true);
  },
};
=======
export const productStorage = new CloudinaryStorage({
  cloudinary,
  params: () => ({
    folder: 'stock-management/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  }),
});

export const variantStorage = new CloudinaryStorage({
  cloudinary,
  params: () => ({
    folder: 'stock-management/product-variants',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  }),
});
>>>>>>> f3cc2470de2f82d39b4ab61423685eb4c71b17a5
