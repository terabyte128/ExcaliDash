import { exportToSvg } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/excalidraw/element/types";
import { rehydrateSvgImages } from "../../utils/previewSvg";

export type PresentationScene = {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
  appState: Partial<AppState>;
};

export async function renderSlideSvg(
  scene: PresentationScene,
  frame: ExcalidrawFrameElement,
) {
  const svg = await exportToSvg({
    elements: scene.elements.filter((element) => !element.isDeleted),
    files: scene.files,
    exportingFrame: frame,
    exportPadding: 0,
    appState: {
      ...scene.appState,
      exportBackground: true,
      exportWithDarkMode: scene.appState.theme === "dark",
    },
  });
  if (!(await rehydrateSvgImages(svg))) {
    throw new Error("Unable to load slide images");
  }
  return svg;
}
