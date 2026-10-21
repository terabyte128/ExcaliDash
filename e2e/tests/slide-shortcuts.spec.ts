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
