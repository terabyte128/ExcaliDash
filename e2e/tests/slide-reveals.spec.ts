import { test, expect, type Page } from "@playwright/test";
import { createDrawing, deleteDrawing, getDrawing } from "./helpers/api";

async function visibleColors(page: Page) {
  return page
    .getByRole("dialog", { name: "Presentation playback" })
    .getByRole("img")
    .evaluate(async (image: HTMLImageElement) => {
      const svg = new DOMParser().parseFromString(
        await (await fetch(image.src)).text(),
        "image/svg+xml",
      );
      return ["#e03131", "#2f9e44"].map((color) =>
        [...svg.querySelectorAll(`[fill="${color}"]`)].some((node) => {
          for (
            let parent: Element | null = node;
            parent;
            parent = parent.parentElement
          ) {
            if (
              parent.getAttribute("opacity") === "0" ||
              parent.getAttribute("fill-opacity") === "0"
            )
              return false;
          }
          return true;
        }),
      );
    });
}

test("clicks reveal elements before advancing and backward navigation reverses reveals", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, {
    name: "Reveal test",
    elements: [
      {
        id: "red",
        type: "rectangle",
        x: 40,
        y: 50,
        width: 100,
        height: 80,
        backgroundColor: "#e03131",
        fillStyle: "solid",
        frameId: "first",
        customData: { excalidashReveal: { frameId: "first", step: 1 } },
      },
      {
        id: "green",
        type: "rectangle",
        x: 200,
        y: 50,
        width: 100,
        height: 80,
        backgroundColor: "#2f9e44",
        fillStyle: "solid",
        frameId: "first",
        customData: { excalidashReveal: { frameId: "first", step: 3 } },
      },
      {
        id: "first",
        type: "frame",
        name: "First",
        x: 0,
        y: 0,
        width: 640,
        height: 360,
      },
      {
        id: "second",
        type: "frame",
        name: "Second",
        x: 800,
        y: 0,
        width: 640,
        height: 360,
      },
    ],
  });
  try {
    await page.goto(`/editor/${drawing.id}`);
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await page.getByRole("button", { name: "Present", exact: true }).click();
    const playback = page.getByRole("dialog", {
      name: "Presentation playback",
    });
    await expect(playback.getByRole("img", { name: "First" })).toBeVisible();
    await expect.poll(() => visibleColors(page)).toEqual([false, false]);
    await playback.getByTestId("presentation-slide").click();
    await expect.poll(() => visibleColors(page)).toEqual([true, false]);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => visibleColors(page)).toEqual([true, true]);
    await page.keyboard.press("ArrowRight");
    await expect(playback.getByRole("img", { name: "Second" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(playback.getByRole("img", { name: "First" })).toBeVisible();
    await expect.poll(() => visibleColors(page)).toEqual([true, true]);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => visibleColors(page)).toEqual([true, false]);
    await page.keyboard.press("Home");
    await expect.poll(() => visibleColors(page)).toEqual([false, false]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect.poll(() => visibleColors(page)).toEqual([false, false]);
    expect(
      (await getDrawing(request, drawing.id)).elements?.filter(
        (e) => e.opacity === 0,
      ),
    ).toHaveLength(0);
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});

test("canvas reveal assignments persist and undo as one change", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, { name: "Assign reveals" });
  try {
    await page.goto(`/editor/${drawing.id}`);
    await page.getByRole("button", { name: "Add slide", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Title only", exact: true })
      .click();
    await page.keyboard.press("Escape");
    // Newly inserted 960x540 slide is fitted to the viewport; select its title.
    await page
      .locator("canvas.excalidraw__canvas.interactive")
      .click({ position: { x: 400, y: 175 } });
    const control = page.getByRole("group", {
      name: "Appear on click",
      exact: true,
    });
    await expect(control).toBeVisible();
    await control
      .getByRole("button", { name: "+ New click 1", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await getDrawing(request, drawing.id)).elements?.find(
            (e) => e.type === "text",
          )?.customData?.excalidashReveal?.step,
      )
      .toBe(1);
    await page.locator(".excalidraw").focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(
      control.getByRole("button", { name: "Always visible" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        async () =>
          (await getDrawing(request, drawing.id)).elements?.find(
            (e) => e.type === "text",
          )?.customData?.excalidashReveal?.step ?? 0,
      )
      .toBe(0);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect
      .poll(
        async () =>
          (await getDrawing(request, drawing.id)).elements?.find(
            (e) => e.type === "text",
          )?.customData?.excalidashReveal?.step,
      )
      .toBe(1);
    await page.reload();
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.getByTestId("reveal-progress")).toHaveText(
      "Reveal 0 / 1",
    );
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});
