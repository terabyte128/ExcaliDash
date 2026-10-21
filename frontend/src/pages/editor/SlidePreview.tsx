import { useEffect, useState } from "react";
import { exportToSvg } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Slide } from "./presentation";

export type PresentationScene = {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
  appState: Partial<AppState>;
};

export function SlidePreview({
  scene,
  slide,
}: {
  scene: PresentationScene;
  slide: Slide;
}) {
  const [image, setImage] = useState<{
    scene: PresentationScene;
    id: string;
    title: string;
    url: string;
  } | null>(null);
  const [failure, setFailure] = useState<{
    scene: PresentationScene;
    id: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    let committed = false;
    void exportToSvg({
      elements: scene.elements.filter((element) => !element.isDeleted),
      files: scene.files,
      exportingFrame: slide.frame,
      exportPadding: 0,
      appState: {
        ...scene.appState,
        exportBackground: true,
        exportWithDarkMode: scene.appState.theme === "dark",
      },
    })
      .then(async (svg: SVGSVGElement) => {
        if (cancelled) return;
        url = URL.createObjectURL(
          new Blob([svg.outerHTML], { type: "image/svg+xml" }),
        );
        const decoded = new Image();
        decoded.src = url;
        await decoded.decode();
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        committed = true;
        setImage({ scene, id: slide.frame.id, title: slide.title, url });
      })
      .catch(() => {
        if (url) URL.revokeObjectURL(url);
        if (!cancelled) setFailure({ scene, id: slide.frame.id });
      });
    return () => {
      cancelled = true;
      // A committed image stays alive until its replacement has decoded.
      if (url && !committed) URL.revokeObjectURL(url);
    };
  }, [scene, slide.frame, slide.title]);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const failed = failure?.scene === scene && failure.id === slide.frame.id;
  if (image) {
    return (
      <div className="relative h-full w-full">
        <img
          src={image.url}
          alt={image.title}
          className="h-full w-full select-none object-contain"
          draggable={false}
          onMouseDown={(event) => event.preventDefault()}
        />
        {failed && (
          <p
            role="alert"
            className="absolute bottom-4 left-4 right-4 rounded-lg bg-white p-3 text-sm text-slate-900"
          >
            Unable to render the requested slide. The previous slide is still
            displayed. Try navigating again.
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center p-6 text-sm text-slate-400"
    >
      {failed
        ? "Unable to render this slide. Try reopening the presentation."
        : "Rendering slide…"}
    </div>
  );
}
