import { newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { getSlides } from "./presentation";

const KEY = "excalidashReveal";
export const MAX_REVEAL_STEP = 100;

export function getRevealStep(element: ExcalidrawElement): number {
  const value = element.customData?.[KEY];
  return value?.frameId === element.frameId &&
    Number.isInteger(value?.step) &&
    value.step > 0 &&
    value.step <= MAX_REVEAL_STEP
    ? value.step
    : 0;
}

// Groups (including nested groups) and bound labels are one reveal unit.
// Connections to arrows are deliberately not followed: arrows can reveal separately.
export function getRevealUnits(
  elements: readonly ExcalidrawElement[],
  frameId: string,
) {
  const children = elements.filter(
    (e) =>
      !e.isDeleted &&
      e.frameId === frameId &&
      e.type !== "frame" &&
      e.type !== "magicframe",
  );
  const parent = new Map(children.map((e) => [e.id, e.id]));
  const root = (id: string): string => {
    const next = parent.get(id)!;
    if (next === id) return id;
    const result = root(next);
    parent.set(id, result);
    return result;
  };
  const join = (a: string, b: string) => {
    if (parent.has(a) && parent.has(b)) parent.set(root(a), root(b));
  };
  const groups = new Map<string, string>();
  for (const element of children) {
    for (const group of element.groupIds || []) {
      const other = groups.get(group);
      if (other) join(element.id, other);
      else groups.set(group, element.id);
    }
    if (element.type === "text" && element.containerId)
      join(element.id, element.containerId);
    for (const bound of element.boundElements || [])
      if (bound.type === "text") join(element.id, bound.id);
  }
  const units = new Map<string, ExcalidrawElement[]>();
  for (const element of children) {
    const id = root(element.id);
    const unit = units.get(id) || [];
    unit.push(element);
    units.set(id, unit);
  }
  return [...units.values()].map((members) => ({
    members,
    step: Math.max(...members.map(getRevealStep)),
  }));
}

export function getRevealSelection(
  elements: readonly ExcalidrawElement[],
  selected: Readonly<Record<string, boolean>>,
) {
  const picked = elements.filter((e) => !e.isDeleted && selected[e.id]);
  const frameId = picked[0]?.frameId;
  if (
    !frameId ||
    picked.some(
      (e) =>
        e.frameId !== frameId || e.type === "frame" || e.type === "magicframe",
    ) ||
    !elements.some(
      (e) => e.id === frameId && e.type === "frame" && !e.isDeleted,
    )
  )
    return null;
  const units = getRevealUnits(elements, frameId);
  const targets = units.filter((unit) =>
    unit.members.some((e) => selected[e.id]),
  );
  const steps = [
    ...new Set(units.map((unit) => unit.step).filter(Boolean)),
  ].sort((a, b) => a - b);
  return {
    frameId,
    ids: new Set(targets.flatMap((unit) => unit.members.map((e) => e.id))),
    steps,
    step: targets.every((unit) => unit.step === targets[0].step)
      ? targets[0].step
      : null,
  };
}

export function assignRevealStep(
  elements: readonly ExcalidrawElement[],
  selected: Readonly<Record<string, boolean>>,
  step: number,
) {
  const selection = getRevealSelection(elements, selected);
  if (
    !selection ||
    !Number.isInteger(step) ||
    step < 0 ||
    step > MAX_REVEAL_STEP
  )
    return [...elements];
  return elements.map((element) =>
    selection.ids.has(element.id)
      ? newElementWith(element, {
          customData: {
            ...element.customData,
            [KEY]: { frameId: selection.frameId, step },
          },
        })
      : element,
  );
}

export function getPresentationStops(elements: readonly ExcalidrawElement[]) {
  return getSlides(elements).flatMap((slide, slideIndex) => {
    const steps = [
      ...new Set(
        getRevealUnits(elements, slide.frame.id)
          .map((unit) => unit.step)
          .filter(Boolean),
      ),
    ].sort((a, b) => a - b);
    return [0, ...steps].map((step, revealIndex) => ({
      slideIndex,
      step,
      revealIndex,
      revealCount: steps.length,
    }));
  });
}

export function getRevealedElements(
  elements: readonly ExcalidrawElement[],
  frameId: string,
  step: number,
) {
  const hidden = new Set(
    getRevealUnits(elements, frameId)
      .filter((unit) => unit.step > step)
      .flatMap((unit) => unit.members.map((e) => e.id)),
  );
  // Keep invisible elements in the export so bound-arrow geometry and text layout
  // remain unchanged. These copies never reach the live canvas or persistence.
  return elements.map((element) =>
    hidden.has(element.id) ? { ...element, opacity: 0 } : element,
  );
}
