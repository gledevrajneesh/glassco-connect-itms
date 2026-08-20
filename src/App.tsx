import { useState } from 'react'
import './App.css'
import SharedMasters from './features/masters/SharedMasters'
import AppLauncher from './features/platform/AppLauncher'
import InventoryWorkspace from './features/inventory/InventoryWorkspace'
import AllocationCustody from './features/custody/AllocationCustody'
import Icon, { type IconName } from './components/Icon'

const modules = [
  ['Shared Masters', 'Users, departments, sites and vendors', 'masters'], ['Asset Inventory', 'Stock, identity, condition and lifecycle', 'inventory'], ['Allocation & Custody', 'Issue, transfer, return and clearance', 'allocation'], ['Maintenance & Inspection', 'Plans, checklists, calendar and repairs', 'maintenance'], ['Assurance & Controls', 'Verification, exceptions and disposal', 'assurance'], ['Reports & Analytics', 'Dashboards, forecasts and audit trail', 'reports'],
] as [string, string, IconName][]

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
          {section === 'Shared Masters' ? <SharedMasters /> : section === 'Asset Inventory' ? <InventoryWorkspace /> : section === 'Allocation & Custody' ? <AllocationCustody /> : <>
          <section className="page-heading">
            <div><span className="eyebrow">GCCP-ITMS-FOUNDATION-01</span><h1>IT Asset Lifecycle Dashboard</h1><p>One governed source for IT inventory, custody, maintenance and assurance.</p></div>
            <span className="phase">PHASE 1 · LOCALHOST</span>
          </section>

          <section className="status-grid" aria-label="Foundation status">
            <article><span>Development mode</span><strong>Local only</strong><small>No cloud connection</small></article>
            <article><span>Responsive baseline</span><strong>Mobile first</strong><small>Desktop · tablet · phone</small></article>
            <article><span>Firebase ownership</span><strong>Reserved</strong><small>dev@glasscolabs.com</small></article>
          </section>

          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">APPROVED OPERATING MODEL</span><h2>Phase 1 capability foundation</h2><p>Modules will be activated through controlled build checkpoints.</p></div><button type="button" disabled>Build 0.1.0</button></div>
            <div className="module-grid">
              {modules.map(([title, description, icon]) => <article className="module" key={title}><span className="module-icon"><Icon name={icon} size={22}/></span><div><h3>{title}</h3><p>{description}</p><span className="planned">PLANNED</span></div></article>)}
            </div>
          </section>

          <section className="boundary"><strong>Foundation boundary</strong><span>100% localhost development first. Firebase Spark deployment will begin only after local acceptance and explicit approval.</span></section>
          </>}
        </main>
      </div>}
    </div>
  )
}

export default App
