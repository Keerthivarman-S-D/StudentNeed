/**
 * Cloudinary Direct Browser Upload Utility for StudentNeed
 * 
 * Provides validated, secure, unsigned uploads directly from the browser to Cloudinary.
 * Complies with OWASP security guidelines:
 * - Strict client-side MIME type filtering
 * - Explicit file extension validation
 * - Maximum 5 MB payload limit
 * - No API Secrets exposed in client-side code
 */

import { auth } from './firebase';
import { API_BASE_URL } from '../config/api';

export const CLOUDINARY_CLOUD_NAME = 
  (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || 'ddc64bq61';

export const CLOUDINARY_UPLOAD_PRESET = 
  (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string) || 'studentneed_images';

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp'
] as const;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file size, MIME type, and extension to prevent malicious uploads.
 * Explicitly rejects SVGs, scripts, and non-image formats.
 */
export function validateImageFile(file: File | null | undefined): ValidationResult {
  if (!file) {
    return { valid: false, error: 'Please select an image file.' };
  }

  // 1. Validate file size (<= 5MB)
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeInMb} MB) exceeds the 5 MB limit. Please select a smaller photo.`
    };
  }

  // 2. Validate MIME type
  const mime = file.type ? file.type.toLowerCase().trim() : '';
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime as any)) {
    return {
      valid: false,
      error: 'Unsupported file format. Only JPG, JPEG, PNG, and WEBP images are allowed. SVG and other file types are rejected.'
    };
  }

  // 3. Validate file extension (defense-in-depth against extension-spoofing)
  const nameParts = file.name.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop()!.toLowerCase().trim() : '';
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `Unsupported file extension ".${ext}". Only .jpg, .jpeg, .png, and .webp files are supported.`
    };
  }

  return { valid: true };
}

/**
 * Safely downscales very large camera photos on a canvas before uploading.
 * Reduces bandwidth, upload latency, and storage footprint without noticeable quality loss.
 * Falls back to the original file if the browser canvas is unsupported or fails.
 */
export async function optimizeImageBeforeUpload(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.88
): Promise<Blob | File> {
  // If file is already small (e.g. under 500 KB), upload directly
  if (file.size < 500 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    // Fail-safe timeout in case image decoding hangs
    const timeout = setTimeout(() => {
      resolve(file);
    }, 4000);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // If dimensions are within bounds, do not resize
      if (width <= maxWidth && height <= maxHeight) {
        resolve(file);
        return;
      }

      // Preserve aspect ratio
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Keep PNG if original is PNG, otherwise use JPEG for efficient compression
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          outputMime,
          quality
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

export class UploadCancelledError extends Error {
  constructor(message = 'Image upload was cancelled.') {
    super(message);
    this.name = 'UploadCancelledError';
  }
}

export interface CloudinaryUploadOptions {
  folder: 'studentneed/avatars' | 'studentneed/listings';
  optimize?: boolean;
  maxDimension?: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads an image file directly to Cloudinary using an unsigned upload preset.
 * Returns the secure HTTPS URL (`secure_url`).
 * Supports upload cancellation via AbortSignal and upload progress reporting.
 */
export async function uploadImageToCloudinary(
  file: File,
  options: CloudinaryUploadOptions
): Promise<string> {
  // Check if aborted before starting
  if (options.signal?.aborted) {
    throw new UploadCancelledError();
  }

  // 1. Strict pre-upload client-side validation
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  const cloudName = CLOUDINARY_CLOUD_NAME;
  const uploadPreset = CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary cloud name or upload preset configuration is missing.');
  }

  // 2. Safe image optimization
  let uploadPayload: Blob | File = file;
  if (options.optimize !== false) {
    try {
      const maxDim = options.maxDimension || (options.folder === 'studentneed/avatars' ? 800 : 1600);
      uploadPayload = await optimizeImageBeforeUpload(file, maxDim, maxDim);
    } catch {
      uploadPayload = file;
    }
  }

  if (options.signal?.aborted) {
    throw new UploadCancelledError();
  }

  // Ensure user is authenticated before attempting upload
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required to upload photos. Please sign in with your student account.');
  }

  const idToken = await currentUser.getIdToken();
  const apiBase = API_BASE_URL;

  // 3. First Attempt: Signed Direct Upload
  // Request Cloudinary cryptographic signature from authenticated backend
  try {
    const sigRes = await fetch(`${apiBase}/api/upload/signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ folder: options.folder }),
      signal: options.signal
    });

    if (sigRes.ok) {
      const sigData = await sigRes.json();
      if (sigData.signed === true && sigData.signature && sigData.apiKey && sigData.timestamp) {
        const formData = new FormData();
        formData.append('file', uploadPayload, file.name);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', sigData.timestamp.toString());
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder || options.folder);

        const targetCloud = sigData.cloudName || cloudName;
        const endpoint = `https://api.cloudinary.com/v1_1/${targetCloud}/image/upload`;
        return await uploadToCloudinaryEndpoint(endpoint, formData, options);
      }
    }
  } catch (sigErr) {
    if (options.signal?.aborted) {
      throw new UploadCancelledError();
    }
    console.warn('Signed upload negotiation failed, falling back to authenticated backend proxy:', sigErr);
  }

  // 4. Second Attempt: Route via backend image upload proxy
  // Helper to convert Blob/File to Data URL for backend proxy
  const toDataUrl = (blob: Blob | File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  try {
    const base64Data = await toDataUrl(uploadPayload);
    const proxyRes = await fetch(`${apiBase}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        file: base64Data,
        folder: options.folder
      }),
      signal: options.signal
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data?.secure_url) {
        return data.secure_url;
      }
    } else {
      const errorData = await proxyRes.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload proxy failed (HTTP ${proxyRes.status}).`);
    }
  } catch (proxyErr: any) {
    if (options.signal?.aborted) {
      throw new UploadCancelledError();
    }
    throw new Error(proxyErr.message || 'Failed to upload photo to storage. Please try again.');
  }

  throw new Error('Failed to upload photo. Storage service unavailable.');
}

