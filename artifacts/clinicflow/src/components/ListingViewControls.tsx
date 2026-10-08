import { useId, useState } from "react";
import { Columns3, ArrowUp, ArrowDown, Pin, PinOff, Bookmark, Trash2 } from "lucide-react";
import { AppDialog } from "./AppDialog";
import { arrangeColumns, type ListingLayout, type SavedView } from "@/lib/listing-views";
import "./listing-view-controls.css";
import { HelpTip } from "./HelpTip";

export function ColumnSettings({ columns, layout, label, onChange, onReset, reorderable = true, pinnable = true, iconOnly = false }: {
  columns: string[]; layout: ListingLayout; label: (c: string) => string; reorderable?: boolean; pinnable?: boolean; iconOnly?: boolean;
  onChange: (next: Partial<ListingLayout>) => void; onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { ordered, hidden, pinned, required } = arrangeColumns(columns, layout);
  const move = (c: string, delta: number) => {
    const next = [...ordered]; const i = next.indexOf(c); const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]]; onChange({ order: next });
  };
  const toggle = (c: string) => onChange({ hidden: hidden.includes(c) ? layout.hidden.filter(h => h !== c) : [...layout.hidden, c] });
   const trigger = <button type="button" className={`lvc-trigger${iconOnly ? " listing-icon-trigger" : ""}${hidden.length ? " has-active" : ""}`} onClick={() => setOpen(true)} aria-label={`Columns${hidden.length ? `, ${hidden.length} hidden` : ""}`} aria-expanded={open} aria-haspopup="dialog" data-testid="button-column-settings">
     <Columns3 size={15} aria-hidden />{iconOnly ? hidden.length > 0 && <span className="filter-count" aria-hidden>{hidden.length}</span> : <span>Columns{hidden.length ? ` · ${hidden.length} hidden` : ""}</span>}
   </button>;
   return <>
     {iconOnly ? <HelpTip text={`Show, order and pin columns${hidden.length ? `; ${hidden.length} hidden` : ""}. Preferences are saved on this device.`}>{trigger}</HelpTip> : trigger}
    <AppDialog open={open} onClose={() => setOpen(false)} title="Columns" variant="drawer">
      <p className="muted">{reorderable ? "Show, order and pin columns. One column can be pinned to the left at a time; pinning another replaces it." : "Show or hide columns. Column order is fixed for this operational view; record order is never changed."} Layout is saved on this device for your account and role. Hidden values stay available in each row's details.</p>
      <ul className="lvc-columns">{ordered.map((c, i) => <li key={c} data-testid={`column-setting-${c}`}>
        <label><input type="checkbox" checked={!hidden.includes(c)} disabled={c === required} onChange={() => toggle(c)} />{label(c)}{c === required && <small className="muted"> · always shown</small>}</label>
        <span className="lvc-row-actions">
          {reorderable && <><button type="button" aria-label={`Move ${label(c)} up`} disabled={i === 0} onClick={() => move(c, -1)}><ArrowUp size={14} aria-hidden /></button>
          <button type="button" aria-label={`Move ${label(c)} down`} disabled={i === ordered.length - 1} onClick={() => move(c, 1)}><ArrowDown size={14} aria-hidden /></button></>}
          {pinnable && <button type="button" aria-pressed={pinned === c} aria-label={pinned === c ? `Unpin ${label(c)}` : `Pin ${label(c)} as the one pinned column`} disabled={hidden.includes(c)} onClick={() => onChange({ pinned: pinned === c ? null : c })}>{pinned === c ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}</button>}
        </span>
      </li>)}</ul>
      <div className="filter-panel-foot"><button type="button" className="filter-clear" onClick={onReset} data-testid="button-reset-columns">Reset Columns</button><button type="button" className="filter-done" onClick={() => setOpen(false)}>Done</button></div>
    </AppDialog>
  </>;
}

