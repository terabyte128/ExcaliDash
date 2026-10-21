import { describe, expect, it, vi } from "vitest";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  assignRevealStep,
  getPresentationStops,
  getRevealSelection,
  getRevealedElements,
  getRevealStep,
} from "../src/pages/editor/slideReveals";
vi.mock("@excalidraw/excalidraw", () => ({
  newElementWith: (element: object, updates: object) => ({
    ...element,
    ...updates,
  }),
}));
const element = (id: string, extra = {}) =>
  ({
    id,
    type: "rectangle",
    frameId: "frame",
    groupIds: [],
    ...extra,
  }) as ExcalidrawElement;
const frame = element("frame", {
  type: "frame",
  frameId: null,
  width: 640,
  height: 360,
});

describe("slide reveals", () => {
  it("assigns nested groups and bound labels together while leaving connected arrows independent", () => {
    const elements = [
      frame,
      element("a", {
        groupIds: ["inner", "outer"],
        boundElements: [
          { type: "text", id: "label" },
          { type: "arrow", id: "arrow" },
        ],
        customData: { other: true },
      }),
      element("b", { groupIds: ["outer"] }),
      element("label", { type: "text", containerId: "a" }),
      element("arrow", { type: "arrow" }),
    ];
    const updated = assignRevealStep(elements, { a: true }, 2);
    expect(updated.map(getRevealStep)).toEqual([0, 2, 2, 2, 0]);
    expect(updated[1].customData?.other).toBe(true);
    expect(elements.map(getRevealStep)).toEqual([0, 0, 0, 0, 0]);
    const hidden = getRevealedElements(updated, "frame", 0);
    expect(hidden.filter((e) => e.opacity === 0).map((e) => e.id)).toEqual([
      "a",
      "b",
      "label",
    ]);
    expect(updated.some((e) => e.opacity === 0)).toBe(false);
  });
  it("skips empty steps and deleted elements and ignores metadata moved to a different frame", () => {
    const elements = [
      frame,
      element("a", {
        customData: { excalidashReveal: { frameId: "frame", step: 5 } },
      }),
      element("b", {
        isDeleted: true,
        customData: { excalidashReveal: { frameId: "frame", step: 2 } },
      }),
      element("moved", {
        frameId: "elsewhere",
        customData: { excalidashReveal: { frameId: "frame", step: 3 } },
      }),
    ];
    expect(getPresentationStops(elements).map((s) => s.step)).toEqual([0, 5]);
    expect(getRevealStep(elements[3])).toBe(0);
    expect(getRevealSelection(elements, { frame: true })).toBeNull();
    expect(getRevealSelection(elements, { a: true, moved: true })).toBeNull();
    expect(assignRevealStep(elements, { a: true }, -1)).toEqual(elements);
  });
});
