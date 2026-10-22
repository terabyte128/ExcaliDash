import { newElementWith } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/excalidraw/element/types";

const METADATA_KEY = "excalidashPresentation";
export const SLIDE_ROW_GAP = 120;

export type Slide = {
  frame: ExcalidrawFrameElement;
  title: string;
  notes: string;
  order: number | null;
};

export function getSlides(elements: readonly ExcalidrawElement[]): Slide[] {
  return (
    elements
      .filter(
        (element): element is ExcalidrawFrameElement =>
          element.type === "frame" &&
          !element.isDeleted &&
          element.width > 0 &&
          element.height > 0,
      )
      .map((frame, index) => {
        const metadata = frame.customData?.[METADATA_KEY];
        return {
          frame,
          title: frame.name?.trim() || `Frame ${index + 1}`,
          notes: typeof metadata?.notes === "string" ? metadata.notes : "",
          order:
            typeof metadata?.order === "number" &&
            Number.isFinite(metadata.order)
              ? metadata.order
              : null,
        };
      })
      // Frames without an explicit position follow the ordered slides in scene order.
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  );
}

export function getActiveSlideId(
  elements: readonly ExcalidrawElement[],
  selected: Readonly<Record<string, boolean>>,
): string | null {
  const frames = new Set(
    elements
      .filter((element) => !element.isDeleted && selected[element.id])
      .map((element) =>
        element.type === "frame" ? element.id : element.frameId,
      ),
  );
  if (frames.size !== 1) return null;
  return (
    getSlides(elements).find((slide) => frames.has(slide.frame.id))?.frame.id ??
    null
  );
}

export function isPresentationShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === "Enter" &&
    !event.altKey &&
    !event.repeat &&
    !event.isComposing &&
    !event.defaultPrevented &&
    ((event.shiftKey && !event.metaKey && !event.ctrlKey) ||
      (!event.shiftKey && (event.metaKey || event.ctrlKey)))
  );
}

export function updateSlideMetadata(
  elements: readonly ExcalidrawElement[],
  updates: ReadonlyMap<string, { notes?: string; order?: number }>,
): ExcalidrawElement[] {
  return elements.map((element) => {
    const update = updates.get(element.id);
    if (!update || element.type !== "frame" || element.isDeleted)
      return element;
    const current = element.customData?.[METADATA_KEY];
    return newElementWith(element, {
      customData: {
        ...element.customData,
        [METADATA_KEY]: {
          ...(current && typeof current === "object" ? current : {}),
          ...update,
        },
      },
    });
  });
}

export function moveSlide(
  elements: readonly ExcalidrawElement[],
  frameId: string,
  direction: -1 | 1,
): ExcalidrawElement[] {
  const slides = getSlides(elements);
  const index = slides.findIndex((slide) => slide.frame.id === frameId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= slides.length) return [...elements];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  // Preserve the slide layout's top-left anchor, regardless of unframed content.
  let nextX = Math.min(...slides.map((slide) => slide.frame.x));
  const rowY = Math.min(...slides.map((slide) => slide.frame.y));
  const translations = new Map<string, { x: number; y: number }>();
  for (const { frame } of slides) {
    translations.set(frame.id, { x: nextX - frame.x, y: rowY - frame.y });
    nextX += frame.width + SLIDE_ROW_GAP;
  }
  const arranged = elements.map((element) => {
    if (element.isDeleted) return element;
    const offset =
      translations.get(element.id) ||
      (element.frameId ? translations.get(element.frameId) : undefined);
    if (!offset || (!offset.x && !offset.y)) return element;
    // Translate only frame members. Points, group IDs, bindings, and frame IDs
    // remain intact; overlapping unframed objects are never adopted or moved.
    return newElementWith(element, {
      x: element.x + offset.x,
      y: element.y + offset.y,
    });
  });
  return updateSlideMetadata(
    arranged,
    new Map(slides.map((slide, order) => [slide.frame.id, { order }])),
  );
}
