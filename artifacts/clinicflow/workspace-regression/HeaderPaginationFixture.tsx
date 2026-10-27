import { useMemo, useState } from "react";
import { FilterBar, ListingRegion, ListPageTitleContext, Pagination, SearchInput } from "../src/components/ListingControls";
import { PageHeader } from "../src/components/PageHeader";
import { WorkspaceTabs } from "../src/components/WorkspaceTabs";

/** Fictional records only; uses production shell ancestry, title delegation,
 * header, selectors, tabs and list geometry. Never calls the backend. */
export function HeaderPaginationFixture() {
  const [count, setCount] = useState(2), [page, setPage] = useState(1), [size, setSize] = useState(20);
  const [state, setState] = useState<"ready"|"loading"|"error">("ready");
  const [search, setSearch] = useState(""), [expanded, setExpanded] = useState(false);
  const [area, setArea] = useState("records"), [active, setActive] = useState(false);
  const [draft, setDraft] = useState(false);
  const owner = useMemo(() => ({current:null as string|null}), [area]);
  const total = active || search ? Math.min(count,2) : count;
  const n = Math.min(size, Math.max(0,total-(page-1)*size));
  return <div className="workspace sidebar-collapsed">
    <aside className="sidebar" aria-label="Fixture navigation"/>
    <div className="workspace-main"><header className="topbar">DigiQ · Header acceptance</header><main className="content">
      <div className="fixture-scenarios" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {[0,2,20,22].map(value=><button key={value} onClick={()=>{setCount(value);setPage(1);}}>{value} results</button>)}
        {(["ready","loading","error"] as const).map(value=><button key={value} onClick={()=>setState(value)}>{value}</button>)}
      </div>
      <WorkspaceTabs label="Fixture sections" area={area} onSelect={setArea} tabs={[{id:"records",label:"Records",icon:"patients"},{id:"nested",label:"Nested panel",icon:"clinics"},{id:"form",label:"Form",icon:"personal"}]}/>
      <ListPageTitleContext.Provider value={{title:"Appointments",owner}}>
        {area==="form"?<PageHeader title="Account details" actions={<button className="button">Save changes</button>}/>:<>
          <FilterBar secondary={<button className="button secondary" data-testid="fixture-export">Export CSV</button>}
            actions={<button className="button" data-testid="fixture-add">Book Appointment</button>}
            active={active} onReset={()=>{setActive(false);setSearch("");setPage(1);}}
            onOpen={()=>setDraft(active)} onApply={()=>{setActive(draft);setPage(1);}}
            advanced={<label><input type="checkbox" checked={draft} onChange={e=>setDraft(e.target.checked)}/> Only matching records</label>}
            chips={active?[{key:"adv:matching",label:"Matching records",onRemove:()=>setActive(false)}]:[]}>
            <SearchInput value={search} onChange={value=>{setSearch(value);setPage(1);}} placeholder="Search appointments…" />
          </FilterBar>
          {area==="nested"&&<div className="panel padded"><PageHeader level={2} title="Clinic context"/><p>Nested lists keep their own footer.</p></div>}
          <ListingRegion className="panel table-panel">
            {state==="loading"?<p role="status">Loading appointments…</p>:state==="error"?<p role="alert">Results could not be loaded.</p>:n?<div className="table-scroll"><table><thead><tr><th>Patient</th><th>Actions</th></tr></thead><tbody>
              {Array.from({length:n},(_,i)=><tr key={i}><td>Fictional Patient {(page-1)*size+i+1}</td><td><button onClick={()=>setExpanded(!expanded)}>Details {i+1}</button></td></tr>)}
              {expanded&&<tr><td colSpan={2}><div data-testid="fixture-expanded" style={{minHeight:720}}>Expanded appointment details and form controls <input aria-label="Expanded notes"/></div></td></tr>}
            </tbody></table></div>:<div className="empty">No matching appointments.</div>}
            <Pagination state={state} total={total} page={page} pageSize={size} onPageChange={setPage} onPageSizeChange={setSize}/>
          </ListingRegion>
        </>}
      </ListPageTitleContext.Provider>
    </main></div>
  </div>;
}
