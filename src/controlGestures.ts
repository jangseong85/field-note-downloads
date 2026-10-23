export function horizontalControlDrag(dx: number, dy: number) {
  return Math.abs(dx) >= 6 && Math.abs(dx) > Math.abs(dy) * 1.2;
}
export function switchGestureValue({
  checked,
  down,
  start,
  travel,
  dx,
  dy,
  disabled,
  vertical,
}: {
  checked: boolean;
  down: boolean;
  start: number;
  travel: number;
  dx: number;
  dy: number;
  disabled: boolean;
  vertical: boolean;
}) {
  if (disabled || vertical) return checked;
  // A slightly diagonal tap is still a tap, not an aborted vertical drag.
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return !down;
  if (Math.abs(dy) > Math.abs(dx)) return checked;
  return start + dx > travel / 2;
}
export function nearestSegment(
  idOrder: string[],
  slots: Record<string, { x: number; width: number }>,
  center: number,
) {
  let nearest: string | null = null,
    distance = Infinity;
  for (const id of idOrder) {
    const slot = slots[id];
    if (!slot) continue;
    const d = Math.abs(center - slot.x - slot.width / 2);
    if (d < distance) {
      nearest = id;
      distance = d;
    }
  }
  return nearest;
}
