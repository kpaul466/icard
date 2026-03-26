import { Bytes } from 'firebase/firestore';

/**
 * Converts a Firestore Bytes object or a string to a usable image source URL.
 */
export function getPhotoUrl(photo: any): string | undefined {
  if (!photo) return undefined;
  
  // If it's a Firestore Bytes object
  if (typeof photo === 'object' && 'toBase64' in photo) {
    return `data:image/png;base64,${photo.toBase64()}`;
  }
  
  // If it's already a string (base64 or URL)
  if (typeof photo === 'string') {
    return photo;
  }
  
  return undefined;
}
