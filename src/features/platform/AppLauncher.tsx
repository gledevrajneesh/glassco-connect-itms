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

export default function AppLauncher({ onOpen, identityEmail, identityName }: { onOpen: (appId: string) => void; identityEmail: string; identityName: string }) {
  const authorized = applications.filter((app) => app.state === 'authorized')
  const otherApps = applications.filter((app) => app.state !== 'authorized')
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const initials = identityName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <main className="launcher-main">
      <section className="launcher-hero">
        <div className="launcher-hero-copy">
          <span className="launcher-kicker">GLASSCO CONNECT</span>
          <h1>{greeting}, {identityName}.</h1>
          <p>Your secure workspace for communication, coordination and controlled business operations.</p>
          <div className="launcher-trust-row"><span><Icon name="assurance" size={17}/> Company workspace</span><span><Icon name="check" size={17}/> Authorised access</span></div>
        </div>
        <div className="identity-card"><span className="identity-avatar">{initials}</span><div><small>Signed in as</small><strong>{identityName}</strong><span>{identityEmail}</span></div><span className="identity-status">ACTIVE</span></div>
      </section>

      <section className="authorized-section">
        <div className="section-title"><div><span className="section-kicker">YOUR WORKSPACE</span><h2>Available applications</h2><p>Open an application assigned to your account.</p></div><span>{authorized.length} available</span></div>
        <div className="authorized-grid">
          {authorized.map((app) => <button className="authorized-app" type="button" key={app.id} onClick={() => onOpen(app.id)}>
            <span className="app-monogram"><Icon name={app.icon} size={29}/></span>
            <span className="app-copy"><small className="app-code">{app.shortName}</small><strong>{app.name}</strong><small>{app.description}</small></span>
            <span className="open-app-label">Open application <Icon name="arrow" size={20}/></span>
          </button>)}
        </div>
      </section>

      <section className="other-section">
        <div className="section-title"><div><span className="section-kicker">PLATFORM ROADMAP</span><h2>More from Glassco Connect</h2><p>One governed platform, expanding around the way Glassco works.</p></div></div>
        <div className="other-list">
          {otherApps.map((app) => <article className="other-app" key={app.id}>
            <span className="other-monogram"><Icon name={app.icon} size={22}/></span>
            <span className="other-copy"><small>{app.shortName}</small><strong>{app.name}</strong><span>{app.description}</span></span>
            <span className={`access-state ${app.state}`}>{app.state === 'no-access' ? 'Access not assigned' : 'Planned'}</span>
          </article>)}
        </div>
      </section>

      <footer className="launcher-footer"><span><Icon name="assurance" size={16}/> Controlled company platform</span><span>Application access is centrally governed.</span></footer>
    </main>
  )
}
