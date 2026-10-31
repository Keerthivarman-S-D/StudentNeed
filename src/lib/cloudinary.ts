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
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_CLOUDINARY_CLOUD_NAME as string) || 'ddc64bq61';

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
 * Detects the file format from raw header bytes (magic bytes / file signatures).
 * Accurately identifies JPEG, PNG, WebP, PDF, SVG/XML, and text/script payloads.
 */
export function detectImageSignature(bytes: Uint8Array): {
  format: 'jpeg' | 'png' | 'webp' | 'pdf' | 'svg' | 'unknown';
  isSafeImage: boolean;
} {
  if (bytes.length < 4) {
    return { format: 'unknown', isSafeImage: false };
  }

  // 1. PDF signature: %PDF (25 50 44 46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { format: 'pdf', isSafeImage: false };
  }

  // 2. SVG / XML / HTML / script detection via text decoding
  try {
    const textHeader = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.subarray(0, Math.min(bytes.length, 512)))
      .toLowerCase();

    if (
      textHeader.includes('<svg') ||
      textHeader.includes('<?xml') ||
      textHeader.includes('<!doctype svg') ||
      textHeader.includes('<html') ||
      textHeader.includes('<script')
    ) {
      return { format: 'svg', isSafeImage: false };
    }
  } catch {
    // Ignore decoding errors
  }

  // 3. JPEG signature: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { format: 'jpeg', isSafeImage: true };
  }

  // 4. PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return { format: 'png', isSafeImage: true };
  }

  // 5. WebP signature: RIFF .... WEBP
  // Bytes 0-3: 'RIFF' (52 49 46 46), Bytes 8-11: 'WEBP' (57 45 42 50)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { format: 'webp', isSafeImage: true };
  }

  return { format: 'unknown', isSafeImage: false };
}

/**
 * Asynchronously validates file size, declared MIME type, extension, and genuine magic byte signatures.
 * Explicitly rejects SVGs, PDFs, renamed or disguised files, malformed images, and files exceeding 5 MB.
 */
