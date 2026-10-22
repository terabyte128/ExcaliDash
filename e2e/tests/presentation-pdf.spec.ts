import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createDrawing, deleteDrawing } from "./helpers/api";

const redPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

test("PDF export preserves slide order, sizes, images and all reveal content", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, {
    name: "Presentation PDF",
    elements: [
      {
        id: "wide",
        type: "frame",
        name: "Wide",
        x: 0,
        y: 0,
        width: 640,
        height: 360,
        customData: {
          excalidashPresentation: { order: 1, notes: "Speaker notes" },
        },
      },
      {
        id: "tall",
        type: "frame",
        name: "Tall",
        x: 800,
        y: 100,
        width: 240,
        height: 400,
        customData: { excalidashPresentation: { order: 0 } },
      },
      {
        id: "deleted",
        type: "frame",
        x: 1500,
        y: 0,
        width: 640,
        height: 360,
        isDeleted: true,
      },
      {
        id: "blue",
        type: "rectangle",
        x: 840,
        y: 140,
        width: 100,
        height: 100,
        frameId: "tall",
        backgroundColor: "#0000ff",
        fillStyle: "solid",
        roughness: 0,
      },
      {
        id: "green",
        type: "rectangle",
        x: 200,
        y: 40,
        width: 100,
        height: 100,
        frameId: "wide",
        backgroundColor: "#00ff00",
        fillStyle: "solid",
        roughness: 0,
        customData: { excalidashReveal: { frameId: "wide", step: 2 } },
      },
      {
        id: "photo",
        type: "image",
        fileId: "photo-file",
        frameId: "wide",
        x: 40,
        y: 40,
        width: 100,
        height: 100,
        status: "saved",
        scale: [1, 1],
        customData: { excalidashReveal: { frameId: "wide", step: 1 } },
      },
    ],
    files: {
      "photo-file": {
        id: "photo-file",
        mimeType: "image/png",
        dataURL: redPng,
        created: Date.now(),
      },
    },
  });
  try {
    await page.goto(`/editor/${drawing.id}`);
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Presentation PDF.pdf");
    const bytes = new Uint8Array(await readFile((await download.path())!));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    // Parse and render the downloaded artifact with an independent PDF engine.
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await getDocument({ data: bytes }).promise;
    try {
      expect(pdf.numPages).toBe(2);
      for (const [index, width, height, pixels] of [
        [1, 240, 400, [[90, 90, [0, 0, 255, 255]]]],
        [
          2,
          640,
          360,
          [
            [90, 90, [255, 0, 0, 255]],
            [250, 90, [0, 255, 0, 255]],
          ],
        ],
      ] as const) {
        const pdfPage = await pdf.getPage(index);
        const viewport = pdfPage.getViewport({ scale: 1 });
        expect(viewport.width).toBe(width);
        expect(viewport.height).toBe(height);
        const factory = pdf.canvasFactory as {
          create(
            width: number,
            height: number,
          ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
          destroy(target: unknown): void;
        };
        const target = factory.create(width, height);
        try {
          await pdfPage.render({
            canvas: target.canvas,
            canvasContext: target.context,
            viewport,
          }).promise;
          for (const [x, y, color] of pixels) {
            expect(
              Array.from(target.context.getImageData(x, y, 1, 1).data),
            ).toEqual(color);
          }
          expect(
            Array.from(target.context.getImageData(10, 10, 1, 1).data),
          ).toEqual([255, 255, 255, 255]);
        } finally {
          factory.destroy(target);
        }
      }
    } finally {
      await pdf.destroy();
    }
    await expect(
      page.getByRole("button", { name: "Export PDF", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("dialog", { name: "Presentation", exact: true }),
    ).toBeVisible();
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});

test("PDF image failures show an error and allow retry", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, {
    name: "PDF retry",
    elements: [
      {
        id: "slide",
        type: "frame",
        name: "Image slide",
        x: 0,
        y: 0,
        width: 640,
        height: 360,
      },
      {
        id: "image",
        type: "image",
        fileId: "image-file",
        frameId: "slide",
        x: 40,
        y: 40,
        width: 100,
        height: 100,
        status: "saved",
        scale: [1, 1],
      },
    ],
    files: {
      "image-file": {
        id: "image-file",
        mimeType: "image/png",
        dataURL: redPng,
        created: Date.now(),
      },
    },
  });
  try {
    await page.goto(`/editor/${drawing.id}`);
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await expect(page.getByRole("img", { name: "Image slide" })).toBeVisible();
    const fileUrl = `**/api/files/${drawing.id}/image-file`;
    await page.route(fileUrl, (route) => route.fulfill({ status: 503 }));
    const button = page.getByRole("button", {
      name: "Export PDF",
      exact: true,
    });
    await button.click();
    await expect(page.getByRole("alert")).toContainText(
      "PDF export failed: Unable to load slide images",
    );
    await expect(button).toBeEnabled();
    await page.unroute(fileUrl);
    const downloadPromise = page.waitForEvent("download");
    await button.click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});
