import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { SLIDE_TEMPLATES, type SlideTemplateId } from "./slideTemplates";

function LayoutIcon({ template }: { template: SlideTemplateId }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 28"
      className="h-7 w-10 shrink-0 text-indigo-500 dark:text-indigo-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="1" width="38" height="26" rx="3" />
      {template === "title-slide" ? (
        <>
          <path d="M9 12h22" strokeWidth="2.5" />
          <path d="M14 17h12" opacity=".5" />
        </>
      ) : template !== "blank" ? (
        <>
          <path d="M7 7h26" strokeWidth="2.5" />
          {(template === "title-list" || template === "title-list-image") && (
            <path
              d={
                template === "title-list-image"
                  ? "M7 13h12M7 17h12M7 21h9"
                  : "M7 13h26M7 17h26M7 21h20"
              }
              opacity=".5"
            />
          )}
        </>
      ) : null}
    </svg>
  );
}

export function AddSlideDropdown({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (template: SlideTemplateId) => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div
      ref={container}
      className="relative shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        // Keep canvas shortcuts out of this menu, while retaining normal Tab behavior.
        event.stopPropagation();
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        } else if (
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
          (open &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            ["j", "k"].includes(event.key))
        ) {
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          const items = Array.from(
            menu.current?.querySelectorAll<HTMLButtonElement>("button") || [],
          );
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : (index +
                    (event.key === "ArrowDown" || event.key === "j" ? 1 : -1) +
                    items.length) %
                  items.length;
          items[next]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? menuId : undefined}
        className={`ui-button-secondary h-10 gap-2 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${open ? "bg-indigo-50 dark:bg-neutral-700" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <Plus
          size={16}
          strokeWidth={2.5}
          className="text-indigo-600 dark:text-indigo-400"
        />
        <span className="whitespace-nowrap">Add slide</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && !disabled && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label="Slide templates"
          className="ui-menu absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)]"
        >
          <div className="px-3 pb-2 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
            Choose a layout
          </div>
          {SLIDE_TEMPLATES.map((template) => (
            <button
              type="button"
              role="menuitem"
              aria-label={template.label}
              tabIndex={-1}
              key={template.id}
              className="ui-menu-item gap-3 p-3 focus:outline-none focus-visible:bg-indigo-50 focus-visible:text-indigo-600 dark:focus-visible:bg-neutral-800 dark:focus-visible:text-indigo-400"
              onClick={() => {
                setOpen(false);
                onSelect(template.id);
              }}
            >
              <LayoutIcon template={template.id} />
              <span className="min-w-0">
                <span className="block font-semibold">{template.label}</span>
                <span className="mt-0.5 block text-xs font-normal leading-relaxed text-slate-400 dark:text-neutral-500">
                  {template.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