export async function validateImageFile(file: File | Blob | null | undefined): Promise<ValidationResult> {
  if (!file) {
    return { valid: false, error: 'Please select an image file.' };
  }

  // 1. Validate file size (<= 5MB and non-empty)
  if (file.size === 0) {
    return { valid: false, error: 'The selected file is empty.' };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeInMb} MB) exceeds the 5 MB limit. Please select a smaller photo.`
    };
  }

  if (file.size < 12) {
    return { valid: false, error: 'Malformed or truncated image file.' };
  }

  // 2. Validate declared MIME type
  const mime = file.type ? file.type.toLowerCase().trim() : '';
  if (mime && !ALLOWED_IMAGE_MIME_TYPES.includes(mime as any)) {
    return {
      valid: false,
      error: 'Unsupported file format. Only JPG, JPEG, PNG, and WEBP images are allowed. SVG and other file types are rejected.'
    };
  }

  // 3. Validate file extension (defense-in-depth against extension-spoofing)
  const fileName = 'name' in file ? (file as File).name : '';
  let ext = '';
  if (fileName) {
    const nameParts = fileName.split('.');
    ext = nameParts.length > 1 ? nameParts.pop()!.toLowerCase().trim() : '';
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as any)) {
      return {
        valid: false,
        error: `Unsupported file extension ".${ext}". Only .jpg, .jpeg, .png, and .webp files are supported.`
      };
    }
  }

  // 4. Validate actual file content via magic bytes (file signature)
  try {
    const slice = file.slice(0, Math.min(file.size, 512));
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const signature = detectImageSignature(bytes);

    if (signature.format === 'pdf') {
      return {
        valid: false,
        error: 'PDF documents cannot be uploaded as photos. Please select a JPG, PNG, or WebP image.'
      };
    }

    if (signature.format === 'svg') {
      return {
        valid: false,
        error: 'SVG vector files are not permitted for security reasons. Please select a standard JPG, PNG, or WebP image.'
      };
    }

    if (!signature.isSafeImage || signature.format === 'unknown') {
      return {
        valid: false,
        error: 'Malformed or unsupported image file. File content does not match genuine JPG, PNG, or WebP signatures.'
      };
    }

    // 5. Detect renamed / disguised files where content signature contradicts file extension
    if (ext) {
      if ((signature.format === 'jpeg') && (ext !== 'jpg' && ext !== 'jpeg')) {
        return {
          valid: false,
          error: `Renamed file detected: file content is JPEG but extension is ".${ext}". Please upload an authentic .${ext} image.`
        };
      }
      if (signature.format === 'png' && ext !== 'png') {
        return {
          valid: false,
          error: `Renamed file detected: file content is PNG but extension is ".${ext}". Please upload an authentic .${ext} image.`
        };
      }
      if (signature.format === 'webp' && ext !== 'webp') {
        return {
          valid: false,
          error: `Renamed file detected: file content is WebP but extension is ".${ext}". Please upload an authentic .${ext} image.`
        };
      }
    }

    // 6. Detect MIME type mismatch against actual signature
    if (mime) {
      if (signature.format === 'jpeg' && mime !== 'image/jpeg') {
        return { valid: false, error: 'MIME type does not match image signature (expected image/jpeg).' };
      }
      if (signature.format === 'png' && mime !== 'image/png') {
        return { valid: false, error: 'MIME type does not match image signature (expected image/png).' };
      }
      if (signature.format === 'webp' && mime !== 'image/webp') {
        return { valid: false, error: 'MIME type does not match image signature (expected image/webp).' };
      }
    }

    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to verify image file structure: ${err?.message || 'unknown error'}`
    };
  }
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
 * Uploads an image file exclusively through the authenticated backend validation and upload service (/api/upload/image).
 * Server enforces:
 * - 5 MB decoded buffer limit
 * - Magic byte inspection (rejecting PDFs, SVGs, HTML, and executables)
 * - Sharp decompression limits (max 4096px dimension, 16 MP input pixels)
 * - Safe image re-encoding (stripping polyglots and EXIF metadata)
 * - Verified student authorization
 * 
 * Direct browser uploads to Cloudinary are strictly eliminated.
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

  // 1. Strict pre-upload client-side validation (instant UX feedback)
  const validation = await validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  // 2. Client-side image optimization to reduce network bandwidth
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

  // Convert Blob/File to Data URL for backend payload
  const toDataUrl = (blob: Blob | File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const base64Data = await toDataUrl(uploadPayload);

  // 3. Sole Production Path: Authenticated backend upload route (/api/upload/image)
  // Direct client uploads to Cloudinary are completely removed to prevent security bypasses.
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase}/api/upload/image`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);

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
            reject(new Error('Image upload succeeded but no secure URL was returned by storage service.'));
          }
        } catch {
          reject(new Error('Invalid response received from upload service.'));
        }
      } else {
        let errorMessage = 'Upload rejected by server.';
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error) {
            errorMessage = data.error;
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
      // Clear, retryable upload error when backend is unreachable or offline
      reject(new Error('Image upload service is temporarily unreachable. Please check your connection and try again.'));
    };

    xhr.ontimeout = () => {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      reject(new Error('Image upload request timed out. Please try again.'));
    };

    xhr.onabort = () => {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      reject(new UploadCancelledError());
    };

    xhr.send(
      JSON.stringify({
        file: base64Data,
        folder: options.folder,
      })
    );
  });
}

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: string | number;
  crop?: 'fill' | 'thumb' | 'fit' | 'limit';
  gravity?: 'auto' | 'face' | 'center';
  format?: 'auto' | 'webp' | 'avif' | 'jpg';
  dpr?: 'auto' | number;
}

/**
 * Generates an optimized, resized thumbnail URL using Cloudinary URL transformations,
 * preventing downloading original high-resolution assets for small preview cards.
 * Also supports Unsplash URLs if encountered in existing/mock listings.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options?: ImageOptimizationOptions
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const width = options?.width || 400;
  const height = options?.height;
  const quality = options?.quality ?? 'auto:good';
  const crop = options?.crop || 'fill';
  const gravity = options?.gravity;
  const format = options?.format || 'auto';
  const dpr = options?.dpr ?? 'auto';

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

    const parts: string[] = [`c_${crop}`, `w_${width}`];
    if (height) parts.push(`h_${height}`);
    if (gravity) parts.push(`g_${gravity}`);
    parts.push(`q_${quality}`);
    parts.push(`f_${format}`);
    if (dpr) parts.push(`dpr_${dpr}`);

    const transform = parts.join(',');
    return `${prefix}${transform}/${suffix}`;
  }

  // Unsplash image transformation
  if (trimmed.includes('images.unsplash.com')) {
    const separator = trimmed.includes('?') ? '&' : '?';
    if (!trimmed.includes('w=')) {
      let u = `${trimmed}${separator}w=${width}&q=80&auto=format`;
      if (height) u += `&h=${height}&fit=crop`;
      return u;
    }
  }

  return trimmed;
}

/**
 * Returns a responsive srcSet string for Cloudinary images (e.g. "url 320w, url 640w")
 */
export function getResponsiveImageSrcSet(
  url: string | null | undefined,
  widths: number[] = [320, 480, 640, 960],
  options?: Omit<ImageOptimizationOptions, 'width'>
): string {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return '';
  return widths
    .map((w) => `${getOptimizedImageUrl(url, { ...options, width: w })} ${w}w`)
    .join(', ');
}

/**
 * Generates an optimized square thumbnail for avatar images with face auto-centering
 */
export function getOptimizedAvatarUrl(
  url: string | null | undefined,
  size: number = 96
): string {
  return getOptimizedImageUrl(url, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'face',
    quality: 'auto:good',
    format: 'auto',
    dpr: 'auto',
  });
}

/**
 * Generates an optimized listing card thumbnail
 */
export function getOptimizedListingUrl(
  url: string | null | undefined,
  width: number = 600,
  height?: number
): string {
  return getOptimizedImageUrl(url, {
    width,
    height,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    format: 'auto',
    dpr: 'auto',
  });
}

