// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering

import { redKeyToCanvas, type RedKeyOptions } from '@/lib/redKey';

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

/**
 * Register a callback to be notified when images are loaded
 * @returns Cleanup function to unregister the callback
 */
export function onImageLoaded(callback: ImageLoadCallback): () => void {
  imageLoadCallbacks.add(callback);
  return () => { imageLoadCallbacks.delete(callback); };
}

/**
 * Notify all registered callbacks that an image has loaded
 */
function notifyImageLoaded() {
  imageLoadCallbacks.forEach(cb => cb());
}

/**
 * Load an image from a source URL
 * @param src The image source path
 * @returns Promise resolving to the loaded image
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      notifyImageLoaded(); // Notify listeners that a new image is available
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param options Red-key tuning options (defaults are in `src/lib/redKey.ts`)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(
  img: HTMLImageElement,
  options: RedKeyOptions = {}
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = redKeyToCanvas(img, options);
      
      // Create a new image from the processed canvas
      const filteredImg = new Image();
      filteredImg.onload = () => {
        resolve(filteredImg);
      };
      filteredImg.onerror = (error) => {
        reject(new Error('Failed to create filtered image'));
      };
      filteredImg.src = canvas.toDataURL();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }
  
  return loadImage(src).then((img) => {
    if (applyFilter) {
      return filterBackgroundColor(img).then((filteredImg: HTMLImageElement) => {
        imageCache.set(cacheKey, filteredImg);
        return filteredImg;
      });
    }
    return img;
  });
}

/**
 * Check if an image is cached
 * @param src The image source path
 * @param filtered Whether to check for the filtered version
 */
export function isImageCached(src: string, filtered: boolean = false): boolean {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.has(cacheKey);
}

/**
 * Get a cached image if available
 * @param src The image source path
 * @param filtered Whether to get the filtered version
 */
export function getCachedImage(src: string, filtered: boolean = false): HTMLImageElement | undefined {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.get(cacheKey);
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}
