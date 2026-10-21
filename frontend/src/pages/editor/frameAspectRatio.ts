type Bounds = { x: number; y: number; width: number; height: number };

export const FRAME_RATIO_STORAGE_KEY = "excalidash-frame-ratio-prototype";
export const FRAME_RATIOS = {
  free: null,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "1:1": 1,
} as const;
export type FrameRatio = keyof typeof FRAME_RATIOS;

export function readFrameRatio(): FrameRatio {
  try {
    const saved = localStorage.getItem(FRAME_RATIO_STORAGE_KEY);
    if (saved && Object.hasOwn(FRAME_RATIOS, saved)) return saved as FrameRatio;
  } catch {
    /* Storage may be unavailable. */
  }
  return "free";
}

/** Expand to contain the dragged rectangle, preserving its drag anchor. */
export function fitFrameToRatio(
  frame: Bounds,
  ratio: number,
  direction: { left: boolean; up: boolean; fromCenter: boolean },
): Bounds {
  const width = Math.max(frame.width, frame.height * ratio);
  const height = width / ratio;
  return {
    x:
      frame.x -
      (width - frame.width) *
        (direction.fromCenter ? 0.5 : direction.left ? 1 : 0),
    y:
      frame.y -
      (height - frame.height) *
        (direction.fromCenter ? 0.5 : direction.up ? 1 : 0),
    width,
    height,
  };
}
