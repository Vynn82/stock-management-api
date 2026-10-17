import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';

dotenv.config();

const cloudName = process.env.CLOUD_NAME?.trim();
const apiKey = process.env.CLOUD_API_KEY?.trim();
const apiSecret = process.env.CLOUD_API_SECRET?.trim();

export const isCloudinaryConfigured = Boolean(
  cloudName && apiKey && apiSecret,
);

if (!isCloudinaryConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Cloudinary] CLOUD_NAME / CLOUD_API_KEY / CLOUD_API_SECRET missing in .env — image upload will fail.',
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export default cloudinary;
