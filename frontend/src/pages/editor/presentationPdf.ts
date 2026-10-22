import { PDFDocument } from "pdf-lib";
import { getSlides } from "./presentation";
import {
  renderSlideSvg,
  type PresentationScene,
} from "./presentationRendering";

export async function createPresentationPdf(
  scene: PresentationScene,
  title: string,
  signal: AbortSignal,
  onProgress: (completed: number) => void,
): Promise<Blob> {
  const slides = getSlides(scene.elements);
  if (!slides.length) throw new Error("Create a frame before exporting a PDF.");
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("ExcaliDash");

  // Export the complete snapshot, without applying playback's reveal filters.
  // Render one page at a time to bound canvas memory for larger presentations.
  for (const [index, slide] of slides.entries()) {
    signal.throwIfAborted();
    const svg = await renderSlideSvg(scene, slide.frame);
    signal.throwIfAborted();
    const url = URL.createObjectURL(
      new Blob([svg.outerHTML], { type: "image/svg+xml" }),
    );
    const canvas = document.createElement("canvas");
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      signal.throwIfAborted();
      const { width, height } = slide.frame;
      // Rasterize the same self-contained SVG used by playback, preserving
      // Excalidraw's fonts, clipping and images at 2x (up to 4096px per side).
      const scale = Math.min(2, 4096 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to render PDF pages.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Unable to render PDF pages.")),
          "image/png",
        ),
      );
      signal.throwIfAborted();
      const embedded = await pdf.embedPng(await png.arrayBuffer());
      // PDF pages have a 200-inch maximum. Scale oversized frames uniformly.
      const pageScale = Math.min(1, 14400 / Math.max(width, height));
      const page = pdf.addPage([width * pageScale, height * pageScale]);
      page.drawImage(embedded, { x: 0, y: 0, ...page.getSize() });
      onProgress(index + 1);
    } finally {
      URL.revokeObjectURL(url);
      canvas.width = canvas.height = 0;
    }
  }
  signal.throwIfAborted();
  return new Blob([new Uint8Array(await pdf.save())], {
    type: "application/pdf",
  });
}
