import { useEffect, useState, type RefObject } from "react";
import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import { unstable_batchedUpdates } from "react-dom";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  assignRevealStep,
  getRevealSelection,
  MAX_REVEAL_STEP,
} from "./slideReveals";

export function RevealStepControl({
  apiRef,
  enabled,
  isReady,
}: {
  apiRef: RefObject<ExcalidrawImperativeAPI | null>;
  enabled: boolean;
  isReady: boolean;
}) {
  const [selection, setSelection] =
    useState<ReturnType<typeof getRevealSelection>>(null);
  useEffect(() => {
    const api = apiRef.current;
    if (!enabled || !isReady || !api) return;
    const update = () => {
      const state = api.getAppState();
      const next =
        state.editingTextElement ||
        state.newElement ||
        state.activeTool.type !== "selection"
          ? null
          : getRevealSelection(
              api.getSceneElements(),
              state.selectedElementIds,
            );
      setSelection((previous) =>
        JSON.stringify(previous && { ...previous, ids: [...previous.ids] }) ===
        JSON.stringify(next && { ...next, ids: [...next.ids] })
          ? previous
          : next,
      );
    };
    update();
    return api.onChange(update);
  }, [apiRef, enabled, isReady]);
  if (!enabled || !selection) return null;
  const nextStep = Math.min(MAX_REVEAL_STEP, (selection.steps.at(-1) || 0) + 1);
  const assign = (step: number) => {
    const api = apiRef.current;
    if (!api || !enabled) return;
    const elements = api.getSceneElementsIncludingDeleted();
    const selected = api.getAppState().selectedElementIds;
    const targets = getRevealSelection(elements, selected);
    if (!targets) return;
    // Excalidraw 0.18 ignores an undo delta whose only value is undefined.
    // Give absent customData an equivalent empty-object baseline, then capture
    // the actual assignment. Batch both so no intermediate scene is broadcast.
    const baseline = elements.map((element) =>
      targets.ids.has(element.id) && element.customData === undefined
        ? newElementWith(element, { customData: {} })
        : element,
    );
    unstable_batchedUpdates(() => {
      if (baseline.some((element, i) => element !== elements[i])) {
        api.updateScene({
          elements: baseline,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
      api.updateScene({
        elements: assignRevealStep(baseline, selected, step),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
  };
  const options = [
    { step: 0, label: "Always visible" },
    ...selection.steps.map((step, index) => ({
      step,
      label: `Click ${index + 1}`,
    })),
    ...(!selection.steps.includes(nextStep)
      ? [{ step: nextStep, label: `+ New click ${selection.steps.length + 1}` }]
      : []),
  ];
  return (
    <div
      className="ui-popover fixed bottom-16 left-1/2 z-30 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 p-3 text-slate-700 dark:text-neutral-200"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 text-xs font-semibold">
        Appear on click · {selection.ids.size} element
        {selection.ids.size === 1 ? "" : "s"}
      </div>
      {selection.step === null && (
        <p className="mb-2 text-xs text-slate-500">Mixed steps</p>
      )}
      <div
        role="group"
        aria-label="Appear on click"
        className="flex max-h-40 flex-wrap gap-1 overflow-auto rounded-lg bg-slate-50 p-1 dark:bg-neutral-800"
      >
        {options.map(({ step, label }) => (
          <button
            key={step}
            type="button"
            aria-pressed={selection.step === step}
            onClick={() => assign(step)}
            className={`rounded-md px-2.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${selection.step === step ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" : "hover:bg-slate-100 dark:hover:bg-neutral-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
        Groups and bound labels appear together. All content stays visible while
        editing.
      </p>
    </div>
  );
}
