export const glasscoApplications = [
  { id: 'itms', code: 'ITMS', name: 'IT Asset Management', status: 'Live' },
  { id: 'support', code: 'ITSD', name: 'IT Support Desk', status: 'Live' },
  { id: 'requests', code: 'NCR', name: 'Non-consumable Requests', status: 'Planned' },
  { id: 'sales-service', code: 'SST', name: 'Sales & Service Tickets', status: 'Planned' },
  { id: 'visitors', code: 'VMS', name: 'Visitor Management', status: 'Planned' },
] as const

export type GlasscoApplicationId = typeof glasscoApplications[number]['id']

