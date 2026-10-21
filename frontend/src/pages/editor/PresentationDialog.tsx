import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Expand,
  FileText,
  Play,
  Plus,
  X,
} from "lucide-react";
import { getSlides, moveSlide, updateSlideMetadata } from "./presentation";
import { SlidePreview, type PresentationScene } from "./SlidePreview";
import { SlideTemplatePicker } from "./SlideTemplatePicker";
import { insertSlideTemplate } from "./slideTemplates";

function readScene(api: ExcalidrawImperativeAPI): PresentationScene {
  const { viewBackgroundColor, theme } = api.getAppState();
  return {
    elements: api.getSceneElementsIncludingDeleted(),
    files: api.getFiles(),
    appState: { viewBackgroundColor, theme },
  };
}

export function PresentationDialog({
  api,
  canEdit,
  drawingName,
  onClose,
  onEditCanvas,
}: {
  api: ExcalidrawImperativeAPI;
  canEdit: boolean;
  drawingName: string;
  onClose: () => void;
  onEditCanvas: () => void;
}) {
  const [scene, setScene] = useState(() => readScene(api));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PresentationScene | null>(null);
  const [position, setPosition] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const slides = getSlides((playback || scene).elements);
  const selectedIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.frame.id === selectedId),
  );
  const index = playback
    ? Math.min(position, slides.length - 1)
    : selectedIndex;
  const slide = slides[index];

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setControlsVisible(false), 2000);
  }, []);

  useEffect(
    () => () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    },
    [],
  );

  useEffect(
    () =>
      api.onChange((elements, appState, files) => {
        setScene((current) => {
          // Pointer, selection and viewport updates do not change a slide.
          const unchanged =
            current.appState.theme === appState.theme &&
            current.appState.viewBackgroundColor ===
              appState.viewBackgroundColor &&
            current.elements.length === elements.length &&
            current.elements.every((element, i) => element === elements[i]) &&
            Object.keys(current.files).length === Object.keys(files).length &&
            Object.entries(current.files).every(
              ([id, file]) => file === files[id],
            );
          if (unchanged) return current;
          return {
            elements,
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              theme: appState.theme,
            },
            files,
          };
        });
      }),
    [api],
  );

  const leavePlayback = useCallback(() => {
    setPlayback(null);
    setShowNotes(false);
    setFullscreenMessage("");
    if (document.fullscreenElement === root.current)
      void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    exitButton.current?.focus();
    return () => {
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) leavePlayback();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [leavePlayback]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        revealControls();
        event.stopImmediatePropagation();
        const controls = root.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), textarea, [tabindex='0']",
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      // The mounted editor also listens globally; never let presentation keys edit it.
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        if (playback) leavePlayback();
        else onClose();
        return;
      }
      if (!playback || event.ctrlKey || event.metaKey || event.altKey) return;
      const next = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(
        event.key,
      );
      const previous = ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key);
      if (next || previous || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        setPosition((current) =>
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? slides.length - 1
              : Math.max(
                  0,
                  Math.min(slides.length - 1, current + (next ? 1 : -1)),
                ),
        );
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setShowNotes((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [leavePlayback, onClose, playback, slides.length, revealControls]);

  function requestFullscreen() {
    setFullscreenMessage("");
    if (!root.current?.requestFullscreen) {
      setFullscreenMessage(
        "Fullscreen is unavailable. Presenting in this window.",
      );
      return;
    }
    void root.current.requestFullscreen().catch(() => {
      setFullscreenMessage(
        "Fullscreen was blocked. Presenting in this window.",
      );
    });
  }

  function start() {
    // Excalidraw may mutate elements/files in place as remote changes arrive.
    setPlayback(structuredClone(readScene(api)));
    setPosition(selectedIndex);
    setShowNotes(false);
    requestFullscreen();
    exitButton.current?.focus();
    revealControls();
  }

  function changeNotes(notes: string) {
    if (!canEdit || !slide) return;
    api.updateScene({
      elements: updateSlideMetadata(
        api.getSceneElementsIncludingDeleted(),
        new Map([[slide.frame.id, { notes }]]),
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={playback ? "Presentation playback" : "Presentation"}
      className={`fixed inset-0 z-[100] flex flex-col bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100 ${playback && !controlsVisible ? "cursor-none" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onPointerMove={playback ? revealControls : undefined}
      onTouchStart={playback ? revealControls : undefined}
    >
      <header
        data-testid="presentation-controls"
        onFocusCapture={playback ? revealControls : undefined}
        className={`flex shrink-0 items-center justify-between gap-3 px-4 py-3 ${playback ? `absolute inset-x-0 top-0 z-10 bg-white/95 shadow-sm transition-opacity dark:bg-neutral-950/95 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}` : "border-b border-slate-200 dark:border-neutral-800"}`}
      >
        <div className="min-w-0">
          <h2 className="truncate font-semibold">
            {playback ? slide?.title : "Presentation"}
          </h2>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            {drawingName}
            {playback
              ? ` · ${index + 1} / ${slides.length}`
              : ` · ${slides.length} slides`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!playback && canEdit && (
            <button
              className="ui-button-secondary gap-2 px-3"
              aria-expanded={showTemplates}
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <Plus size={16} />
              Add slide
            </button>
          )}
          {playback ? (
            <>
              <button
                className="ui-toolbar-button"
                aria-label="Toggle speaker notes"
                title="Speaker notes (N) — visible on this screen"
                aria-pressed={showNotes}
                onClick={() => setShowNotes(!showNotes)}
              >
                <FileText size={20} />
              </button>
              <button
                className="ui-toolbar-button"
                aria-label="Enter fullscreen"
                onClick={requestFullscreen}
              >
                <Expand size={20} />
              </button>
            </>
          ) : (
            <button
              className="ui-button-primary gap-2 px-4"
              onClick={start}
              disabled={!slide}
            >
              <Play size={16} />
              Present
            </button>
          )}
          <button
            ref={exitButton}
            className="ui-toolbar-button"
            aria-label={playback ? "Exit presentation" : "Close presentation"}
            onClick={playback ? leavePlayback : onClose}
          >
            <X size={20} />
          </button>
        </div>
      </header>
      {!playback && canEdit && showTemplates && (
        <SlideTemplatePicker
          onSelect={(template) => {
            insertSlideTemplate(api, template);
            onClose();
            onEditCanvas();
          }}
        />
      )}
      {fullscreenMessage && (
        <p
          role="status"
          className="absolute top-20 left-4 right-4 z-10 rounded-lg bg-white p-3 text-sm text-slate-900"
        >
          {fullscreenMessage}
        </p>
      )}
      {!slide ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h3 className="text-xl font-semibold">Turn frames into slides</h3>
          <p className="max-w-md text-slate-500 dark:text-neutral-400">
            Use the Frame tool (F) to draw a frame around each slide on your
            canvas. Return here to arrange slides, add notes, and present.
          </p>
          <button
            className="ui-button-primary px-4"
            onClick={() => {
              onClose();
              if (canEdit) api.setActiveTool({ type: "frame" });
            }}
          >
            {canEdit ? "Create a frame" : "Back to drawing"}
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {!playback && (
            <aside
              className="max-h-44 w-full shrink-0 overflow-auto border-b border-slate-200 p-3 sm:max-h-none sm:w-64 sm:border-b-0 sm:border-r dark:border-neutral-800"
              aria-label="Slides"
            >
              <p className="mb-3 text-xs text-slate-500">
                Each frame is a slide. Rename frames on the canvas.
              </p>
              <ol className="space-y-2">
                {slides.map((item, i) => (
                  <li
                    key={item.frame.id}
                    className={`flex items-center rounded-lg border ${i === index ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-neutral-800"}`}
                  >
                    <button
                      className="min-w-0 flex-1 truncate p-3 text-left text-sm"
                      aria-current={i === index ? "step" : undefined}
                      onClick={() => setSelectedId(item.frame.id)}
                    >
                      {i + 1}. {item.title}
                    </button>
                    {canEdit && (
                      <div className="flex shrink-0 pr-1">
                        {([-1, 1] as const).map((direction) => (
                          <button
                            key={direction}
                            className="rounded p-1 hover:bg-slate-200 disabled:opacity-25 dark:hover:bg-neutral-700"
                            aria-label={`Move ${item.title} ${direction === -1 ? "up" : "down"}`}
                            disabled={
                              direction === -1
                                ? i === 0
                                : i === slides.length - 1
                            }
                            onClick={() => {
                              setSelectedId(item.frame.id);
                              api.updateScene({
                                elements: moveSlide(
                                  api.getSceneElementsIncludingDeleted(),
                                  item.frame.id,
                                  direction,
                                ),
                                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                              });
                            }}
                          >
                            {direction === -1 ? (
                              <ArrowUp size={16} />
                            ) : (
                              <ArrowDown size={16} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </aside>
          )}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className={`min-h-0 flex-1 bg-neutral-900 ${playback ? "" : "p-3 sm:p-6"}`}
              data-testid="presentation-slide"
            >
              <SlidePreview scene={playback || scene} slide={slide} />
            </div>
            {(!playback || showNotes) && (
              <section
                className={`max-h-[35vh] shrink-0 overflow-auto border-t border-slate-200 p-4 dark:border-neutral-800 ${playback ? "pb-20" : ""}`}
              >
                <label
                  htmlFor="slide-notes"
                  className="mb-2 block text-sm font-semibold"
                >
                  Speaker notes
                </label>
                {playback ? (
                  <p className="whitespace-pre-wrap text-sm">
                    {slide.notes || "No notes for this slide."}
                  </p>
                ) : (
                  <>
                    <textarea
                      id="slide-notes"
                      value={slide.notes}
                      readOnly={!canEdit}
                      maxLength={20000}
                      onChange={(event) => changeNotes(event.target.value)}
                      placeholder={
                        canEdit
                          ? "Add talking points for this slide…"
                          : "No notes for this slide."
                      }
                      className="h-24 w-full resize-y rounded-lg border border-slate-300 bg-transparent p-3 text-sm focus:outline-indigo-500 dark:border-neutral-700"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                      {canEdit
                        ? "Notes save with the drawing and are visible to everyone with access. "
                        : ""}
                      Hidden during playback unless you show them on this
                      screen.
                    </p>
                  </>
                )}
              </section>
            )}
            {playback && (
              <footer
                onFocusCapture={revealControls}
                className={`absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 bg-white/95 px-4 py-3 transition-opacity dark:bg-neutral-950/95 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
              >
                <span className="text-xs text-slate-500 dark:text-neutral-400">
                  ← → to navigate · Esc to exit
                </span>
                <div className="flex items-center gap-3">
                  <button
                    className="ui-toolbar-button"
                    aria-label="Previous slide"
                    disabled={index === 0}
                    onClick={() => setPosition(index - 1)}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span
                    aria-live="polite"
                    className="whitespace-nowrap text-sm"
                  >
                    {index + 1} / {slides.length}
                  </span>
                  <button
                    className="ui-toolbar-button"
                    aria-label="Next slide"
                    disabled={index === slides.length - 1}
                    onClick={() => setPosition(index + 1)}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </footer>
            )}
          </main>
        </div>
      )}
    </div>,
    document.body,
  );
}
