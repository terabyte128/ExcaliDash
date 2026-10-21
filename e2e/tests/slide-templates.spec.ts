import { test, expect } from "@playwright/test";
import { createDrawing, deleteDrawing, getDrawing } from "./helpers/api";

test("built-in templates insert editable frame contents with one-step undo", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, { name: "Slide template test" });
  const layouts = [
    { name: "Title slide", texts: 2 },
    { name: "Title only", texts: 1 },
    { name: "Title + list", texts: 2 },
    { name: "Title + list + image", texts: 2 },
    { name: "Blank slide", texts: 0 },
  ];
  const liveElements = async () =>
    (await getDrawing(request, drawing.id)).elements?.filter(
      (element) => !element.isDeleted,
    ) || [];
  try {
    await page.goto(`/editor/${drawing.id}`);
    for (const [index, layout] of layouts.entries()) {
      if (index === 0) {
        await page
          .getByRole("button", { name: "Presentation", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Presentation", exact: true })
          .getByRole("button", { name: "Add slide", exact: true })
          .click();
        const picker = page.getByRole("region", { name: "Slide templates" });
        await expect(picker.getByRole("button")).toHaveCount(5);
        if (index === 0)
          await page.screenshot({ path: "test-results/slide-templates.png" });
        await picker
          .getByRole("button", {
            name: layout.name,
            exact: true,
          })
          .click();
      } else {
        await page
          .getByRole("button", { name: "Add slide", exact: true })
          .click();
        if (index === 1) {
          await page.keyboard.press("End");
          await expect(
            page.getByRole("menuitem", { name: "Blank slide", exact: true }),
          ).toBeFocused();
          await page.keyboard.press("Escape");
          await expect(
            page.getByRole("button", { name: "Add slide", exact: true }),
          ).toBeFocused();
          await page
            .getByRole("button", { name: "Add slide", exact: true })
            .click();
        }
        await page
          .getByRole("menuitem", { name: layout.name, exact: true })
          .click();
        await expect(
          page.getByRole("menu", { name: "Slide templates" }),
        ).toHaveCount(0);
      }
      await expect(
        page.getByRole("dialog", { name: "Presentation", exact: true }),
      ).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await liveElements()).filter((e) => e.type === "frame").length,
        )
        .toBe(index + 1);
      const elements = await liveElements();
      const frame = elements.find(
        (e) => e.type === "frame" && e.name === layout.name,
      )!;
      expect(frame.width / frame.height).toBeCloseTo(16 / 9, 8);
      expect(frame.customData.excalidashPresentation.order).toBe(index);
      const children = elements.filter((e) => e.frameId === frame.id);
      expect(children).toHaveLength(layout.texts);
      expect(
        children.every((e) => e.type === "text" && e.containerId === null),
      ).toBe(true);
      for (const child of children) {
        expect(child.x).toBeGreaterThanOrEqual(frame.x);
        expect(child.y).toBeGreaterThanOrEqual(frame.y);
        expect(child.x + child.width).toBeLessThanOrEqual(
          frame.x + frame.width,
        );
        expect(child.y + child.height).toBeLessThanOrEqual(
          frame.y + frame.height,
        );
        expect(elements.indexOf(child)).toBeLessThan(elements.indexOf(frame));
      }
      if (layout.name === "Title + list + image") {
        const list = children.find((e) => e.text.includes("First point"))!;
        expect(list.x + list.width).toBeLessThan(frame.x + frame.width / 2);
        expect(elements.some((e) => e.type === "image")).toBe(false);
      }
      for (const other of elements.filter(
        (e) => e.type === "frame" && e.id !== frame.id,
      )) {
        expect(frame.x).toBeGreaterThan(other.x + other.width);
      }
      if (index === 0) {
        await page.keyboard.press("ControlOrMeta+z");
        await expect.poll(async () => (await liveElements()).length).toBe(0);
        await page.keyboard.press("ControlOrMeta+Shift+z");
        await expect.poll(async () => (await liveElements()).length).toBe(3);
      }
    }
    await page.reload();
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Presentation",
      exact: true,
    });
    await expect(dialog.getByRole("listitem")).toHaveCount(5);
    await expect(
      dialog.getByRole("img", { name: "Title slide", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/template-title-slide.png" });
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});

test("slide templates respect the saved frame ratio", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, {
    name: "Square template test",
  });
  try {
    await page.addInitScript(() =>
      localStorage.setItem("excalidash-frame-ratio-prototype", "1:1"),
    );
    await page.goto(`/editor/${drawing.id}`);
    await page
      .getByRole("button", { name: "Presentation", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Presentation", exact: true })
      .getByRole("button", { name: "Add slide", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Slide templates" })
      .getByRole("button", { name: "Blank slide", exact: true })
      .click();
    await expect
      .poll(async () => {
        const frame = (await getDrawing(request, drawing.id)).elements?.find(
          (e) => e.type === "frame" && !e.isDeleted,
        );
        return frame ? frame.width / frame.height : null;
      })
      .toBe(1);
  } finally {
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});
