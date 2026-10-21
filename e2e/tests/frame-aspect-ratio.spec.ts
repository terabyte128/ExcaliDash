import { test, expect } from "@playwright/test";
import { createDrawing, deleteDrawing, getDrawing } from "./helpers/api";

test("native frames snap to the guide, assign children, and undo in one step", async ({
  page,
  request,
  context,
}) => {
  const drawing = await createDrawing(request, {
    name: "Frame ratio prototype",
  });
  const frames = async () =>
    (await getDrawing(request, drawing.id)).elements?.filter(
      (e) => e.type === "frame" && !e.isDeleted,
    ) || [];
  const drag = async (x: number, y: number, dx: number, dy: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
  };
  const peer = await context.newPage();
  try {
    // Observe actual socket delivery without giving the peer access to editor internals.
    const peerFrames: { width: number; height: number }[] = [];
    peer.on("websocket", (socket) =>
      socket.on("framereceived", ({ payload }) => {
        const text = payload.toString();
        if (!text.startsWith("42")) return;
        try {
          const [, data] = JSON.parse(text.slice(2));
          for (const element of data.elements || [])
            if (element.type === "frame") peerFrames.push(element);
        } catch {
          /* Not a scene update. */
        }
      }),
    );
    await peer.goto(`/editor/${drawing.id}`);
    await expect(
      peer.locator("canvas.excalidraw__canvas.interactive"),
    ).toBeVisible();
    await page.goto(`/editor/${drawing.id}`);
    await expect(
      page.locator("canvas.excalidraw__canvas.interactive"),
    ).toBeVisible();
    // Put a shape below the raw drag bounds, but inside the expanded guide.
    await page
      .locator("label")
      .filter({
        has: page.getByRole("radio", { name: "Rectangle", exact: true }),
      })
      .click();
    await drag(400, 350, 30, 20);
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (await getDrawing(request, drawing.id)).elements?.filter(
            (e) => e.type === "rectangle" && !e.isDeleted,
          ).length,
      )
      .toBe(1);
    await page.keyboard.press("f");
    await page
      .getByRole("group", { name: "New frame ratio" })
      .getByText("16:9", { exact: true })
      .click();
    await drag(300, 250, 320, 60);
    const guide = page.getByTestId("frame-ratio-guide");
    await expect(guide).toBeVisible();
    const bounds = (await guide.boundingBox())!;
    expect(bounds.x).toBeCloseTo(300, 0);
    expect(bounds.y).toBeCloseTo(250, 0);
    expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2);
    await page.mouse.up();
    await expect(guide).toHaveCount(0);
    await expect.poll(async () => (await frames()).length).toBe(1);
    await expect
      .poll(async () => {
        const current = (await frames())[0];
        return current?.width / current?.height;
      })
      .toBeCloseTo(16 / 9, 8);
    const frame = (await frames())[0];
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 8);
    await expect
      .poll(() =>
        peerFrames.some((f) => Math.abs(f.width / f.height - 16 / 9) < 0.0001),
      )
      .toBe(true);
    const saved = await getDrawing(request, drawing.id);
    expect(saved.elements?.find((e) => e.type === "rectangle")?.frameId).toBe(
      frame.id,
    );
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(async () => (await frames()).length).toBe(0);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect.poll(async () => (await frames()).length).toBe(1);
    expect((await frames())[0].width / (await frames())[0].height).toBeCloseTo(
      16 / 9,
      8,
    );
    // Reverse dragging retains the opposite anchor, including center resizing.
    await page.keyboard.press("f");
    await page.keyboard.down("Alt");
    await drag(950, 450, -100, -80);
    await expect(guide).toBeVisible();
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await expect.poll(async () => (await frames()).length).toBe(2);
    expect(
      (await frames()).every(
        (f) => Math.abs(f.width / f.height - 16 / 9) < 0.0001,
      ),
    ).toBe(true);
    // Shift retains the native square constraint instead of applying 16:9.
    await page.keyboard.press("f");
    await page.keyboard.down("Shift");
    await drag(750, 200, 100, 50);
    await expect(guide).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect.poll(async () => (await frames()).length).toBe(3);
    expect((await frames()).some((f) => f.width === f.height)).toBe(true);
    await page.reload();
    await expect(
      page.locator("canvas.excalidraw__canvas.interactive"),
    ).toBeVisible();
    await page
      .locator("canvas.excalidraw__canvas.interactive")
      .click({ position: { x: 1100, y: 500 } });
    await page.keyboard.press("f");
    await expect(
      page.getByRole("radio", { name: "16:9", exact: true }),
    ).toBeChecked();
  } finally {
    await peer.close();
    await page.goto("/");
    await deleteDrawing(request, drawing.id);
  }
});
