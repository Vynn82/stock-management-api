import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.config';

export const productStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'stock-management/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  }),
});

export const variantStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'stock-management/product-variants',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  }),
});
