const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.8;
const JPEG_FALLBACK_QUALITY = 0.85;

/**
 * Loads a File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = url;
  });
}

/**
 * Checks if the browser supports WebP canvas export.
 */
function supportsWebP(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/**
 * Compresses and resizes an image file using the Canvas API.
 *
 * - Resizes to fit within MAX_DIMENSION (preserving aspect ratio)
 * - Converts to WebP (or JPEG fallback on unsupported browsers)
 * - Returns a new File object ready for upload
 *
 * IMPORTANT: EXIF data (including GPS) is stripped by canvas.
 * Extract GPS from the original file BEFORE calling this function.
 */
export async function compressImage(file: File): Promise<File> {
  const img = await loadImage(file);

  let { width, height } = img;

  // Only downscale, never upscale
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round((height / width) * MAX_DIMENSION);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width / height) * MAX_DIMENSION);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  const useWebP = supportsWebP();
  const mimeType = useWebP ? "image/webp" : "image/jpeg";
  const quality = useWebP ? WEBP_QUALITY : JPEG_FALLBACK_QUALITY;
  const ext = useWebP ? "webp" : "jpg";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      mimeType,
      quality
    );
  });

  return new File([blob], `memory.${ext}`, { type: mimeType });
}
