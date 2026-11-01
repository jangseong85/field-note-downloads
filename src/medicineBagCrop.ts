import type { Frame, Size } from "./cameraCrop";

export type CropHandle = "move" | "tl" | "tr" | "bl" | "br";
export type Point = { x: number; y: number };

/** Where a resizeMode="contain" image sits inside its box. */
export function fitContain(image: Size, box: Size): Frame {
  if (image.width <= 0 || image.height <= 0 || box.width <= 0 || box.height <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale, height = image.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

/** First frame: a wide band in the middle, the usual shape of a drug list. */
export function initialCrop(display: Frame): Frame {
  const width = display.width * 0.8, height = display.height * 0.45;
  return { x: display.x + (display.width - width) / 2, y: display.y + (display.height - height) / 2, width, height };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Moves the frame or one corner by a drag, keeping it inside the photo and at least `min` on each side. */
export function dragCrop(start: Frame, handle: CropHandle, dx: number, dy: number, bounds: Frame, min = 48): Frame {
  const right = bounds.x + bounds.width, bottom = bounds.y + bounds.height;
  if (handle === "move")
    return {
      ...start,
      x: clamp(start.x + dx, bounds.x, right - start.width),
      y: clamp(start.y + dy, bounds.y, bottom - start.height),
    };
  let left = start.x, top = start.y, end = start.x + start.width, base = start.y + start.height;
  if (handle === "tl" || handle === "bl") left = clamp(left + dx, bounds.x, end - min);
  else end = clamp(end + dx, left + min, right);
  if (handle === "tl" || handle === "tr") top = clamp(top + dy, bounds.y, base - min);
  else base = clamp(base + dy, top + min, bottom);
  return { x: left, y: top, width: end - left, height: base - top };
}

/** Converts the on-screen frame to whole photo pixels for ImageManipulator.crop. Nothing outside the frame is kept. */
export function displayToImageCrop(crop: Frame, display: Frame, image: Size) {
  if (display.width <= 0 || display.height <= 0) throw new Error("사진이 아직 표시되지 않았습니다.");
  const scale = image.width / display.width;
  // Rounding inward means a fraction of a pixel inside the frame may be lost, but none outside it is sent.
  const originX = clamp(Math.ceil((crop.x - display.x) * scale), 0, image.width - 1);
  const originY = clamp(Math.ceil((crop.y - display.y) * scale), 0, image.height - 1);
  const endX = clamp(Math.floor((crop.x + crop.width - display.x) * scale), originX + 1, image.width);
  const endY = clamp(Math.floor((crop.y + crop.height - display.y) * scale), originY + 1, image.height);
  return { originX, originY, width: endX - originX, height: endY - originY };
}

/** Resize target that caps the long edge; null when the image is already small enough. */
export function capLongEdge(size: Size, max: number): { width: number; height: null } | { width: null; height: number } | null {
  if (Math.max(size.width, size.height) <= max) return null;
  return size.width >= size.height ? { width: max, height: null } : { width: null, height: max };
}

export function strokePath(points: Point[]): string {
  if (!points.length) return "";
  const [first, ...rest] = points;
  // A tap is drawn as a dot: a zero-length segment with round caps.
  const tail = rest.length ? rest : [first!];
  return `M${first!.x.toFixed(1)} ${first!.y.toFixed(1)}` + tail.map((p) => ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}
