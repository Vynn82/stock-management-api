import cloudinary from './cloudinary.config';

/**
 * Extracts public_id from a Cloudinary secure or standard URL.
 * Example URL:
 * https://res.cloudinary.com/dlob9mwy3/image/upload/v1726801234/stock-management/products/macbook.png
 * Extracted public_id: "stock-management/products/macbook"
 */
export function extractCloudinaryPublicId(
  imageUrl?: string | null,
): string | null {
  if (
    !imageUrl ||
    typeof imageUrl !== 'string' ||
    !imageUrl.includes('cloudinary.com')
  ) {
    return null;
  }

  try {
    const parts = imageUrl.split('/upload/');
    if (parts.length < 2) return null;

    // Remove version prefix (e.g. v1789902655/) and file extension (.png, .jpg, etc.)
    const pathWithoutVersion = parts[1].replace(/^v\d+\//, '');
    const lastDotIndex = pathWithoutVersion.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return pathWithoutVersion;
    }
    return pathWithoutVersion.substring(0, lastDotIndex);
  } catch {
    return null;
  }
}

/**
 * Deletes a single image from Cloudinary by its URL.
 */
export async function deleteCloudinaryImage(
  imageUrl?: string | null,
): Promise<boolean> {
  const publicId = extractCloudinaryPublicId(imageUrl);
  if (!publicId) return false;

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset [${publicId}]:`, error);
    return false;
  }
}

/**
 * Deletes multiple images from Cloudinary concurrently.
 */
export async function deleteMultipleCloudinaryImages(
  imageUrls: (string | null | undefined)[],
): Promise<void> {
  const validUrls = imageUrls.filter((url): url is string => Boolean(url));
  if (validUrls.length === 0) return;

  await Promise.allSettled(validUrls.map((url) => deleteCloudinaryImage(url)));
}
