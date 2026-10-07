/** Tab strip for single-Save record forms. Panels stay mounted by the caller (hidden), so values are retained. */
export function FormTabs({ tabs, active, onChange, invalid = [], hiddenTabs = [] }: { tabs: string[]; active: number; onChange: (index: number) => void; invalid?: boolean[]; hiddenTabs?: boolean[] }) {
  return <div className="editor-tabs wide" role="tablist" aria-label="Form sections">{tabs.map((label, i) => hiddenTabs[i] ? null :
    <button key={label} type="button" role="tab" aria-selected={active === i} className={`editor-tab${active === i ? " is-active" : ""}${invalid[i] ? " is-invalid" : ""}`} data-testid={`tab-editor-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`} onClick={() => onChange(i)}>
      {label}{invalid[i] && <span className="editor-tab-flag" aria-label="has errors"> !</span>}
    </button>)}</div>;
}
