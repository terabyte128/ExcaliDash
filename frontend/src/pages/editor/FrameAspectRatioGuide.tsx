import { useEffect, useRef, useState, type RefObject } from "react";
import {
  mutateElement,
  sceneCoordsToViewportCoords,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  PointerDownState,
} from "@excalidraw/excalidraw/types";
import {
  fitFrameToRatio,
  FRAME_RATIO_STORAGE_KEY,
  FRAME_RATIOS,
  readFrameRatio,
  type FrameRatio,
} from "./frameAspectRatio";
type Guide = {
  x: number;
  y: number;
  width: number;
  height: number;
  currentRatio: string;
};

export function FrameAspectRatioGuide({
  apiRef,
  isReady,
  enabled,
}: {
  apiRef: RefObject<ExcalidrawImperativeAPI | null>;
  isReady: boolean;
  enabled: boolean;
}) {
  const [ratio, setRatio] = useState<FrameRatio>(readFrameRatio);
  const [frameToolActive, setFrameToolActive] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const session = useRef<{
    pointer: PointerDownState;
    shift: boolean;
    alt: boolean;
  } | null>(null);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !isReady || !enabled) return;
    const targetRatio = FRAME_RATIOS[ratio];

    const getTarget = (state: AppState) => {
      const drag = session.current;
      const frame = state.newElement;
      if (
        !drag ||
        !targetRatio ||
        drag.shift ||
        !frame ||
        frame.type !== "frame" ||
        frame.isDeleted ||
        drag.pointer.originalElements.has(frame.id) ||
        frame.width <= 0 ||
        frame.height <= 0
      )
        return null;
      return {
        frame,
        bounds: fitFrameToRatio(frame, targetRatio, {
          left: drag.pointer.lastCoords.x < drag.pointer.originInGrid.x,
          up: drag.pointer.lastCoords.y < drag.pointer.originInGrid.y,
          fromCenter: drag.alt,
        }),
      };
    };

    const updateGuide = (state: AppState) => {
      setFrameToolActive(state.activeTool.type === "frame");
      const target = getTarget(state);
      if (!target) {
        setGuide(null);
        return;
      }
      const point = sceneCoordsToViewportCoords(
        { sceneX: target.bounds.x, sceneY: target.bounds.y },
        state,
      );
      setGuide({
        x: point.x,
        y: point.y,
        width: target.bounds.width * state.zoom.value,
        height: target.bounds.height * state.zoom.value,
        currentRatio: (target.frame.width / target.frame.height).toFixed(2),
      });
    };

    const unsubscribeChange = api.onChange((_elements, state) =>
      updateGuide(state),
    );
    const unsubscribeDown = api.onPointerDown((tool, pointer, event) => {
      session.current =
        tool.type === "frame" && event.button === 0
          ? { pointer, shift: event.shiftKey, alt: event.altKey }
          : null;
    });
    const unsubscribeUp = api.onPointerUp((_tool, pointer, event) => {
      if (session.current?.pointer !== pointer) return;
      session.current.shift = event.shiftKey;
      session.current.alt = event.altKey;
      const target = getTarget(api.getAppState());
      if (target) {
        // In Excalidraw 0.18.1 this callback precedes frame-child assignment and
        // the native history commit. Mutate the same object the native handler
        // holds, without triggering an intermediate save/render or undo entry.
        mutateElement(target.frame, target.bounds, false);
      }
      session.current = null;
      setGuide(null);
    });
    const modifiers = (event: MouseEvent | KeyboardEvent) => {
      if (!session.current) return;
      session.current.shift = event.shiftKey;
      session.current.alt = event.altKey;
    };
    const cancel = () => {
      session.current = null;
      setGuide(null);
    };
    window.addEventListener("pointermove", modifiers, true);
    window.addEventListener("keydown", modifiers, true);
    window.addEventListener("keyup", modifiers, true);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      unsubscribeChange();
      unsubscribeDown();
      unsubscribeUp();
      session.current = null;
      window.removeEventListener("pointermove", modifiers, true);
      window.removeEventListener("keydown", modifiers, true);
      window.removeEventListener("keyup", modifiers, true);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [apiRef, enabled, isReady, ratio]);

  if (!enabled || !frameToolActive) return null;
  return (
    <>
      <div
        className="ui-popover fixed bottom-16 left-1/2 z-30 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 p-3 text-slate-700 dark:text-neutral-200"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <fieldset>
          <legend className="mb-2 text-xs font-semibold">
            New frame ratio
          </legend>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-50 p-1 dark:bg-neutral-800">
            {(Object.keys(FRAME_RATIOS) as FrameRatio[]).map((value) => (
              <label key={value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="frame-ratio"
                  value={value}
                  checked={ratio === value}
                  className="peer sr-only"
                  onChange={() => {
                    setRatio(value);
                    try {
                      localStorage.setItem(FRAME_RATIO_STORAGE_KEY, value);
                    } catch {
                      /* Optional preference. */
                    }
                  }}
                />
                <span className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs transition-colors hover:bg-slate-100 peer-checked:bg-indigo-100 peer-checked:text-indigo-700 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500 dark:hover:bg-neutral-700 dark:peer-checked:bg-indigo-900/50 dark:peer-checked:text-indigo-300">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 32 24"
                    className="h-5 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect
                      x={value === "1:1" ? 6 : value === "4:3" ? 4 : 2}
                      y={value === "16:9" ? 4 : 2}
                      width={value === "1:1" ? 20 : value === "4:3" ? 24 : 28}
                      height={value === "16:9" ? 16 : 20}
                      rx="2"
                      strokeDasharray={value === "free" ? "3 3" : undefined}
                    />
                  </svg>
                  {value === "free" ? "Freeform" : value}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-neutral-400">
          {ratio === "free" ? (
            "Draw a frame at any size"
          ) : (
            <>
              Snaps on release · <kbd className="font-sans">Shift</kbd> bypasses
            </>
          )}
        </p>
      </div>
      {guide && (
        <div
          data-testid="frame-ratio-guide"
          className="pointer-events-none fixed z-20 border-2 border-dashed border-indigo-500 bg-indigo-500/5"
          style={{
            left: guide.x,
            top: guide.y,
            width: guide.width,
            height: guide.height,
          }}
        >
          <span className="absolute left-0 top-0 whitespace-nowrap rounded-br bg-indigo-600 px-2 py-1 text-xs text-white">
            {ratio} on release · current {guide.currentRatio}:1
          </span>
        </div>
      )}
    </>
  );
}
