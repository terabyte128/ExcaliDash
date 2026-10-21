import { test, expect } from "@playwright/test";
import { createDrawing, deleteDrawing, getDrawing } from "./helpers/api";

const frame = (id: string, name: string, x: number) => ({
  id,
  type: "frame",
  name,
  x,
  y: 0,
  width: 640,
  height: 360,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
});

test("frame presentations save notes/order and navigate without changing the scene", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, {
    name: "E2E Presentation",
    elements: [
      frame("intro", "Introduction", 0),
      frame("summary", "Summary", 800),
      {
        id: "shape",
        type: "rectangle",
        x: 30,
        y: 30,
        width: 100,
        height: 100,
        frameId: "intro",
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
      },
      {
        id: "unframed",
        type: "rectangle",
        x: 820,
        y: 40,
        width: 60,
        height: 60,
        backgroundColor: "#e03131",
        fillStyle: "solid",
      },
    ],
  });
  try {
    await page.goto(`/editor/${drawing.id}`);
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Presentation",
      exact: true,
    });
    await expect(
      dialog.getByRole("img", { name: "Introduction" }),
    ).toBeVisible();
    const preview = dialog.getByRole("img", { name: "Introduction" });
    const originalSource = await preview.getAttribute("src");
    const svg = await preview.evaluate(async (image: HTMLImageElement) => {
      const response = await fetch(image.src);
      return {
        type: response.headers.get("content-type"),
        content: await response.text(),
      };
    });
    expect(svg.type).toBe("image/svg+xml");
    expect(svg.content).toContain("<svg");
    expect(svg.content).toContain("viewBox");
    const bounds = (await preview.boundingBox())!;
    await page.mouse.move(bounds.x + 50, bounds.y + 50);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 100, { steps: 20 });
    await page.mouse.up();
    await expect(preview).toHaveAttribute("src", originalSource!);
    await dialog
      .getByLabel("Speaker notes", { exact: true })
      .fill("Welcome to the presentation.");
    await dialog.getByRole("button", { name: "Move Summary up" }).click();
    await expect(dialog.getByRole("listitem").first()).toContainText(
      "1. Summary",
    );
    await page.screenshot({ path: "test-results/presentation-setup.png" });
    await expect
      .poll(async () => {
        const saved = await getDrawing(request, drawing.id);
        return saved.elements?.find((element) => element.id === "intro")
          ?.customData?.excalidashPresentation;
      })
      .toEqual({ notes: "Welcome to the presentation.", order: 1 });

    const arranged = (await getDrawing(request, drawing.id)).elements!;
    expect(arranged.find((e) => e.id === "summary")).toMatchObject({
      x: 0,
      y: 0,
    });
    expect(arranged.find((e) => e.id === "intro")).toMatchObject({
      x: 760,
      y: 0,
    });
    expect(arranged.find((e) => e.id === "shape")).toMatchObject({
      x: 790,
      y: 30,
      frameId: "intro",
    });
    expect(arranged.find((e) => e.id === "unframed")).toMatchObject({
      x: 820,
      y: 40,
    });
    expect(
      arranged.find((e) => e.id === "unframed")?.frameId ?? null,
    ).toBeNull();
    await dialog
      .getByRole("button", { name: "2. Introduction", exact: true })
      .click();
    await expect
      .poll(async () =>
        dialog
          .getByRole("img", { name: "Introduction" })
          .evaluate(async (image: HTMLImageElement) =>
            (await (await fetch(image.src)).text()).includes("#e03131"),
          ),
      )
      .toBe(true);
    await dialog.getByRole("button", { name: "Close presentation" }).click();
    await page.locator(".excalidraw").focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(
        async () =>
          (await getDrawing(request, drawing.id)).elements?.find(
            (e) => e.id === "intro",
          )?.x,
      )
      .toBe(0);
    const undone = (await getDrawing(request, drawing.id)).elements!;
    expect(undone.find((e) => e.id === "summary")?.x).toBe(800);
    expect(undone.find((e) => e.id === "shape")?.x).toBe(30);
    expect(undone.find((e) => e.id === "unframed")?.x).toBe(820);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect
      .poll(
        async () =>
          (await getDrawing(request, drawing.id)).elements?.find(
            (e) => e.id === "intro",
          )?.x,
      )
      .toBe(760);

    await page.reload();
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await expect(dialog.getByRole("listitem").first()).toContainText(
      "1. Summary",
    );
    const before = (await getDrawing(request, drawing.id)).elements;
    await dialog.getByRole("button", { name: "Present", exact: true }).click();
    const playback = page.getByRole("dialog", {
      name: "Presentation playback",
    });
    await expect(playback.getByRole("img", { name: "Summary" })).toBeVisible();
    await page.screenshot({ path: "test-results/presentation-playback.png" });
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    const slideBounds = await playback
      .getByTestId("presentation-slide")
      .boundingBox();
    const screenBounds = await playback.boundingBox();
    expect(slideBounds).toEqual(screenBounds);
    await expect(playback.getByTestId("presentation-controls")).toHaveCSS(
      "opacity",
      "0",
    );
    await page.mouse.move(400, 300);
    await expect(playback.getByTestId("presentation-controls")).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(
      playback.getByText("Speaker notes", { exact: true }),
    ).toHaveCount(0);
    // Hold the next image's decode to exercise the loading interval, rather
    // than only checking the final slide after a potentially black frame.
    await page.evaluate(() => {
      const original = HTMLImageElement.prototype.decode;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      Object.assign(window, { releaseSlideDecode: release });
      HTMLImageElement.prototype.decode = async function () {
        await original.call(this);
        await gate;
        HTMLImageElement.prototype.decode = original;
      };
    });
    await page.keyboard.press("ArrowRight");
    await expect(
      playback.getByRole("heading", { name: "Introduction" }),
    ).toBeVisible();
    await expect(playback.getByRole("img", { name: "Summary" })).toBeVisible();
    await expect(playback.getByText("Rendering slide…")).toHaveCount(0);
    await page.evaluate(() => {
      (
        window as unknown as { releaseSlideDecode: () => void }
      ).releaseSlideDecode();
    });
    await expect(
      playback.getByRole("img", { name: "Introduction" }),
    ).toBeVisible();
    await page.keyboard.press("n");
    await expect(
      playback.getByText("Welcome to the presentation."),
    ).toBeVisible();
    await page.keyboard.press("Home");
    await expect(playback.getByRole("img", { name: "Summary" })).toBeVisible();
    await page.keyboard.press("End");
    await expect(
      playback.getByRole("button", { name: "Next slide" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
    await dialog.getByRole("button", { name: "Close presentation" }).click();
    expect((await getDrawing(request, drawing.id)).elements).toEqual(before);
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});

test("empty drawings explain frames; fullscreen rejection still allows playback", async ({
  page,
  request,
}) => {
  const empty = await createDrawing(request, {
    name: "E2E Empty Presentation",
  });
  const drawing = await createDrawing(request, {
    name: "E2E Window Presentation",
    elements: [frame("only", "Only slide", 0)],
  });
  try {
    await page.goto(`/editor/${empty.id}`);
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await expect(page.getByText("Turn frames into slides")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Present", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Create a frame" }).click();
    await expect(
      page.getByRole("dialog", { name: "Presentation", exact: true }),
    ).toHaveCount(0);

    await page.goto(`/editor/${drawing.id}`);
    await page.evaluate(() => {
      HTMLElement.prototype.requestFullscreen = () =>
        Promise.reject(new Error("blocked"));
    });
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(
      page.getByText("Fullscreen was blocked. Presenting in this window."),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "Only slide" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Presentation", exact: true }),
    ).toBeVisible();
  } finally {
    await page.goto("/");
    await deleteDrawing(request, empty.id);
    await deleteDrawing(request, drawing.id);
  }
});
