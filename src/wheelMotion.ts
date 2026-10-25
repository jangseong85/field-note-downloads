/** Fast enough to traverse years, bounded so individual values remain controllable. */
export const wheelHoldDelay = (elapsed: number) => {
  const easedElapsed = elapsed * 0.8;
  return easedElapsed >= 3200 ? 55 : easedElapsed >= 1800 ? 90 : easedElapsed >= 800 ? 160 : 280;
};

type Scheduler = {
  now: () => number;
  set: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
};
export function createWheelHold(
  step: (direction: -1 | 1) => boolean,
  onActive: (active: boolean) => void,
  scheduler: Scheduler = {
    now: Date.now,
    set: setTimeout,
    clear: clearTimeout,
  },
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false,
    generation = 0;
  const stop = () => {
    generation++;
    if (timer !== null) scheduler.clear(timer);
    timer = null;
    if (active) {
      active = false;
      onActive(false);
    }
  };
  return {
    stop,
    start(direction: -1 | 1) {
      stop();
      active = true;
      const run = generation,
        started = scheduler.now();
      onActive(true);
      const tick = () => {
        if (!active || run !== generation) return;
        if (!step(direction)) {
          stop();
          return;
        }
        timer = scheduler.set(tick, wheelHoldDelay(scheduler.now() - started));
      };
      tick();
    },
  };
}
