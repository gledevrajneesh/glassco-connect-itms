export const glasscoApplications = [
  { id: 'itms', code: 'ITMS', name: 'IT Asset Management', status: 'Live' },
  { id: 'support', code: 'ITSD', name: 'IT Support Desk', status: 'Live' },
  { id: 'requests', code: 'NCR', name: 'Consumable Purchase Requests', status: 'Live' },
  { id: 'facilities', code: 'FMS', name: 'Facilities & Maintenance Support', status: 'Live' },
  { id: 'flow', code: 'FLOW', name: 'Glassco Flow', status: 'In build' },
  { id: 'teams', code: 'TEAM', name: 'Glassco Teams', status: 'In build' },
  { id: 'sales-service', code: 'SST', name: 'Sales & Service Tickets', status: 'Planned' },
  { id: 'visitors', code: 'VMS', name: 'Visitor Management', status: 'Planned' },
] as const

export type GlasscoApplicationId = typeof glasscoApplications[number]['id']

export type ApplicationAvailabilityMode = 'Enabled' | 'Disabled'
export type ApplicationAvailabilityRule = { mode: ApplicationAvailabilityMode; exceptionEmails: string[]; updatedAt: string; updatedBy: string }
export type ApplicationAvailability = Partial<Record<GlasscoApplicationId, ApplicationAvailabilityRule>>

export const defaultApplicationAvailability: ApplicationAvailability = {
  itms: { mode: 'Enabled', exceptionEmails: ['dev@glasscolabs.com'], updatedAt: '', updatedBy: 'System default' },
  support: { mode: 'Enabled', exceptionEmails: ['dev@glasscolabs.com'], updatedAt: '', updatedBy: 'System default' },
  requests: { mode: 'Enabled', exceptionEmails: ['dev@glasscolabs.com'], updatedAt: '', updatedBy: 'System default' },
  facilities: { mode: 'Enabled', exceptionEmails: ['dev@glasscolabs.com'], updatedAt: '', updatedBy: 'System default' },
  flow: { mode: 'Disabled', exceptionEmails: ['dev@glasscolabs.com'], updatedAt: '', updatedBy: 'System default' },
  teams: { mode: 'Disabled', exceptionEmails: ['dev@glasscolabs.com'], updatedAt: '', updatedBy: 'System default' },
}

export function applicationIsAvailable(appId: GlasscoApplicationId, email: string, availability: ApplicationAvailability) {
  const rule = availability[appId]
  return !rule || rule.mode === 'Enabled' || email.trim().toLowerCase() === 'dev@glasscolabs.com' || rule.exceptionEmails.includes(email.trim().toLowerCase())
}
