/* Read-only source audit. Writes only the requested export, never application files. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const postcss = require("../node_modules/.pnpm/postcss@8.5.28/node_modules/postcss");
const root = "artifacts/clinicflow/src";
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
const files = walk(root).filter(p => /\.(tsx?|css)$/.test(p) && !/\.(test|spec)\./.test(p));
const source = new Map(files.map(p=>[p,fs.readFileSync(p,"utf8")]));
const configPath = "artifacts/clinicflow/tsconfig.json";
const cfg = ts.readConfigFile(configPath,ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(cfg,ts.sys,path.dirname(configPath));
const program = ts.createProgram(parsed.fileNames,parsed.options);
const checker = program.getTypeChecker();
const sfs = files.filter(p=>/\.tsx?$/.test(p)).map(p=>program.getSourceFile(path.resolve(p)) || ts.createSourceFile(p,source.get(p),ts.ScriptTarget.Latest,true,p.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS));
const rel = p=>path.relative(process.cwd(),p).replaceAll("\\","/");
const loc = n=>({file:rel(n.getSourceFile().fileName),line:n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line+1});
const text = n=>n?.getText() || null;
const visit = (n,fn)=>{fn(n);ts.forEachChild(n,c=>visit(c,fn));};
const uniq = a=>[...new Set(a)];
const cssFiles = files.filter(p=>p.endsWith(".css"));
const rules=[], atRules=[];
function parseCss(file,content,compiled=false){
  const tree=postcss.parse(content,{from:file});
  tree.walkRules(r=>{
    const context=[]; for(let p=r.parent;p&&p.type!=="root";p=p.parent)context.unshift(p.type==="atrule"?`@${p.name} ${p.params}`:p.selector);
    const declarations=(r.nodes||[]).filter(n=>n.type==="decl").map(d=>({property:d.prop,value:d.value,important:!!d.important}));
    rules.push({id:`${compiled?"built":"source"}-${rules.length+1}`,file,line:r.source.start.line,selector:r.selector,context,compiled,declarations});
  });
  tree.walkAtRules(r=>{atRules.push({file,line:r.source.start.line,name:r.name,parameters:r.params,compiled,declarations:(r.nodes||[]).filter(n=>n.type==="decl").map(d=>({property:d.prop,value:d.value,important:!!d.important}))});});
}
cssFiles.forEach(p=>parseCss(p,source.get(p)));
const buildCss=walk("/tmp/digiq-design-export-build").filter(p=>p.endsWith(".css"));
buildCss.forEach(p=>parseCss("compiled-production.css",fs.readFileSync(p,"utf8"),true));
const authored=rules.filter(r=>!r.compiled);
const built=rules.filter(r=>r.compiled);
const declarations = (list,pattern)=>list.flatMap(r=>r.declarations.filter(d=>pattern.test(d.property)).map(d=>({rule:r.id,...d})));
const ruleRefs = (selector,prop)=>authored.filter(r=>selector.test(r.selector)&&(!prop||r.declarations.some(d=>prop.test(d.property)))).map(r=>r.id);
const allVariables=rules.flatMap(r=>r.declarations.filter(d=>d.property.startsWith("--")).map(d=>({rule:r.id,selector:r.selector,context:r.context,...d})));
const rootTokens={};
for(const r of authored.filter(r=>r.selector===":root"))for(const d of r.declarations)if(d.property.startsWith("--"))rootTokens[d.property]=d.value;
const refs = pattern=>allVariables.filter(d=>pattern.test(d.property));
function family(pattern,componentNames=[]){
 const rr=authored.filter(r=>pattern.test(r.selector));
 return {components:componentNames,ruleRefs:rr.map(r=>r.id),declarations:rr.map(r=>({rule:r.id,selector:r.selector,context:r.context,values:r.declarations})),
  states:{hover:rr.filter(r=>/:hover|hover/.test(r.selector)).map(r=>r.id),active:rr.filter(r=>/:active|\.active|aria-current|data-state/.test(r.selector)).map(r=>r.id),focus:rr.filter(r=>/:focus/.test(r.selector)).map(r=>r.id),disabled:rr.filter(r=>/:disabled|disabled/.test(r.selector)).map(r=>r.id)},
  valueInterpretation:"Exact authored declarations with selector and conditional context; combine with global element rules, inherited tokens, utility classes, and the compiled stylesheet cascade. An absent declaration is not a fabricated default."};
}
const definitions=[], uses=[], inlineStyles=[], variantDefinitions=[], typeContracts=[], configDefinitions=[], imports=[];
for(const sf of sfs){
 visit(sf,n=>{
  if(ts.isImportDeclaration(n))imports.push({...loc(n),module:text(n.moduleSpecifier),clause:text(n.importClause)});
  if(ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n))typeContracts.push({...loc(n),name:n.name.text,definition:n.getText()});
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
   const attrs=n.attributes.properties.map(a=>({name:ts.isJsxSpreadAttribute(a)?"...":a.name.getText(),expression:ts.isJsxSpreadAttribute(a)?a.expression.getText():text(a.initializer)}));
   uses.push({...loc(n),tag:n.tagName.getText(),attributes:attrs});
   for(const a of attrs.filter(a=>a.name==="style"))inlineStyles.push({...loc(n),tag:n.tagName.getText(),expression:a.expression});
  }
  if(ts.isVariableDeclaration(n)&&n.initializer){
   if(/cva\s*\(/.test(n.initializer.getText()))variantDefinitions.push({...loc(n),name:n.name.getText(),definition:n.initializer.getText()});
   if(/^(resources|routes|layout|icons|EDITOR_GROUPS|STATUS|status|.*Fields|fieldGroups|.*Columns|.*Steps|.*Tabs)$/.test(n.name.getText()))configDefinitions.push({...loc(n),name:n.name.getText(),definition:n.initializer.getText()});
  }
  let name,body;
  if((ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n))&&n.name){name=n.name.text;body=n;}
  if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer){name=n.name.text;body=n.initializer;}
  if(!name||!/^[A-Z][a-zA-Z0-9]*$/.test(name)||/^[A-Z_]+$/.test(name))return;
  const b=body.getText();
  const isUi=/\.tsx$/.test(sf.fileName)&&(/<[\w>]|forwardRef|memo\(|Primitive\.[A-Z]|\.Provider/.test(b));
  if(!isUi)return;
  const symbol=checker.getSymbolAtLocation(n.name);
  let signature, props=[];
  try{
   const t=checker.getTypeAtLocation(n.name);
   signature=t.getCallSignatures()[0] || t.getConstructSignatures()[0];
   if(signature?.parameters[0]){
    const param=signature.parameters[0];
    const pt=checker.getTypeOfSymbolAtLocation(param,n);
    props=checker.getPropertiesOfType(pt).map(p=>({name:p.name,optional:!!(p.flags&ts.SymbolFlags.Optional),type:checker.typeToString(checker.getTypeOfSymbolAtLocation(p,n),n,ts.TypeFormatFlags.NoTruncation),declaration:p.declarations?.filter(d=>!d.getSourceFile().fileName.includes("node_modules")).map(d=>({ ...loc(d),text:d.getText()}))||[]}));
   }
  }catch{}
  const nested=[],elements=[];
  visit(body,c=>{if(ts.isJsxOpeningElement(c)||ts.isJsxSelfClosingElement(c)){const tag=c.tagName.getText();(/^[A-Z]/.test(tag)?nested:elements).push(tag);}});
  const parameters=ts.isFunctionDeclaration(n)?n.parameters.map(text):[];
  const classBindings=[];visit(body,c=>{if(ts.isJsxAttribute(c)&&c.name.getText()==="className")classBindings.push({...loc(c),expression:text(c.initializer)});});
  definitions.push({id:`${rel(sf.fileName)}#${name}`,name,...loc(n),exported:!!symbol&&(!!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)||!!sf.symbol?.exports?.has(name)),kind:ts.isClassDeclaration(n)?"class":ts.isFunctionDeclaration(n)?"function":"variable/wrapper/primitive-alias",parameters,props,propsType:signature?.parameters[0]?checker.typeToString(checker.getTypeOfSymbolAtLocation(signature.parameters[0],n),n,ts.TypeFormatFlags.NoTruncation):null,definition:b,children:uniq(nested),htmlElements:uniq(elements),classBindings});
 });
}
const byName=new Map();
for(const d of definitions){if(!byName.has(d.name))byName.set(d.name,[]);byName.get(d.name).push(d);}
for(const d of definitions){
 d.usageLocations=uses.filter(u=>u.tag===d.name).map(u=>({...u,resolution:"JSX tag-name match; module imports are supplied for disambiguation"}));
 d.inventoryScope=d.file.includes("/components/")?"reusable-component":"screen-or-local-component";
 d.propsResolution=d.propsType==="any"?"untyped in source; parameter and definition preserve its contract":d.propsType?"TypeScript checker resolved first-level props; referenced data types retained by name":"No callable props signature resolved; see exact primitive alias or definition";
}
function expand(names,seen=new Set()){
 for(const name of names){for(const d of byName.get(name)||[]){if(seen.has(d.id))continue;seen.add(d.id);expand(d.children,seen);}}
 return [...seen];
}
function screen(pathname,components,purpose,extra={}){
 const ids=expand(components), ds=definitions.filter(d=>ids.includes(d.id));
 return {path:pathname,purpose,entryComponents:components,majorComponents:uniq(ds.flatMap(d=>[d.name,...d.children])),componentRefs:ids,
 tables:ds.filter(d=>d.htmlElements.includes("table")||/Table|Rows|ResourcePage/.test(d.name)).map(d=>({component:d.id,elements:d.htmlElements.filter(t=>/^(table|thead|tbody|tr|th|td)$/.test(t)),sourceLine:d.line})),
 forms:ds.filter(d=>d.htmlElements.some(t=>["form","input","select","textarea"].includes(t))||/Form|Editor|Booking/.test(d.name)).map(d=>({component:d.id,controls:d.htmlElements.filter(t=>["form","input","select","textarea","button"].includes(t))})),
 modals:ds.filter(d=>d.children.some(c=>/Dialog|Modal|Drawer|Sheet|Popover/.test(c))||/Dialog|Modal|Drawer|Sheet/.test(d.name)).map(d=>({component:d.id,overlays:d.children.filter(c=>/Dialog|Modal|Drawer|Sheet|Popover/.test(c))})),
 mappingMethod:"Static JSX dependency traversal; conditional descendants are possibilities, not all simultaneously visible. Dynamic resource fields are supplied under resourceDefinitions.",...extra};
}
const app=source.get(`${root}/App.tsx`);
const roleRoutes=JSON.parse(app.match(/const routes: Record<string,string\[\]> = (\{[\s\S]*?\n\});/)[1].replace(/(\w+):/g,'"$1":').replace(/,\s*}/g,"}"));
const dispatch={dashboard:["Dashboard"],clinics:["ResourcePage"],branches:["ResourcePage"],users:["Users"],patients:["ResourcePage"],masters:["ResourcePage"],appointments:["Appointments"],queue:["Queue"],reports:["Reports"],settings:["WorkspaceSettings"],audit:["ResourcePage"],qrs:["ResourcePage"],book:["Booking"],availability:["SchedulingWorkspace"],exceptions:["SchedulingWorkspace"],profile:["Profile"],demo:["DemoClinicManagement"],templates:["EmailTemplates"],permissions:["AccessRules","CustomRoles"],integrations:["IntegrationSettings"],"system-users":["SystemUsers"]};
const purposes={dashboard:"Overview of operational metrics, appointments and activity",clinics:"Manage clinic groups or view assigned doctor clinics",branches:"Manage clinic locations",users:"Manage staff and doctor assignments",patients:"Manage patient records",masters:"Manage reference/master data",appointments:"Search, filter, inspect and export appointments; open tickets",queue:"Operate a session queue; patient role follows booking status",reports:"Review and export operational reports",settings:"Clinic workspace and platform preferences",audit:"Inspect audit events",qrs:"Manage booking QR codes",book:"Book an appointment",availability:"Manage weekly session schedules",exceptions:"Manage date-specific schedule exceptions",profile:"Manage personal and professional profile",demo:"Manage fictional demonstration clinic",templates:"Manage email templates",permissions:"Manage access rules and custom roles",integrations:"Configure integrations and media storage","system-users":"Manage system users"};
const screens=[];
for(const [role,pages] of Object.entries(roleRoutes)){
 screens.push(screen(`/${role}`,[],"Authenticated role-root redirect",{redirect:`/${role}/dashboard`}));
 for(const page of pages)screens.push(screen(`/${role}/${page}`,role==="doctor"&&page==="clinics"?["DoctorClinics"]:dispatch[page],purposes[page],{role,page,resource:dispatch[page].includes("ResourcePage")?page:null,accessRulesSource:definitions.find(d=>d.name==="Guard")?.id}));
}
const publicRoutes=[];
for(const sf of sfs.filter(s=>s.fileName.endsWith("/App.tsx")))visit(sf,n=>{
 if(!(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)))return;
 const opening=ts.isJsxElement(n)?n.openingElement:n;
 if(opening.tagName.getText()!=="Route")return;
 const pa=opening.attributes.properties.find(a=>a.name?.getText()==="path");
 if(pa&&!ts.isStringLiteral(pa.initializer))return;
 const route=pa?.initializer.text||"*";
 const ca=opening.attributes.properties.find(a=>a.name?.getText()==="component");
 const names=[];
 if(ca&&ts.isJsxExpression(ca.initializer))names.push(ca.initializer.expression.getText());
 if(ts.isJsxElement(n))visit(n,c=>{if((ts.isJsxOpeningElement(c)||ts.isJsxSelfClosingElement(c))&&!["Route","Redirect","Link","AuthAccess"].includes(c.tagName.getText())&&/^[A-Z]/.test(c.tagName.getText()))names.push(c.tagName.getText());});
 publicRoutes.push(screen(route,uniq(names),route==="*"?"Not-found fallback":`Public/authentication/redirect route: ${uniq(names).join(", ")||route}`,{routeDeclaration:n.getText()}));
});
screens.push(...publicRoutes);
const typographyRoles={
 pageTitle:/h1|lh-page-title/,sectionTitle:/h2|section-head|section-heading/,cardTitle:/h3|stat-card|card-title/,
 tableHeader:/\bth\b|thead/,tableCell:/\btd\b|tbody/,buttonText:/button|filter-toggle|filter-done/,formLabel:/label/,
 inputText:/input|select|textarea|searchable-select/,helperText:/small|helper|help-text|field-hint/,tooltipText:/help-tip|tooltip/,
 modalTitle:/dialog-title|modal.*h[123]/,modalBody:/dialog-body|modal-body/,statusBadgeText:/badge|status-pill/
};
const typography={tokens:refs(/font|type-/),styles:Object.fromEntries(Object.entries(typographyRoles).map(([name,re])=>[name,{
 name,fontFamily:declarations(authored.filter(r=>re.test(r.selector)),/^font-family$/),fontSize:declarations(authored.filter(r=>re.test(r.selector)),/^font-size$/),fontWeight:declarations(authored.filter(r=>re.test(r.selector)),/^font-weight$/),lineHeight:declarations(authored.filter(r=>re.test(r.selector)),/^line-height$/),letterSpacing:declarations(authored.filter(r=>re.test(r.selector)),/^letter-spacing$/),ruleRefs:ruleRefs(re),inheritanceRuleRefs:ruleRefs(/^body$|^h1,|^h1$|^h2$|^h3$|^\*$/)
}]))};
const valuesOf=pattern=>uniq(declarations(authored,pattern).map(d=>d.value));
const buttonNames={primary:/\.button(?!\.[\w-])|lh-actions|page-heading/,secondary:/button\.secondary|button\.light/,tertiary:/text-link/,ghost:/ghost/,danger:/danger|destructive/,iconButton:/icon-button|sidebar-toggle|sidebar-close|dialog-close|help-tip|clear-selection/};
const formNames={input:/\binput\b/,textarea:/textarea/,select:/select|select-trigger/,searchField:/workspace-search|live-search|search-input/,datePicker:/\binput\b|date-input|date-format|calendar|date-picker/,timePicker:/\binput\b|time-input|time-picker|time-select|hours-range/,checkbox:/checkbox/,radio:/radio/,toggle:/switch|toggle/,multiSelect:/multi-select|multiselect|select\[multiple\]/};
const data={
 metadata:{name:"DigiQ current application UI design system export",formatVersion:"1.0",generatedAt:new Date().toISOString(),sourceRoot:root,scope:"Complete source-backed UI audit of the current ClinicFlow/DigiQ frontend, including workspace, public/authentication, patient and reusable primitive surfaces. No application changes.",
 method:"TypeScript AST and type-checker extraction; PostCSS parsing of every authored stylesheet and a fresh production build. All 15 requested sections are provided, with exact source declarations, responsive/state contexts, reusable component definitions, props and usage locations.",
 limitations:["This is a static source export, not a redesign or a computed-style assertion for every runtime DOM state.","Different selectors/layers/breakpoints can assign different values. Rule references deliberately preserve those differences. Source-file enumeration order is NOT cascade order; compiledProductionRuleOrder and the complete built stylesheet preserve build order.","Values not explicitly declared are inherited, browser-native, or content-dependent; they are not invented.","Component dependency traversal includes conditional branches. Tag-name collisions can be resolved using supplied import declarations and exact component source.","Typed props keep referenced data types by name; local type declarations are supplied. Native HTML props are resolved where TypeScript provides a signature.","Dynamic class expressions, CVA variants, runtime inline styles and resource definitions are preserved verbatim so their conditions and values are not discarded."]},
 brandTokens:{
  rootTokens,
  primaryColors:refs(/primary|dq-blue|teal/),secondaryColors:refs(/secondary/),accentColors:refs(/accent|cyan|ring/),
  successColors:family(/success|completed|active|available/),warningColors:family(/warning|waiting|pending|notice/),errorColors:family(/error|danger|destructive|cancelled/),
  neutralPalette:refs(/muted|soft|ink|navy|foreground|background|surface|border|input/),
  backgroundColors:declarations(authored,/^background/),borderColors:declarations(authored,/^border/),textColors:declarations(authored,/^color$/),
  hoverColors:declarations(authored.filter(r=>/:hover|hover/.test(r.selector)),/color|background|border/),
  activeColors:declarations(authored.filter(r=>/:active|\.active|aria-current|data-state/.test(r.selector)),/color|background|border/),
  disabledColors:declarations(authored.filter(r=>/:disabled|disabled/.test(r.selector)),/color|background|border|opacity/),
  allColorLiterals:uniq(authored.flatMap(r=>r.declarations.flatMap(d=>d.value.match(/#[\da-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|color-mix)\([^;]*?\)/g)||[])))
 },
 typographySystem:typography,
 spacingSystem:{baseSpacingUnit:rootTokens["--space-1"],tokens:refs(/space-|spacing/),marginScale:valuesOf(/^margin/),paddingScale:valuesOf(/^padding/),gapScale:valuesOf(/gap$/),contextualDeclarations:declarations(authored,/^(margin|padding)|gap$/)},
 borderRadiusSystem:{tokens:refs(/radius/),allValues:valuesOf(/radius$/),contextualDeclarations:declarations(authored,/radius$/),unitPolicy:"Exact authored units retained. rem is not converted to pixels without a root-font context."},
 shadows:{tokens:refs(/shadow/),allValues:valuesOf(/shadow$/),levels:{card:family(/card|panel/),dropdown:family(/dropdown|popover|searchable-select-popup/),modal:family(/dialog|modal/),tooltip:family(/tooltip|help-tip/)},contextualDeclarations:declarations(authored,/shadow$/)},
 layoutSystem:{sidebarWidth:rootTokens["--sidebar-width"],collapsedSidebarWidth:rootTokens["--sidebar-width-collapsed"],contentMaxWidth:rootTokens["--workspace-width"],headerHeight:declarations(authored.filter(r=>/topbar|public-header|workspace-header/.test(r.selector)),/height/),containerSpacing:family(/content|workspace-main|workspace\{|container/),tableSpacing:family(/table|tbody|thead|\btd\b|\bth\b/),cardSpacing:family(/card|panel/),breakpoints:uniq(atRules.filter(r=>r.name==="media").map(r=>r.parameters)),allLayoutDeclarations:declarations(authored,/width|height|display|grid|flex|align|justify|position|inset|overflow/)},
 buttonSystem:{variants:Object.fromEntries(Object.entries(buttonNames).map(([n,re])=>[n,family(re,["Button"])])),primitiveCvaDefinitions:variantDefinitions.filter(v=>/button/i.test(v.name)),globalBase:family(/^button|^\.button|,button/),tertiaryVariantNote:"No CVA variant named tertiary; text-link and Button variant=link are existing text-action treatments, not a newly invented variant.",sizingProperties:["height","min-height","padding","border-radius","font-family","font-size","font-weight","line-height"],stateResolution:"Use the state rule references plus CVA classes and compiled utility definitions; an undeclared state inherits its applicable base styling."},
 formComponents:Object.fromEntries(Object.entries(formNames).map(([n,re])=>[n,family(re,definitions.filter(d=>re.test(d.name.toLowerCase())).map(d=>d.name))])),
 tableSystem:{allStyles:family(/table|thead|tbody|\btr\b|\btd\b|\bth\b/),rowHeight:declarations(authored.filter(r=>/\btr\b|\btd\b/.test(r.selector)),/height|padding|line-height/),headerHeight:declarations(authored.filter(r=>/\bth\b|thead/.test(r.selector)),/height|padding|line-height/),pagination:family(/pagination|page-size/),hoverBehavior:family(/tr:hover|tbody.*hover|table.*hover/),selectedRowBehavior:family(/row-selected|selected-row|aria-selected|data-state.*selected/),statusBadges:family(/badge|status-pill/),actionColumn:family(/row-actions|table-actions|action-cell|action-column|td:last-child/),tableMarkup:uses.filter(u=>["table","thead","tbody","tr","td","th"].includes(u.tag)),heightPolicy:"Where no fixed height is declared, row/header height is content-dependent, including padding, line-height, wrapping and responsive rules."},
 modalSystem:{sharedDialog:family(/app-dialog/ ,["AppDialog"]),primitiveDialog:family(/dialog|sheet|drawer/),widthVariants:declarations(authored.filter(r=>/dialog|modal|drawer|sheet/.test(r.selector)),/width/),headerStyle:family(/dialog-header|dialog-title|modal-header/),footerStyle:family(/dialog-footer|form-footer|modal-footer/),closeButtonStyle:family(/dialog-close|modal-close/),scrollBehavior:declarations(authored.filter(r=>/dialog|modal|drawer|sheet/.test(r.selector)),/overflow|height|overscroll/),mobileBehavior:authored.filter(r=>/dialog|modal|drawer|sheet/.test(r.selector)&&r.context.some(c=>c.startsWith("@media"))).map(r=>r.id),instanceConfigurations:uses.filter(u=>/Dialog|Modal|Drawer|Sheet/.test(u.tag))},
 badgeSystem:Object.fromEntries(["waiting","called","active","completed","cancelled","absent","error"].map(n=>[n,{status:n,...family(new RegExp(`badge|status-pill|\\.${n}\\b`)),statusSpecificRuleRefs:ruleRefs(new RegExp(`\\.${n}\\b|${n}["'\\]]`)),resolution:"Generic badge rules apply together with matching status classes; an empty specific rule list means no separately named authored rule was found, not an invented color."}])),
 navigationSystem:{sidebar:family(/sidebar/),expandedState:family(/sidebar|wnav/),collapsedState:family(/sidebar-collapsed|wnav-group.flat/),activeItem:family(/wnav.*active|wnav.*aria-current|sidebar.*active/),hoverItem:family(/wnav.*hover|sidebar.*hover/),nestedMenuItem:family(/wnav-children|wnav.*child|wnav-parent/),configuration:configDefinitions.filter(d=>d.file.endsWith("WorkspaceNav.tsx")),componentRefs:definitions.filter(d=>d.name==="WorkspaceNav").map(d=>d.id)},
 cardComponents:{dashboardCard:family(/dashboard|panel/),statisticsCard:family(/stat-card/),infoCard:family(/info-card|notice|info-panel/),queueCard:family(/queue-card|queue-patient|sq-card|queue-row/),patientCard:family(/patient-card|patient-summary|appt-detail-summary/),allCardRules:family(/card|panel|notice/),availabilityPolicy:"Named categories are selector groupings, not claims that a dedicated component of each name exists. Component inventory and exact JSX identify actual implementations."},
 existingScreens:screens,
 componentInventory:definitions,
 evidence:{
  sourceFiles:files.map(p=>({file:p,bytes:Buffer.byteLength(source.get(p)),sha256:crypto.createHash("sha256").update(source.get(p)).digest("hex")})),
  cssRules:rules,cssAtRules:atRules,allCustomPropertyDeclarations:allVariables,
  compiledProductionRuleOrder:built.map(r=>r.id),
  compiledProductionStylesheet:buildCss.map(p=>fs.readFileSync(p,"utf8")).join("\n"),
  stylesheets:cssFiles.map(p=>({file:p,content:source.get(p)})),
  inlineStyles,variantDefinitions,typeContracts,importDeclarations:imports,
  allJsxInstances:uses,
  resourceDefinitions:configDefinitions,
  screenDispatchSource:source.get(`${root}/clinic.tsx`).split("\n").filter(l=>l.includes('page==="templates"?')).join("\n"),
  authenticationAndRoutingSource:app,
  nativeElementPolicy:"Native date/time/select/radio rendering can depend on the browser and OS. Exact custom rules, attributes, type contracts and utility classes are retained; no cross-browser visual equivalence is claimed."
 }
};
const formMapping={input:["Input"],textarea:["Textarea"],select:["SearchableSelect","Select"],searchField:["SearchInput"],datePicker:["DateFormatInput","FormattedInput","Calendar"],timePicker:["TimeFormatInput","FormattedInput","TimeRangeSlider"],checkbox:["Checkbox"],radio:["RadioGroup","RadioGroupItem"],toggle:["Switch","Toggle","StatusSwitch"],multiSelect:["SearchableMultiSelect"]};
for(const [key,names] of Object.entries(formMapping)){
 data.formComponents[key].components=names.filter(n=>byName.has(n));
 data.formComponents[key].componentRefs=expand(data.formComponents[key].components);
 data.formComponents[key].variantDefinitions=variantDefinitions.filter(v=>new RegExp(key==="toggle"?"toggle":key,"i").test(v.name));
}
data.formComponents.datePicker.implementation="DateFormatInput uses a formatted text input, not a native date popup. The UI Calendar primitive also exists independently; its inventory usage locations indicate whether it is used.";
data.formComponents.timePicker.implementation="TimeFormatInput uses a formatted text input; TimeRangeSlider provides registration-hours controls. General input styling is inherited, with caller classes preserved.";
data.badgeSystem.absent.sourceStatus="noShow";
data.badgeSystem.absent.displayLabel="Absent";
data.badgeSystem.absent.statusSpecificRuleRefs=ruleRefs(/\.badge\.noShow/);
data.badgeSystem.absent.declarations=family(/badge|status-pill|\.noShow\b/).declarations;
data.badgeSystem.called.sourceStatus="called";
data.badgeSystem.called.displayLabel="Called next";
data.badgeSystem.error.statusSpecificRuleRefs=ruleRefs(/\.badge\.error|\.badge\.destructive/);
data.badgeSystem.error.note="Error is also represented by ErrorNotice/ErrorState and error-box, not necessarily a dedicated appointment status.";
data.metadata.counts={sourceFiles:files.length,authoredStylesheets:cssFiles.length,authoredCssRules:authored.length,compiledCssRules:built.length,componentDefinitions:definitions.length,reusableComponentDefinitions:definitions.filter(d=>d.inventoryScope==="reusable-component").length,routes:screens.length,jsxInstances:uses.length};
fs.writeFileSync("exports/digiq-ui-design-system.json",JSON.stringify(data,null,2)+"\n");
console.log(JSON.stringify(data.metadata.counts));
