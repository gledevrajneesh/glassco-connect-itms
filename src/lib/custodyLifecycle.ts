export type AssetDisposition = 'In stock' | 'Under repair' | 'Scrap'
export type CustodyMovement = { id: string; code: string; kind: 'Transfer' | 'Return'; assetId: string; fromUserId: string; toDepartmentId: string; toUserId: string; disposition?: AssetDisposition; plannedDate: string; effectiveDate: string; reason: string; state: 'Pending Asset Manager' | 'Pending IT Head' | 'Completed'; requestedBy: string; requestedAt: string; assetManagerApprovedAt: string; itHeadApprovedAt: string }
type Allocation = { userId: string; assetIds: string[]; allocationDate: string; state: string }
type Asset = { id: string }

export function deriveCustody(allocations: Allocation[], movements: CustodyMovement[], assets: Asset[]) {
  const custody = new Map<string, { userId: string; since: string; source: string }>()
  allocations.filter((item) => item.state === 'Active custody').forEach((item) => item.assetIds.forEach((assetId) => {
    if (assets.some((asset) => asset.id === assetId)) custody.set(assetId, { userId: item.userId, since: item.allocationDate, source: 'Allocation' })
  }))
  movements.filter((item) => item.state === 'Completed').forEach((item) => {
    if (item.kind === 'Return') custody.delete(item.assetId)
    else custody.set(item.assetId, { userId: item.toUserId, since: item.effectiveDate, source: item.code })
  })
  return custody
}
