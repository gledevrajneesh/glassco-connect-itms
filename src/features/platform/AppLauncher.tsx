import Icon, { type IconName } from '../../components/Icon'

type PlatformApp = {
  id: string
  name: string
  description: string
  shortName: string
  icon: IconName
  state: 'authorized' | 'no-access' | 'planned'
}

const applications: PlatformApp[] = [
  { id: 'itms', name: 'IT Asset Management', description: 'Manage IT inventory, custody, maintenance, verification and the complete asset lifecycle.', shortName: 'ITMS', icon: 'inventory', state: 'authorized' },
  { id: 'support', name: 'IT Support Desk', description: 'Employee tickets and IT service coordination.', shortName: 'ITSD', icon: 'support', state: 'no-access' },
  { id: 'requests', name: 'Non-consumable Requests', description: 'Requests and approval workflows.', shortName: 'NCR', icon: 'requests', state: 'planned' },
  { id: 'sales-service', name: 'Sales & Service Tickets', description: 'Sales and customer-service coordination.', shortName: 'SST', icon: 'service', state: 'planned' },
  { id: 'visitors', name: 'Visitor Management', description: 'Visitor approvals and controlled entry.', shortName: 'VMS', icon: 'visitor', state: 'planned' },
]

export default function AppLauncher({ onOpen }: { onOpen: (appId: string) => void }) {
  const authorized = applications.filter((app) => app.state === 'authorized')
  const otherApps = applications.filter((app) => app.state !== 'authorized')

  return (
    <main className="launcher-main">
      <section className="launcher-heading">
        <div><span className="eyebrow">GLASSCO COMMUNICATION & COORDINATION PLATFORM</span><h1>Good afternoon</h1><p>Select an application to continue.</p></div>
        <div className="identity-card"><span className="identity-avatar">DG</span><div><strong>Development User</strong><span>dev@glasscolabs.com</span></div></div>
      </section>

      <section className="authorized-section">
        <div className="section-title"><div><h2>Your applications</h2><p>Applications currently assigned to your account.</p></div><span>{authorized.length} available</span></div>
        <div className="authorized-grid">
          {authorized.map((app) => <button className="authorized-app" type="button" key={app.id} onClick={() => onOpen(app.id)}>
            <span className="app-monogram"><Icon name={app.icon} size={29}/></span>
            <span className="app-copy"><strong>{app.name}</strong><small>{app.description}</small></span>
            <span className="open-arrow"><Icon name="arrow" size={24}/></span>
          </button>)}
        </div>
      </section>

      <section className="other-section">
        <div className="section-title"><div><h2>Other Glassco applications</h2><p>These applications are not currently available to this account.</p></div></div>
        <div className="other-list">
          {otherApps.map((app) => <article className="other-app" key={app.id}>
            <span className="other-monogram"><Icon name={app.icon} size={22}/></span>
            <span className="other-copy"><strong>{app.name}</strong><small>{app.description}</small></span>
            <span className={`access-state ${app.state}`}>{app.state === 'no-access' ? 'NO ACCESS' : 'PLANNED'}</span>
          </article>)}
        </div>
      </section>

      <p className="access-footnote">Application access is assigned centrally. Module permissions are evaluated after an application opens.</p>
    </main>
  )
}
