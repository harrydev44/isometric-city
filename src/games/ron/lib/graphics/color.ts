import { colord } from 'colord';

export type Rgb = { r: number; g: number; b: number };

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const n = parseInt(h, 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
    };
  }
  // Fallback for named colors / rgba / etc.
  const c = colord(hex).toRgb();
  return { r: c.r, g: c.g, b: c.b };
}

export function rgbToHex(rgb: Rgb): string {
  const r = Math.round(clamp255(rgb.r));
  const g = Math.round(clamp255(rgb.g));
  const b = Math.round(clamp255(rgb.b));
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const tt = clamp01(t);
  return {
    r: a.r + (b.r - a.r) * tt,
    g: a.g + (b.g - a.g) * tt,
    b: a.b + (b.b - a.b) * tt,
  };
}

export function mixHex(a: string, b: string, t: number): string {
  return rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), t));
}

export function darken(hex: string, amount: number): string {
  return colord(hex).darken(clamp01(amount)).toHex();
}

export function lighten(hex: string, amount: number): string {
  return colord(hex).lighten(clamp01(amount)).toHex();
}

export function desaturate(hex: string, amount: number): string {
  return colord(hex).desaturate(clamp01(amount)).toHex();
}

export function saturate(hex: string, amount: number): string {
  return colord(hex).saturate(clamp01(amount)).toHex();
}

export function withAlpha(hex: string, a: number): string {
  return colord(hex).alpha(clamp01(a)).toRgbString();
}

