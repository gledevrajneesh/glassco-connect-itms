import { useState } from 'react'
import './App.css'
import './FormalTheme.css'
import SharedMasters from './features/masters/SharedMasters'
import AppLauncher from './features/platform/AppLauncher'
import InventoryWorkspace from './features/inventory/InventoryWorkspace'
import AllocationCustody from './features/custody/AllocationCustody'
import MaintenanceWorkspace from './features/maintenance/MaintenanceWorkspace'
import AssuranceWorkspace from './features/assurance/AssuranceWorkspace'
import ReportsWorkspace from './features/reports/ReportsWorkspace'
import CommandDashboard from './features/dashboard/CommandDashboard'
import NotificationCenter from './features/notifications/NotificationCenter'
import RetirementWorkspace from './features/retirement/RetirementWorkspace'
import AccessGovernance from './features/access/AccessGovernanceV2'
import OperationsCentre from './features/operations/OperationsCentre'
import Icon, { type IconName } from './components/Icon'
import { canOpen, roleById, roles, type ModuleName, type RoleId } from './lib/accessControl'
import { useLocalStore } from './lib/localStore'

const navItems:ModuleName[] = ['Dashboard','Operations Centre', 'Shared Masters', 'Asset Inventory', 'Allocation & Custody', 'Maintenance & Inspection', 'Assurance & Controls', 'Asset Retirement & Circularity', 'Reports & Analytics','Access & Roles']
const iconByModule:Record<ModuleName,IconName> = {Dashboard:'dashboard','Operations Centre':'support','Shared Masters':'masters','Asset Inventory':'inventory','Allocation & Custody':'allocation','Maintenance & Inspection':'maintenance','Assurance & Controls':'assurance','Asset Retirement & Circularity':'history','Reports & Analytics':'reports','Access & Roles':'assurance'}

function App({identityEmail,logout}:{identityEmail:string;logout:(()=>Promise<void>)|null}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [section, setSection] = useState('Dashboard')
  const [activeApp, setActiveApp] = useState<string | null>(null)
  const [activeRole,setActiveRole]=useLocalStore<RoleId>('itms.active-role.v1','administrator')
  const permittedItems=navItems.filter(item=>canOpen(activeRole,item))
  function navigate(target:string,focus?:string){const module=target as ModuleName;if(canOpen(activeRole,module)){if(focus)localStorage.setItem('itms.navigation-focus.v1',JSON.stringify({module,focus,at:new Date().toISOString()}));setSection(module);setMenuOpen(false)}}
  function switchRole(role:RoleId){setActiveRole(role);if(!canOpen(role,section as ModuleName))setSection('Dashboard')}

  return (
    <div className="app-shell">
      <header className="topbar">
        {activeApp && <button className="menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" size={23}/></button>}
        <div className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="brand"><strong>GLASSCO</strong><span>{activeApp ? 'CONNECT · ITMS' : 'CONNECT'}</span></div>
        <div className="topbar-spacer" />
        {activeApp && (
          <NotificationCenter onNavigate={(target) => {
            navigate(target)
          }}/>
        )}
        {activeApp && <button type="button" className="all-apps" onClick={() => { setActiveApp(null); setMenuOpen(false) }}><Icon name="dashboard" size={18}/>All applications</button>}
        <span className="environment">LOCALHOST</span>
        {activeApp&&<label className="role-simulator">Testing as<select value={activeRole} onChange={event=>switchRole(event.target.value as RoleId)}>{roles.map(role=><option value={role.id} key={role.id}>{role.name}</option>)}</select></label>}
        <span className="user">{identityEmail} · {roleById(activeRole).name}</span>
        {logout&&<button type="button" className="all-apps" onClick={()=>void logout()}>Sign out</button>}
      </header>

      {!activeApp ? <AppLauncher onOpen={setActiveApp} /> : <div className="body-layout">
        <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
          <div className="sidebar-label">IT Asset Lifecycle</div>
          <nav aria-label="Primary navigation">
            {permittedItems.map(item => <button type="button" className={section === item ? 'active' : ''} key={item} onClick={() => navigate(item)}><Icon name={iconByModule[item]} size={18}/>{item}</button>)}
          </nav>
          <div className="sidebar-footer"><strong>Controlled system</strong><span>Local development foundation</span></div>
        </aside>
        {menuOpen && <button type="button" className="backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

        <main className={`role-${activeRole} section-${section.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')}`}>
          {!canOpen(activeRole,section as ModuleName)?<section className="access-denied"><Icon name="assurance" size={42}/><h1>ITMS access not assigned</h1><p>{roleById(activeRole).name} has no operational access to this module. Ask an Administrator to amend the controlled access register.</p><button type="button" onClick={()=>setActiveApp(null)}>Return to All applications</button></section>:section === 'Operations Centre'?<OperationsCentre onNavigate={navigate}/>:section === 'Shared Masters' ? <SharedMasters />
            : section === 'Asset Inventory' ? <InventoryWorkspace />
            : section === 'Allocation & Custody' ? <AllocationCustody />
            : section === 'Maintenance & Inspection' ? <MaintenanceWorkspace />
            : section === 'Assurance & Controls' ? <AssuranceWorkspace />
            : section === 'Asset Retirement & Circularity' ? <RetirementWorkspace />
            : section === 'Reports & Analytics' ? <ReportsWorkspace />
            : section === 'Access & Roles' ? <AccessGovernance activeRole={activeRole}/>
            : <CommandDashboard onNavigate={navigate}/>}
        </main>
      </div>}
    </div>
  )
}

export default App
