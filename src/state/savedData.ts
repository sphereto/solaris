/** Pictures kept on this device for offline use: the service worker's image cache and saved Picture of the Day entries. */
const IMAGE_CACHE = 'solaris-nasa-images';
const APOD_PREFIX = 'solaris.apod.v1.';

export async function countSavedPictures(): Promise<number> {
  try {
    if (typeof caches === 'undefined') return 0;
    const cache = await caches.open(IMAGE_CACHE);
    return (await cache.keys()).length;
  } catch {
    return 0;
  }
}

export async function clearSavedPictures(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(IMAGE_CACHE);
  } catch {
    /* nothing to clear */
  }
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(APOD_PREFIX)) localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}
