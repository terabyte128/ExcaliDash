import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  getCommonBounds,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { FRAME_RATIOS, readFrameRatio } from "./frameAspectRatio";
import { getSlides, updateSlideMetadata } from "./presentation";

export const SLIDE_TEMPLATES = [
  {
    id: "title-slide",
    label: "Title slide",
    description: "Large title and subtitle",
  },
  {
    id: "title-only",
    label: "Title only",
    description: "Heading with an open canvas",
  },
  {
    id: "title-list",
    label: "Title + list",
    description: "Heading and bullet points",
  },
  {
    id: "title-list-image",
    label: "Title + list + image",
    description: "Bullet points on the left, blank space on the right",
  },
  { id: "blank", label: "Blank slide", description: "An empty frame" },
] as const;
export type SlideTemplateId = (typeof SLIDE_TEMPLATES)[number]["id"];

// Shared by the toolbar and presentation picker for this app session.
let lastUsedTemplate: SlideTemplateId | null = null;
export const getLastUsedSlideTemplate = () => lastUsedTemplate;

export function createSlideTemplate(
  id: SlideTemplateId,
  x: number,
  y: number,
  ratio: number,
) {
  const width = 960;
  const height = width / ratio;
  const margin = 64;
  const text: ExcalidrawElementSkeleton[] = [];
  const addText = (
    textValue: string,
    top: number,
    fontSize: number,
    textWidth: number,
    centered = false,
  ) => {
    text.push({
      type: "text",
      id: `text-${text.length}`,
      text: textValue,
      x: x + margin,
      y: y + top,
      width: textWidth,
      fontSize,
      fontFamily: 5,
      strokeColor: "#1e1e1e",
      textAlign: centered ? "center" : "left",
      autoResize: false,
    });
  };
  if (id === "title-slide") {
    addText("Presentation title", height * 0.36, 52, width - margin * 2, true);
    addText("Add your subtitle", height * 0.56, 28, width - margin * 2, true);
  } else if (id !== "blank") {
    addText("Slide title", margin, 40, width - margin * 2);
    if (id === "title-list" || id === "title-list-image") {
      addText(
        "• First point\n\n• Second point\n\n• Third point",
        164,
        28,
        id === "title-list-image"
          ? width / 2 - margin * 1.5
          : width - margin * 2,
      );
    }
  }
  const template = SLIDE_TEMPLATES.find((item) => item.id === id)!;
  const elements = convertToExcalidrawElements([
    ...text,
    {
      type: "frame",
      id: "slide-frame",
      x,
      y,
      width,
      height,
      name: template.label,
      children: text.map((item) => item.id!),
    },
  ]);
  const frame = elements.find((element) => element.type === "frame")!;
  // Text construction measures intrinsic width and treats centered x as an
  // anchor. Apply our layout boxes after conversion so edits wrap in the column.
  const textElements = elements.filter((element) => element.type === "text");
  textElements.forEach((element, index) => {
    const layout = text[index];
    Object.assign(element, { x: layout.x, y: layout.y, width: layout.width });
  });
  // The converter treats zero frame coordinates as missing; preserve our exact bounds.
  Object.assign(frame, { x, y, width, height });
  return { elements, frame };
}

export function insertSlideTemplate(
  api: ExcalidrawImperativeAPI,
  template: SlideTemplateId,
) {
  const existing = api.getSceneElementsIncludingDeleted();
  const visible = existing.filter((element) => !element.isDeleted);
  const state = api.getAppState();
  const ratio = FRAME_RATIOS[readFrameRatio()] ?? 16 / 9;
  const center = viewportCoordsToSceneCoords(
    {
      clientX: state.offsetLeft + state.width / 2,
      clientY: state.offsetTop + state.height / 2,
    },
    state,
  );
  const bounds = visible.length ? getCommonBounds(visible) : null;
  const { elements, frame } = createSlideTemplate(
    template,
    bounds ? bounds[2] + 120 : center.x - 480,
    bounds ? bounds[1] : center.y - 480 / ratio,
    ratio,
  );
  const slides = getSlides(existing);
  const ordered = updateSlideMetadata(
    [...existing, ...elements],
    new Map([
      ...slides.map((slide, order) => [slide.frame.id, { order }] as const),
      [frame.id, { order: slides.length }],
    ]),
  );
  api.setActiveTool({ type: "selection" });
  api.updateScene({
    elements: ordered,
    appState: {
      selectedElementIds: Object.fromEntries(
        elements.map((element) => [element.id, true]),
      ),
      selectedGroupIds: {},
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(frame, {
    fitToViewport: true,
    viewportZoomFactor: 0.8,
    animate: false,
  });
  lastUsedTemplate = template;
}
