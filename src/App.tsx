import { lazy, Suspense, useState } from 'react'
import './App.css'
import './FormalTheme.css'
import AppLauncher from './features/platform/AppLauncher'
import NotificationCenter from './features/notifications/NotificationCenter'
import Icon, { type IconName } from './components/Icon'
import { canOpen, roleById, roles, type ModuleName, type RoleId } from './lib/accessControl'
import type { CentralAccessAssignment } from './lib/centralAccess'
import type { GlasscoApplicationId } from './lib/applicationAccess'

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

function App({identityEmail,logout,access}:{identityEmail:string;logout:(()=>Promise<void>)|null;access:CentralAccessAssignment}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [section, setSection] = useState('Dashboard')
  const [activeApp, setActiveApp] = useState<string | null>(new URLSearchParams(window.location.search).has('supportRating') ? 'support' : null)
  const assignedRoles=([...(access.roleIds?.length?access.roleIds:[access.roleId])] as RoleId[]).sort((left,right)=>rolePriority[left]-rolePriority[right])
  const [activeRole,setActiveRole]=useState<RoleId>(assignedRoles[0])
  const permittedItems=navItems.filter(item=>canOpen(activeRole,item))
  // Missing appIds means the assignment predates app-level governance; preserve its
  // previous effective access until an administrator explicitly saves an app list.
  const authorizedAppIds:GlasscoApplicationId[]=access.appIds??[...(permittedItems.length?['itms' as const]:[]),'support']
  const activeApplicationAuthorized=!activeApp||authorizedAppIds.includes(activeApp as GlasscoApplicationId)
  function navigate(target:string,focus?:string){const module=target as ModuleName;if(canOpen(activeRole,module)){if(focus)localStorage.setItem('itms.navigation-focus.v1',JSON.stringify({module,focus,at:new Date().toISOString()}));setSection(module);setMenuOpen(false)}}
  function firstPermitted(role:RoleId){return navItems.find(item=>canOpen(role,item))}
  function switchRole(role:RoleId){setActiveRole(role);if(!canOpen(role,section as ModuleName)){const first=firstPermitted(role);if(first)setSection(first);else setActiveApp(null)}}
  function openApplication(appId:string){if(!authorizedAppIds.includes(appId as GlasscoApplicationId))return;const first=firstPermitted(activeRole);if(appId==='support'){setActiveApp(appId);setMenuOpen(false);return}if(appId==='itms'&&first){setSection(first);setActiveApp(appId);setMenuOpen(false)}}

  if(activeApp==='support'&&activeApplicationAuthorized) return <Suspense fallback={<WorkspaceLoading/>}><SupportDesk identityEmail={identityEmail} identityName={access.name} isServiceAgent={assignedRoles.some(role=>['administrator','asset-manager','it-head'].includes(role))} canViewManagementAnalytics={assignedRoles.some(role=>['administrator','it-head'].includes(role))} onOpenItms={(target,focus)=>{const role=assignedRoles.find(item=>canOpen(item,target));if(role&&authorizedAppIds.includes('itms')){setActiveRole(role);setSection(target);if(focus)localStorage.setItem('itms.navigation-focus.v1',JSON.stringify({module:target,focus,at:new Date().toISOString()}));setActiveApp('itms')}}} onExit={()=>setActiveApp(null)}/></Suspense>

  return (
    <div className="app-shell">
      <header className="topbar">
        {activeApp && <button className="menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" size={23}/></button>}
        <div className="brand"><img src="https://glasscolabs.com/wp-content/uploads/2024/03/Glassco-logo.jpg" alt="Glassco — A Glass Apart"/><span>{activeApp ? 'CONNECT · ITMS' : 'CONNECT'}</span></div>
        <div className="topbar-spacer" />
        {activeApp && (
          <NotificationCenter identityEmail={identityEmail} onNavigate={(target) => {
            navigate(target)
          }}/>
        )}
        {activeApp && <button type="button" className="all-apps" onClick={() => { setActiveApp(null); setMenuOpen(false) }}><Icon name="dashboard" size={18}/>All applications</button>}
        <span className="environment">GLASSCO WORKSPACE</span>
        {activeApp&&assignedRoles.length>1&&<label className="role-simulator">Active role<select value={activeRole} onChange={event=>switchRole(event.target.value as RoleId)}>{roles.filter(role=>assignedRoles.includes(role.id)).map(role=><option value={role.id} key={role.id}>{role.name}</option>)}</select></label>}
        <span className="user">{identityEmail} · {roleById(activeRole).name}</span>
        {logout&&<button type="button" className="all-apps" onClick={()=>void logout()}>Sign out</button>}
      </header>

      {!activeApp||!activeApplicationAuthorized ? <AppLauncher onOpen={openApplication} identityEmail={identityEmail} identityName={access.name} authorizedAppIds={authorizedAppIds} /> : <div className="body-layout">
        <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
          <div className="sidebar-label">IT Asset Lifecycle</div>
          <nav aria-label="Primary navigation">
            {permittedItems.map(item => <button type="button" className={section === item ? 'active' : ''} key={item} onClick={() => navigate(item)}><Icon name={iconByModule[item]} size={18}/>{item}</button>)}
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
