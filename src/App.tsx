import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import './FormalTheme.css'
import AppLauncher from './features/platform/WorkspaceLanding'
import NotificationCenter from './features/notifications/NotificationCenter'
import Icon, { type IconName } from './components/Icon'
import { canOpen, roleById, roles, type ModuleName, type RoleId } from './lib/accessControl'
import type { CentralAccessAssignment } from './lib/centralAccess'
import { applicationIsAvailable, defaultApplicationAvailability, type GlasscoApplicationId } from './lib/applicationAccess'
import { useLocalStore } from './lib/localStore'
import ConsumableRequests from './features/requests/ConsumableRequests'
import FacilitiesSupport from './features/facilities/FacilitiesSupport'
import FlowWorkspace from './features/flow/FlowWorkspace'
import TeamsWorkspace from './features/teams/TeamsWorkspace'

const SharedMasters = lazy(() => import('./features/masters/SharedMasters'))
const InventoryWorkspace = lazy(() => import('./features/inventory/InventoryWorkspace'))
const AllocationCustody = lazy(() => import('./features/custody/AllocationCustody'))
const MaintenanceWorkspace = lazy(() => import('./features/maintenance/MaintenanceWorkspace'))
const AssuranceWorkspace = lazy(() => import('./features/assurance/AssuranceWorkspace'))
const ReportsWorkspace = lazy(() => import('./features/reports/ReportsWorkspace'))
const CommandDashboard = lazy(() => import('./features/dashboard/CommandDashboard'))
const RetirementWorkspace = lazy(() => import('./features/retirement/RetirementWorkspace'))
const AccessGovernance = lazy(() => import('./features/access/AccessGovernanceV2'))
const OperationsCentre = lazy(() => import('./features/operations/OperationsCentre'))
const SupportDesk = lazy(() => import('./features/support/SupportDesk'))

const WorkspaceLoading = () => <div className="workspace-loading" role="status" aria-live="polite"><span/><strong>Loading workspace</strong></div>

const navItems:ModuleName[] = ['Dashboard','Operations Centre', 'Shared Masters', 'Asset Inventory', 'Allocation & Custody', 'Maintenance & Inspection', 'Assurance & Controls', 'Asset Retirement & Circularity', 'Reports & Analytics','Access & Roles']
const iconByModule:Record<ModuleName,IconName> = {Dashboard:'dashboard','Operations Centre':'support','Shared Masters':'masters','Asset Inventory':'inventory','Allocation & Custody':'allocation','Maintenance & Inspection':'maintenance','Assurance & Controls':'assurance','Asset Retirement & Circularity':'history','Reports & Analytics':'reports','Access & Roles':'assurance'}
const rolePriority:Record<RoleId,number>={administrator:0,'asset-manager':1,'it-head':2,auditor:3,'department-manager':4,'standard-user':5}
const applicationIds=['itms','support','requests','facilities','flow','teams'] as const
type WorkspaceLocation={application:string;section?:ModuleName}

function readWorkspaceLocation(identityEmail:string):WorkspaceLocation|null{
  try{
    const value=JSON.parse(localStorage.getItem(`glassco.workspace.last-location.${identityEmail.trim().toLowerCase()}.v1`)??'null') as WorkspaceLocation|null
    return value&&applicationIds.includes(value.application as typeof applicationIds[number])?value:null
  }catch{return null}
}

