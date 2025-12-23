export type RGB = { r: number; g: number; b: number };

export type RedKeyOptions = {
  /**
   * Minimum red channel value before we consider keying.
   * Higher values reduce accidental removal of darker reds in sprites.
   */
  minRed?: number;
  /**
   * Maximum green/blue channel values allowed for keying.
   * Pixels with higher G/B are assumed to be real sprite colors, not the red backdrop.
   */
  maxGreen?: number;
  maxBlue?: number;
};

const DEFAULT_OPTIONS: Required<RedKeyOptions> = {
  minRed: 210,
  maxGreen: 140,
  maxBlue: 140,
};

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

/**
 * Chroma-keys a "pure red" sprite-sheet background to transparency.
 *
 * Unlike a simple RGB-distance threshold, this primarily keys pixels that are:
 * - very red (high R), and
 * - have low G/B components (close to a flat red backdrop),
 *
 * and it feathers edges by scaling alpha based on how much green/blue "spill" is present.
 */
export function redKeyToCanvas(img: HTMLImageElement, options: RedKeyOptions = {}): HTMLCanvasElement {
  const { minRed, maxGreen, maxBlue } = { ...DEFAULT_OPTIONS, ...options };

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Preserve fully transparent pixels as-is.
    if (a === 0) continue;

    // Fast reject: not red-enough or too much G/B => treat as real sprite pixel.
    if (r < minRed || g > maxGreen || b > maxBlue) continue;

    // Feather: the closer G/B are to 0, the more transparent the pixel becomes.
    // When g==0 and b==0 => alphaScale ~= 0 (fully transparent).
    // As g/b approach maxGreen/maxBlue => alphaScale -> 1 (opaque).
    const gScale = maxGreen > 0 ? g / maxGreen : 1;
    const bScale = maxBlue > 0 ? b / maxBlue : 1;
    const alphaScale = clamp01(Math.max(gScale, bScale));

    data[i + 3] = Math.round(a * alphaScale);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

