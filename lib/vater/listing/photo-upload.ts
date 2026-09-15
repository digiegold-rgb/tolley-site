/** Shared browser/token policy. Originals bypass serverless request bodies. */
export const LISTING_PHOTO_MAX_BYTES = 100 * 1024 * 1024;
export const LISTING_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const LISTING_PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export function listingPhotoType(file: { name: string; type: string }): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const type = types[extension ?? ''];
  return type && (!file.type || file.type === 'application/octet-stream' || file.type === type || (type === 'image/jpeg' && file.type === 'image/jpg')) ? type : null;
}
export function listingPhotoTokenPolicy(pathname: string) {
  if (!/^vater\/listing-photos\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(pathname)) {
    throw new Error('Invalid listing photo path.');
  }
  return {
    allowedContentTypes: LISTING_PHOTO_TYPES,
    maximumSizeInBytes: LISTING_PHOTO_MAX_BYTES,
    addRandomSuffix: true,
    allowOverwrite: false,
    validUntil: Date.now() + 60 * 60 * 1000,
  };
}
