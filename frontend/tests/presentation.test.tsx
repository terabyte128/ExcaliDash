import { describe, expect, it, vi } from "vitest";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  getSlides,
  moveSlide,
  updateSlideMetadata,
} from "../src/pages/editor/presentation";

vi.mock("@excalidraw/excalidraw", () => ({
  newElementWith: (
    element: ExcalidrawElement,
    updates: Partial<ExcalidrawElement>,
  ) => ({ ...element, ...updates, version: element.version + 1 }),
}));

const frame = (id: string, extra = {}) =>
  ({
    id,
    type: "frame",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    name: id,
    version: 1,
    ...extra,
  }) as ExcalidrawElement;

describe("presentation metadata", () => {
  it("ignores deleted, degenerate and non-frame elements and handles malformed metadata", () => {
    const slides = getSlides([
      frame("new", {
        customData: { excalidashPresentation: { order: "first", notes: 123 } },
      }),
      frame("deleted", { isDeleted: true }),
      frame("zero", { width: 0 }),
      frame("shape", { type: "rectangle" }),
      frame("ordered", {
        customData: { excalidashPresentation: { order: 0, notes: "Hello" } },
      }),
    ]);
    expect(slides.map((slide) => [slide.frame.id, slide.notes])).toEqual([
      ["ordered", "Hello"],
      ["new", ""],
    ]);
  });

  it("reorders slides while preserving scene stacking and unrelated data", () => {
    const first = frame("first", {
      customData: {
        plugin: "keep",
        excalidashPresentation: { notes: "Keep notes" },
      },
    });
    const shape = frame("shape", { type: "rectangle" });
    const elements = [first, shape, frame("second")];
    const reordered = moveSlide(elements, "second", -1);
    expect(reordered.map((element) => element.id)).toEqual([
      "first",
      "shape",
      "second",
    ]);
    expect(getSlides(reordered).map((slide) => slide.frame.id)).toEqual([
      "second",
      "first",
    ]);
    expect(reordered[1]).toBe(shape);
    expect(reordered[0].customData).toEqual({
      plugin: "keep",
      excalidashPresentation: { notes: "Keep notes", order: 1 },
    });
    expect(first.customData).toEqual({
      plugin: "keep",
      excalidashPresentation: { notes: "Keep notes" },
    });
  });

  it("arranges variable-sized frames and their members, ignoring unframed and deleted elements", () => {
    const a = frame("a", { x: -100, y: 200, width: 300 });
    const b = frame("b", { x: 600, y: -50, width: 500 });
    const child = frame("child", {
      type: "text",
      frameId: "a",
      x: -80,
      y: 220,
      groupIds: ["group"],
    });
    const arrow = frame("arrow", {
      type: "arrow",
      frameId: "b",
      x: 650,
      y: 0,
      points: [
        [0, 0],
        [100, 20],
      ],
      endBinding: { elementId: "child" },
    });
    const unframed = frame("unframed", { type: "rectangle", x: -90, y: -40 });
    const deleted = frame("deleted", {
      frameId: "a",
      isDeleted: true,
      x: 5,
      y: 8,
    });
    const original = [child, a, arrow, b, unframed, deleted];
    const result = moveSlide(original, "b", -1);
    expect(result.map((e) => [e.x, e.y])).toEqual([
      [540, -30],
      [520, -50],
      [-50, 0],
      [-100, -50],
      [-90, -40],
      [5, 8],
    ]);
    expect(result[0].frameId).toBe("a");
    expect(result[2]).toMatchObject({
      points: [
        [0, 0],
        [100, 20],
      ],
      endBinding: { elementId: "child" },
    });
    expect(result[4]).toBe(unframed);
    expect(result[5]).toBe(deleted);
    expect(a.x).toBe(-100);
    expect(moveSlide(original, "a", -1)).toEqual(original);
  });

  it("patches notes from the latest elements, retaining remote order and deleted frames", () => {
    const deleted = frame("deleted", { isDeleted: true });
    const elements = [
      frame("slide", {
        customData: { excalidashPresentation: { order: 4, future: true } },
      }),
      deleted,
    ];
    const result = updateSlideMetadata(
      elements,
      new Map([
        ["slide", { notes: "Updated" }],
        ["deleted", { notes: "Ignored" }],
      ]),
    );
    expect(result[0].customData?.excalidashPresentation).toEqual({
      order: 4,
      future: true,
      notes: "Updated",
    });
    expect(result[1]).toBe(deleted);
  });
});
