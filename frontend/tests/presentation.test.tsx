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

  it("reorders only presentation metadata, preserving scene stacking and unrelated data", () => {
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