function App({identityEmail,logout,access}:{identityEmail:string;logout:(()=>Promise<void>)|null;access:CentralAccessAssignment}) {
  const requestedApp=new URLSearchParams(window.location.search).get('app')
  const requestedAsset=new URLSearchParams(window.location.search).get('asset')
  const savedLocation=readWorkspaceLocation(identityEmail)
  const initialApplication=requestedAsset?'itms':requestedApp&&applicationIds.includes(requestedApp as typeof applicationIds[number])?requestedApp:new URLSearchParams(window.location.search).has('supportRating')?'support':savedLocation?.application??null
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('glassco.workspace.sidebar-collapsed.v1') === 'true')
  const [section, setSection] = useState<ModuleName>(requestedAsset ? 'Asset Inventory' : savedLocation?.section&&navItems.includes(savedLocation.section)?savedLocation.section:'Dashboard')
  const [activeApp, setActiveApp] = useState<string | null>(initialApplication)
  const [applicationAvailability]=useLocalStore('connect.application-availability.v1',defaultApplicationAvailability)
  const assignedRoles=([...(access.roleIds?.length?access.roleIds:[access.roleId])] as RoleId[]).sort((left,right)=>rolePriority[left]-rolePriority[right])
  const [activeRole,setActiveRole]=useState<RoleId>(assignedRoles[0])
  const permittedItems=navItems.filter(item=>canOpen(activeRole,item))
  // Missing appIds means the assignment predates app-level governance; preserve its
  // previous effective access until an administrator explicitly saves an app list.
  // Initial named acceptance access for Flow. Wider access remains controlled through the central assignment register.
  const acceptanceEmail=identityEmail.trim().toLowerCase()
  const flowAcceptanceTester=['rajneesh@glasscolabs.com','dev@glasscolabs.com'].includes(acceptanceEmail)
  const flowAssigned=access.appIds?.includes('flow')===true
  const authorizedAppIds:GlasscoApplicationId[]=[...new Set([...(access.appIds??[...(permittedItems.length?['itms' as const]:[]),'support']),...((flowAcceptanceTester||flowAssigned)?['flow' as const,'teams' as const]:[])])]
  const availableAuthorizedAppIds=authorizedAppIds.filter(appId=>applicationIsAvailable(appId,identityEmail,applicationAvailability))
  const activeApplicationAuthorized=!activeApp||availableAuthorizedAppIds.includes(activeApp as GlasscoApplicationId)
  useEffect(()=>{
    const key=`glassco.workspace.last-location.${identityEmail.trim().toLowerCase()}.v1`
    if(!activeApp){localStorage.removeItem(key);return}
    localStorage.setItem(key,JSON.stringify({application:activeApp,section:activeApp==='itms'?section:undefined} satisfies WorkspaceLocation))
  },[activeApp,section,identityEmail])
  function navigate(target:string,focus?:string){const module=target as ModuleName;if(canOpen(activeRole,module)){if(focus)localStorage.setItem('itms.navigation-focus.v1',JSON.stringify({module,focus,at:new Date().toISOString()}));setSection(module);setMenuOpen(false)}}
  function toggleSidebar(){setSidebarCollapsed(current=>{const next=!current;localStorage.setItem('glassco.workspace.sidebar-collapsed.v1',String(next));return next})}
  function firstPermitted(role:RoleId){return navItems.find(item=>canOpen(role,item))}
  function switchRole(role:RoleId){setActiveRole(role);if(!canOpen(role,section as ModuleName)){const first=firstPermitted(role);if(first)setSection(first);else setActiveApp(null)}}
  function openApplication(appId:string,target?:string){if(!availableAuthorizedAppIds.includes(appId as GlasscoApplicationId))return;const first=target&&canOpen(activeRole,target as ModuleName)?target as ModuleName:firstPermitted(activeRole);if(['support','requests','facilities','flow','teams'].includes(appId)){setActiveApp(appId);setMenuOpen(false);return}if(appId==='itms'&&first){setSection(first);setActiveApp(appId);setMenuOpen(false)}}

  if(activeApp==='support'&&activeApplicationAuthorized) return <Suspense fallback={<WorkspaceLoading/>}><SupportDesk identityEmail={identityEmail} identityName={access.name} isServiceAgent={assignedRoles.some(role=>['administrator','asset-manager','it-head'].includes(role))} canViewManagementAnalytics={assignedRoles.some(role=>['administrator','it-head'].includes(role))} onOpenItms={(target,focus)=>{const role=assignedRoles.find(item=>canOpen(item,target));if(role&&authorizedAppIds.includes('itms')){setActiveRole(role);setSection(target);if(focus)localStorage.setItem('itms.navigation-focus.v1',JSON.stringify({module:target,focus,at:new Date().toISOString()}));setActiveApp('itms')}}} onExit={()=>setActiveApp(null)}/></Suspense>
  if(activeApp==='requests'&&activeApplicationAuthorized) return <ConsumableRequests identityEmail={identityEmail} identityName={access.name} isApprover={assignedRoles.some(role=>['administrator','department-manager','it-head'].includes(role))} isPurchaser={assignedRoles.some(role=>['administrator','asset-manager'].includes(role))} canManageMappings={assignedRoles.some(role=>['administrator','it-head'].includes(role))} onExit={()=>setActiveApp(null)}/>
  if(activeApp==='facilities'&&activeApplicationAuthorized) return <FacilitiesSupport identityEmail={identityEmail} identityName={access.name} isOperator={assignedRoles.some(role=>['administrator','asset-manager','it-head'].includes(role))} onExit={()=>setActiveApp(null)}/>
  if(activeApp==='flow'&&activeApplicationAuthorized) return <FlowWorkspace identityName={access.name} identityEmail={identityEmail} isLeader={assignedRoles.some(role=>['administrator','department-manager','it-head'].includes(role))} isAdministrator={assignedRoles.includes('administrator')} onExit={()=>setActiveApp(null)}/>
  if(activeApp==='teams'&&activeApplicationAuthorized) return <TeamsWorkspace identityName={access.name} identityEmail={identityEmail} isLeader={assignedRoles.some(role=>['administrator','department-manager','it-head'].includes(role))} onExit={()=>setActiveApp(null)}/>

  return (
    <div className="app-shell">
      <header className="topbar">
        {activeApp && <button className="menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" size={23}/></button>}
        <div className="brand"><img src="/brand/glassco-logo-transparent.png" alt="Glassco — A Glass Apart"/><span>{activeApp ? 'CONNECT · ITMS' : 'CONNECT'}</span></div>
        <div className="topbar-spacer" />
        {activeApp && (
          <NotificationCenter identityEmail={identityEmail} onNavigate={(target,focus,application) => {
            if(application&&['support','requests','facilities','itms'].includes(application)){
              if(focus)localStorage.setItem('workspace.navigation-target.v1',JSON.stringify({application,target,recordId:focus,at:new Date().toISOString()}))
              openApplication(application,target)
            }else navigate(target,focus)
          }}/>
        )}
        {activeApp && <button type="button" className="all-apps" onClick={() => { setActiveApp(null); setMenuOpen(false) }}><Icon name="dashboard" size={18}/>All applications</button>}
        <span className="environment">GLASSCO WORKSPACE</span>
        {activeApp&&assignedRoles.length>1&&<label className="role-simulator">Active role<select value={activeRole} onChange={event=>switchRole(event.target.value as RoleId)}>{roles.filter(role=>assignedRoles.includes(role.id)).map(role=><option value={role.id} key={role.id}>{role.name}</option>)}</select></label>}
        <span className="user">{identityEmail} · {roleById(activeRole).name}</span>
        {logout&&<button type="button" className="all-apps" onClick={()=>void logout()}>Sign out</button>}
      </header>

      {!activeApp||!activeApplicationAuthorized ? <AppLauncher onOpen={openApplication} identityEmail={identityEmail} identityName={access.name} authorizedAppIds={availableAuthorizedAppIds} applicationAvailability={applicationAvailability} accessSummary={`${assignedRoles.map(role=>roleById(role).name).join(', ')} · ${availableAuthorizedAppIds.length} active applications`} /> : <div className={`body-layout ${sidebarCollapsed?'sidebar-collapsed':''}`}>
        <aside className={`${menuOpen ? 'sidebar open' : 'sidebar'} ${sidebarCollapsed?'collapsed':''}`}>
          <div className="sidebar-heading"><div className="sidebar-label">IT Asset Lifecycle</div><button type="button" className="sidebar-collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed?'Expand navigation':'Collapse navigation'} title={sidebarCollapsed?'Expand navigation':'Collapse navigation'}><Icon name="chevron" size={17}/></button></div>
          <nav aria-label="Primary navigation">
            {permittedItems.map(item => <button type="button" className={section === item ? 'active' : ''} key={item} onClick={() => navigate(item)} title={sidebarCollapsed?item:undefined}><Icon name={iconByModule[item]} size={18}/><span className="sidebar-nav-text">{item}</span></button>)}
          </nav>
          <div className="sidebar-footer"><strong>Controlled system</strong><span>Local development foundation</span></div>
        </aside>
        {menuOpen && <button type="button" className="backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

        <main className={`role-${activeRole} section-${section.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')}`}>
          <Suspense fallback={<WorkspaceLoading/>}>{!canOpen(activeRole,section as ModuleName)?<section className="access-denied"><Icon name="assurance" size={42}/><h1>ITMS access not assigned</h1><p>{roleById(activeRole).name} has no operational access to this module. Ask an Administrator to amend the controlled access register.</p><button type="button" onClick={()=>setActiveApp(null)}>Return to All applications</button></section>:section === 'Operations Centre'?<OperationsCentre onNavigate={navigate}/>:section === 'Shared Masters' ? <SharedMasters />
            : section === 'Asset Inventory' ? <InventoryWorkspace />
            : section === 'Allocation & Custody' ? <AllocationCustody />
            : section === 'Maintenance & Inspection' ? <MaintenanceWorkspace />
            : section === 'Assurance & Controls' ? <AssuranceWorkspace />
            : section === 'Asset Retirement & Circularity' ? <RetirementWorkspace />
            : section === 'Reports & Analytics' ? <ReportsWorkspace />
            : section === 'Access & Roles' ? <AccessGovernance activeRole={activeRole} identityEmail={identityEmail}/>
            : <CommandDashboard onNavigate={navigate}/>}</Suspense>
        </main>
      </div>}
    </div>
  )
}

export default App
