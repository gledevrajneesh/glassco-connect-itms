type AppAccess = 'authorized' | 'no-access' | 'planned'

type PlatformApp = {
  id: string
  name: string
  description: string
  icon: string
  access: AppAccess
}

const applications: PlatformApp[] = [
  { id: 'itms', name: 'IT Asset Management', description: 'IT inventory, custody, maintenance and lifecycle controls.', icon: '▣', access: 'authorized' },
  { id: 'support', name: 'IT Support Desk', description: 'Employee support tickets, service queues and resolution tracking.', icon: '⌁', access: 'no-access' },
  { id: 'requests', name: 'Non-consumable Requests', description: 'Controlled request and approval workflows.', icon: '✓', access: 'planned' },
  { id: 'sales-service', name: 'Sales & Service Tickets', description: 'Customer-facing sales and service coordination.', icon: '↗', access: 'planned' },
  { id: 'visitors', name: 'Visitor Management', description: 'Visitor registration, approvals and controlled entry.', icon: '◎', access: 'planned' },
]

export default function AppLauncher({ onOpen }: { onOpen: (appId: string) => void }) {
  return (
    <main className="launcher-main">
      <section className="launcher-heading">
        <div><span className="eyebrow">GLASSCO COMMUNICATION & COORDINATION PLATFORM</span><h1>Welcome to Glassco Connect</h1><p>Open an application assigned to your company account.</p></div>
        <div className="identity-card"><span className="identity-avatar">DG</span><div><strong>Development User</strong><span>dev@glasscolabs.com</span></div></div>
      </section>

      <section className="launcher-summary" aria-label="Application access summary">
        <div><span>Available applications</span><strong>{applications.filter((app) => app.access === 'authorized').length}</strong></div>
        <div><span>Restricted applications</span><strong>{applications.filter((app) => app.access === 'no-access').length}</strong></div>
        <div><span>Platform environment</span><strong>Localhost</strong></div>
      </section>

      <section className="application-section">
        <div className="application-heading"><div><h2>Applications</h2><p>Application visibility does not grant access. Authorization is managed centrally.</p></div><span className="access-note">Access-controlled</span></div>
        <div className="application-grid">
          {applications.map((app) => {
            const enabled = app.access === 'authorized'
            return <article className={`application-card ${app.access}`} key={app.id}>
              <div className="application-icon" aria-hidden="true">{app.icon}</div>
              <div className="application-copy"><div className="application-title"><h3>{app.name}</h3><span>{app.access === 'authorized' ? 'AUTHORIZED' : app.access === 'no-access' ? 'NO ACCESS' : 'PLANNED'}</span></div><p>{app.description}</p></div>
              <button type="button" disabled={!enabled} onClick={() => enabled && onOpen(app.id)}>{enabled ? 'Open application →' : app.access === 'no-access' ? 'Access not assigned' : 'Coming later'}</button>
            </article>
          })}
        </div>
      </section>
      <section className="launcher-boundary"><strong>Access principle</strong><span>Users see the Glassco application catalogue after login, but only assigned applications are highlighted and interactive.</span></section>
    </main>
  )
}
