import { test, expect } from "@playwright/test";
import { createDrawing, deleteDrawing, getDrawing } from "./helpers/api";

test("slide shortcuts open layouts, repeat the last template, and respect text editing", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, { name: "Slide shortcuts" });
  const savedFrames = async () =>
    (await getDrawing(request, drawing.id)).elements?.filter(
      (e) => e.type === "frame" && !e.isDeleted,
    ) || [];
  try {
    await page.goto(`/editor/${drawing.id}`);
    const add = page.getByRole("button", { name: "Add slide", exact: true });
    await expect(add).toBeEnabled();
    await page.locator(".excalidraw").focus();
    await page.keyboard.press("Shift+Alt+KeyN");
    const menu = page.getByRole("menu", { name: "Slide templates" });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Title slide", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(add).toBeFocused();
    await page.keyboard.press("Shift+KeyN");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("k");
    await expect(
      menu.getByRole("menuitem", { name: "Title slide", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("j");
    await expect(
      menu.getByRole("menuitem", { name: "Title only", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveCount(0);
    await expect
      .poll(async () => (await savedFrames()).map((frame) => frame.name))
      .toEqual(["Title only"]);
    await page.keyboard.press("Shift+Alt+KeyN");
    await expect
      .poll(async () => (await savedFrames()).map((frame) => frame.name))
      .toEqual(["Title only", "Title only"]);

    // Holding the repeat shortcut should never create a stream of slides.
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "KeyN",
          key: "N",
          shiftKey: true,
          altKey: true,
          repeat: true,
          bubbles: true,
        }),
      ),
    );

    // Real Excalidraw text editing must receive uppercase N normally.
    await page.keyboard.press("Escape");
    await page.keyboard.press("t");
    await page
      .locator("canvas.excalidraw__canvas.interactive")
      .click({ position: { x: 500, y: 300 } });
    const text = page.locator("textarea.excalidraw-wysiwyg");
    await expect(text).toBeVisible();
    await page.keyboard.press("Shift+KeyN");
    await expect(text).toHaveValue("N");
    await page.keyboard.press("Shift+Enter");
    await expect(text).toHaveValue("N\n");
    await expect(menu).toHaveCount(0);
    await page.keyboard.press("Shift+Alt+KeyN");
    await expect(text).toBeVisible();
    await page.keyboard.press("Escape");

    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Presentation",
      exact: true,
    });
    await dialog.getByLabel("Speaker notes", { exact: true }).fill("Notes");
    await page.keyboard.press("Shift+KeyN");
    await expect(
      dialog.getByLabel("Speaker notes", { exact: true }),
    ).toHaveValue("NotesN");
    await page.keyboard.press("Shift+Enter");
    await expect(
      dialog.getByLabel("Speaker notes", { exact: true }),
    ).toHaveValue("NotesN\n");
    await dialog.getByRole("button", { name: "Close presentation" }).focus();
    await page.keyboard.press("Shift+Alt+KeyN");
    await expect(dialog).toBeVisible();
    await expect(menu).toHaveCount(0);
    expect(await savedFrames()).toHaveLength(2);
    await page.keyboard.press("ControlOrMeta+Enter");
    const playback = page.getByRole("dialog", {
      name: "Presentation playback",
    });
    await expect(playback).toBeVisible();
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Close presentation" }).click();
    await page.locator(".excalidraw").focus();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(playback).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});

test("Shift+Enter starts at the active frame or its contents, with a first-slide fallback", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, {
    name: "Active slide shortcut",
    elements: [
      {
        id: "second",
        type: "frame",
        name: "Second",
        x: 800,
        y: 0,
        width: 640,
        height: 360,
        customData: { excalidashPresentation: { order: 1 } },
      },
      {
        id: "first",
        type: "frame",
        name: "First",
        x: 0,
        y: 0,
        width: 640,
        height: 360,
        customData: { excalidashPresentation: { order: 0 } },
      },
      {
        id: "reveal-first",
        type: "rectangle",
        x: 40,
        y: 40,
        width: 100,
        height: 100,
        frameId: "first",
        customData: { excalidashReveal: { frameId: "first", step: 1 } },
      },
      {
        id: "inside-second",
        type: "rectangle",
        x: 840,
        y: 40,
        width: 100,
        height: 100,
        frameId: "second",
        customData: { excalidashReveal: { frameId: "second", step: 1 } },
      },
      {
        id: "outside",
        type: "rectangle",
        x: 1600,
        y: 40,
        width: 100,
        height: 100,
      },
    ],
  });
  try {
    await page.goto(`/editor/${drawing.id}`);
    await expect(
      page.getByRole("button", { name: "Presentation", exact: true }),
    ).toBeEnabled();
    const playback = page.getByRole("dialog", {
      name: "Presentation playback",
    });
    const setup = page.getByRole("dialog", {
      name: "Presentation",
      exact: true,
    });
    for (const [ids, title] of [
      [["second"], "Second"],
      [["inside-second"], "Second"],
      [[], "First"],
      [["outside"], "First"],
      [["first", "second"], "First"],
    ] as const) {
      await page.evaluate((ids) => {
        (window as any).__EXCALIDASH_EXCALIDRAW_API__.updateScene({
          appState: {
            selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])),
          },
        });
      }, ids);
      await page.locator(".excalidraw").focus();
      await page.keyboard.press("Shift+Enter");
      await expect(
        playback.getByRole("img", { name: title, exact: true }),
      ).toBeVisible();
      await expect(playback.getByTestId("reveal-progress")).toHaveText(
        "Reveal 0 / 1",
      );
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(true);
      await page.keyboard.press("Escape");
      await setup.getByRole("button", { name: "Close presentation" }).click();
    }
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await setup.getByRole("button", { name: "2. Second", exact: true }).click();
    await page.keyboard.press("Shift+Enter");
    await expect(
      playback.getByRole("img", { name: "Second", exact: true }),
    ).toBeVisible();
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});
