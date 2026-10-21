import { SLIDE_TEMPLATES, type SlideTemplateId } from "./slideTemplates";

export function SlideTemplatePicker({
  onSelect,
}: {
  onSelect: (id: SlideTemplateId) => void;
}) {
  return (
    <section
      aria-label="Slide templates"
      className="shrink-0 max-h-[50vh] overflow-auto border-b border-slate-200 p-4 dark:border-neutral-800"
    >
      <p className="mb-3 text-sm text-slate-500 dark:text-neutral-400">
        Choose a layout to add it to the canvas and edit its contents. Uses your
        frame ratio, or 16:9 for Freeform.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SLIDE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            aria-label={template.label}
            onClick={() => onSelect(template.id)}
            className="rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-500 hover:bg-indigo-50 focus-visible:outline-indigo-500 dark:border-neutral-700 dark:hover:bg-indigo-950/30"
          >
            <div
              aria-hidden="true"
              className={`mb-3 flex aspect-video flex-col rounded border border-slate-300 bg-white p-3 ${template.id === "title-slide" ? "items-center justify-center gap-2" : "gap-3"}`}
            >
              {template.id !== "blank" && (
                <div className="h-2 w-3/4 rounded-sm bg-slate-600" />
              )}
              {template.id === "title-slide" && (
                <div className="h-1 w-1/2 bg-slate-300" />
              )}
              {(template.id === "title-list" ||
                template.id === "title-list-image") && (
                <div
                  className={`space-y-2 ${template.id === "title-list-image" ? "w-1/2" : "w-full"}`}
                >
                  {[0, 1, 2].map((line) => (
                    <div key={line} className="h-1 w-3/4 bg-slate-300" />
                  ))}
                </div>
              )}
            </div>
            <span className="block text-sm font-semibold">
              {template.label}
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-neutral-400">
              {template.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
