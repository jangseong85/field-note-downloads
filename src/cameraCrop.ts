export type Frame = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Inverse of the back camera's centered aspect-fill preview, in oriented photo pixels. */
export function guideToPhotoCrop(photo: Size, viewport: Size, guide: Frame) {
  const numbers = [photo.width, photo.height, viewport.width, viewport.height, guide.x, guide.y, guide.width, guide.height];
  if (!numbers.every(Number.isFinite) || photo.width <= 0 || photo.height <= 0 || viewport.width <= 0 || viewport.height <= 0 || guide.width <= 0 || guide.height <= 0) throw new Error("촬영 가이드가 준비되지 않았습니다. 잠시 후 다시 촬영해 주세요.");
  const scale = Math.max(viewport.width / photo.width, viewport.height / photo.height);
  const offsetX = (photo.width * scale - viewport.width) / 2;
  const offsetY = (photo.height * scale - viewport.height) / 2;
  const left = Math.max(0, guide.x), top = Math.max(0, guide.y);
  const right = Math.min(viewport.width, guide.x + guide.width), bottom = Math.min(viewport.height, guide.y + guide.height);
  if (right <= left || bottom <= top) throw new Error("촬영 가이드 위치를 확인해 주세요.");
  const originX = Math.min(photo.width - 1, Math.max(0, Math.floor((left + offsetX) / scale)));
  const originY = Math.min(photo.height - 1, Math.max(0, Math.floor((top + offsetY) / scale)));
  const endX = Math.min(photo.width, Math.ceil((right + offsetX) / scale));
  const endY = Math.min(photo.height, Math.ceil((bottom + offsetY) / scale));
  return { originX, originY, width: Math.max(1, endX - originX), height: Math.max(1, endY - originY) };
}

/**
 * Widens the on-screen card guide before cropping. A card held slightly larger or off-centre
 * would otherwise lose its edge text (name and birth date sit near the left edge); ML Kit
 * tolerates the extra background. Clamped to the preview.
 */
export function expandGuide(guide: Frame, viewport: Size, marginX = 0.12, marginY = 0.15): Frame {
  const dx = guide.width * marginX;
  const dy = guide.height * marginY;
  const x = Math.max(0, guide.x - dx);
  const y = Math.max(0, guide.y - dy);
  return {
    x,
    y,
    width: Math.min(viewport.width, guide.x + guide.width + dx) - x,
    height: Math.min(viewport.height, guide.y + guide.height + dy) - y,
  };
}