/** Saved filter presets. Search text is never stored; only structured filters, sort and page size. */
export function SavedViews({ views, canSave, canShare = false, legacyViews = [], onImport, onApply, onSave, onDelete }: {
  views: SavedView[]; canSave: boolean; canShare?: boolean; legacyViews?: SavedView[]; onImport?: (view: SavedView) => Promise<boolean>; onApply: (view: SavedView) => void; onSave: (view: { name: string; share: boolean }) => boolean | Promise<boolean>; onDelete: (id: string) => void;
}) {
  const [share, setShare] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const accountNames = new Set(views.filter(v => v.ownedByMe !== false).map(v => v.name.trim().toLowerCase()));
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const inputId = useId();
  return <>
    <button type="button" className="lvc-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="button-saved-views">
      <Bookmark size={15} aria-hidden /><span>Views{views.length ? ` · ${views.length}` : ""}</span>
    </button>
    <AppDialog open={open} onClose={() => { setOpen(false); setError(""); setSaved(""); }} title="Saved Views" variant="drawer">
      <p className="muted">Saved views keep filters, sort, page size and the column layout for your account, synced across your devices. Search text is never saved.</p>
      {views.length ? <ul className="lvc-views">{views.map(v => <li key={v.id}>
        <button type="button" className="lvc-view-apply" onClick={() => { onApply(v); setOpen(false); }} data-testid={`button-apply-view-${v.id}`}><strong>{v.name}</strong><small>{Object.keys(v.filters).length} filter settings{v.columns ? " · column layout" : ""}{v.shared ? (v.ownedByMe === false ? " · shared with your role" : " · you shared this") : ""}</small></button>
        {v.ownedByMe !== false && <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => onDelete(v.id)} data-testid={`button-delete-view-${v.id}`}><Trash2 size={14} aria-hidden /></button>}
      </li>)}</ul> : <p className="empty-inline">No saved views yet.</p>}
      {legacyViews.length > 0 && onImport && <section className="lvc-legacy" aria-label="Views on this device" data-testid="legacy-views">
        <h3>On This Device Only</h3>
        <p className="muted">Saved before account sync. They stay on this device until you import them; importing copies only filters, sort and columns.</p>
        <ul className="lvc-views">{legacyViews.map(v => { const done = accountNames.has(v.name.trim().toLowerCase()); return <li key={`legacy-${v.id}`}>
          <button type="button" className="lvc-view-apply" onClick={() => { onApply(v); setOpen(false); }} data-testid={`button-apply-legacy-view-${v.id}`}><strong>{v.name}</strong><small>{Object.keys(v.filters).length} filter settings · this device</small></button>
          <button type="button" className="button secondary small" disabled={done || importing === v.id} onClick={async () => { setImporting(v.id); const ok = await onImport(v); setImporting(null); setImportMsg(ok ? `View "${v.name}" imported to your account.` : `View "${v.name}" could not be imported.`); }} data-testid={`button-import-view-${v.id}`}>{done ? "Imported" : importing === v.id ? "Importing…" : "Import to Account"}</button>
        </li>; })}</ul>
        <small role="status" aria-live="polite">{importMsg}</small>
      </section>}
      <form className="lvc-save" onSubmit={async e => { e.preventDefault(); if (!name.trim()) { setError("Enter a view name."); return; } setPending(true); const ok = await onSave({ name, share: canShare && share }); setPending(false); if (!ok) { setError("The view could not be saved. Check your connection and try again."); return; } const label = name.trim(); setName(""); setShare(false); setError(""); setSaved(`View "${label}" saved.`); }}>
        <label htmlFor={inputId}>Save current filters and columns as</label>
        <small className="muted" id={`${inputId}-hint`}>Use a descriptive name such as a status or date range. Do not enter patient names or other patient details.</small>
        <input id={inputId} aria-describedby={`${inputId}-hint`} maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Inactive this month" disabled={!canSave} data-testid="input-view-name" />
        {!canSave && <small className="muted">Apply a filter or sort, or change the column layout, to save a view.</small>}
        {error && <small role="alert" className="field-error">{error}</small>}
        <small role="status" aria-live="polite">{saved}</small>
        {canShare && <label className="lvc-share"><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} disabled={!canSave} data-testid="checkbox-share-view" /> Share with staff in my clinics (super admins: with super admins)</label>}
        <button type="submit" className="button small" disabled={!canSave || pending} data-testid="button-save-view">{pending ? "Saving…" : "Save View"}</button>
      </form>
    </AppDialog>
  </>;
}
