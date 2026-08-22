import { useState } from 'react'
import './App.css'
import SharedMasters from './features/masters/SharedMasters'
import AppLauncher from './features/platform/AppLauncher'
import InventoryWorkspace from './features/inventory/InventoryWorkspace'
import AllocationCustody from './features/custody/AllocationCustody'
import MaintenanceWorkspace from './features/maintenance/MaintenanceWorkspace'
import AssuranceWorkspace from './features/assurance/AssuranceWorkspace'
import ReportsWorkspace from './features/reports/ReportsWorkspace'
import CommandDashboard from './features/dashboard/CommandDashboard'
import Icon, { type IconName } from './components/Icon'

const navItems = ['Dashboard', 'Shared Masters', 'Asset Inventory', 'Allocation & Custody', 'Maintenance & Inspection', 'Assurance & Controls', 'Reports & Analytics']
const navIcons: IconName[] = ['dashboard', 'masters', 'inventory', 'allocation', 'maintenance', 'assurance', 'reports']

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [section, setSection] = useState('Dashboard')
  const [activeApp, setActiveApp] = useState<string | null>(null)

  return (
    <div className="app-shell">
      <header className="topbar">
        {activeApp && <button className="menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>}
        <div className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="brand"><strong>GLASSCO</strong><span>{activeApp ? 'CONNECT · ITMS' : 'CONNECT'}</span></div>
        <div className="topbar-spacer" />
        {activeApp && <button type="button" className="all-apps" onClick={() => { setActiveApp(null); setMenuOpen(false) }}>All applications</button>}
        <span className="environment">LOCALHOST</span>
        <span className="user">dev@glasscolabs.com</span>
      </header>

      {!activeApp ? <AppLauncher onOpen={setActiveApp} /> : <div className="body-layout">
        <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
          <div className="sidebar-label">IT Asset Lifecycle</div>
          <nav aria-label="Primary navigation">
            {navItems.map((item, index) => <button type="button" className={section === item ? 'active' : ''} key={item} onClick={() => { setSection(item); setMenuOpen(false) }}><Icon name={navIcons[index]} size={18}/>{item}</button>)}
          </nav>
          <div className="sidebar-footer"><strong>Controlled system</strong><span>Local development foundation</span></div>
        </aside>
        {menuOpen && <button type="button" className="backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

        <main>
          {section === 'Shared Masters' ? <SharedMasters />
            : section === 'Asset Inventory' ? <InventoryWorkspace />
            : section === 'Allocation & Custody' ? <AllocationCustody />
            : section === 'Maintenance & Inspection' ? <MaintenanceWorkspace />
            : section === 'Assurance & Controls' ? <AssuranceWorkspace />
            : section === 'Reports & Analytics' ? <ReportsWorkspace />
            : <CommandDashboard onNavigate={setSection}/>}
        </main>
      </div>}
    </div>
  )
}

export default App
