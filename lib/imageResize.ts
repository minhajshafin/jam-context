import imageCompression from 'browser-image-compression';

/**
 * Compresses and resizes an image file to under 200KB on the client
 * before it's sent to the API route.
 */
export async function resizeImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.2,         // 200 KB
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg',
  });
}