/**
 * Sends FormData to Cloudinary upload REST endpoint with abort signal and progress tracking
 */
function uploadToCloudinaryEndpoint(
  endpoint: string,
  formData: FormData,
  options: CloudinaryUploadOptions
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    const onAbort = () => {
      xhr.abort();
      reject(new UploadCancelledError());
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener('abort', onAbort);
    }

    if (xhr.upload && options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100);
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.secure_url) {
            resolve(data.secure_url);
          } else {
            reject(new Error('Image upload succeeded but no secure URL was returned.'));
          }
        } catch {
          reject(new Error('Invalid response received from image upload server.'));
        }
      } else {
        let errorMessage = 'Failed to upload photo. Please try again.';
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error?.message) {
            errorMessage = data.error.message;
          }
        } catch {
          errorMessage = `Image upload failed (HTTP ${xhr.status}).`;
        }
        reject(new Error(errorMessage));
      }
    };

    xhr.onerror = () => {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      reject(new Error('Unable to connect to image upload service. Please check your internet connection.'));
    };

    xhr.onabort = () => {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      reject(new UploadCancelledError());
    };

    xhr.send(formData);
  });
}

/**
 * Generates an optimized, resized thumbnail URL using Cloudinary URL transformations,
 * preventing downloading original high-resolution assets for small preview cards.
 * Also supports Unsplash URLs if encountered in existing/mock listings.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options?: { width?: number; height?: number; quality?: string | number }
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const width = options?.width || 400;
  const quality = options?.quality || 'auto';

  // Cloudinary image transformation
  if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/image/upload/')) {
    const uploadMarker = '/image/upload/';
    const markerIndex = trimmed.indexOf(uploadMarker);
    const prefix = trimmed.slice(0, markerIndex + uploadMarker.length);
    const suffix = trimmed.slice(markerIndex + uploadMarker.length);

    // If the path immediately following /upload/ already contains transformation parameters, return as is
    if (/^[a-z]_[a-z0-9_,-]+\//i.test(suffix)) {
      return trimmed;
    }

    const transform = `c_fill,w_${width},q_${quality},f_auto`;
    return `${prefix}${transform}/${suffix}`;
  }

  // Unsplash image transformation
  if (trimmed.includes('images.unsplash.com')) {
    const separator = trimmed.includes('?') ? '&' : '?';
    if (!trimmed.includes('w=')) {
      return `${trimmed}${separator}w=${width}&q=80&auto=format`;
    }
  }

  return trimmed;
}

