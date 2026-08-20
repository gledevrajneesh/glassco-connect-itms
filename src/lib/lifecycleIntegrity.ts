export type IntegrityIssue = { id: string; severity: 'Critical' | 'Warning'; entity: string; message: string }
type User = { id: string; employeeCode: string; status: string }
type Asset = { id: string; assetId: string; stockStatus: string }
type Allocation = { id: string; code: string; userId: string; assetIds: string[]; state: string }
type Movement = { id: string; code: string; kind: 'Transfer' | 'Return'; assetId: string; fromUserId: string; toUserId: string; state: string }
type Lifecycle = { id: string; code: string; kind: 'Onboarding' | 'Offboarding'; userId: string; assetIds: string[]; state: string }

export function auditLifecycleIntegrity(users: User[], assets: Asset[], allocations: Allocation[], movements: Movement[], lifecycle: Lifecycle[]) {
  const issues: IntegrityIssue[] = []
  const user = (id: string) => users.find((item) => item.id === id)
  const asset = (id: string) => assets.find((item) => item.id === id)
  const custody = new Map<string, string>()
  const duplicate = new Set<string>()
  allocations.filter((item) => item.state === 'Active custody').forEach((item) => item.assetIds.forEach((assetId) => { if (custody.has(assetId) && custody.get(assetId) !== item.userId) duplicate.add(assetId); custody.set(assetId, item.userId) }))
  movements.filter((item) => item.state === 'Completed').forEach((item) => item.kind === 'Return' ? custody.delete(item.assetId) : custody.set(item.assetId, item.toUserId))
  duplicate.forEach((id) => issues.push({ id: `duplicate-${id}`, severity: 'Critical', entity: asset(id)?.assetId ?? id, message: 'Asset appears in more than one active allocation.' }))
  custody.forEach((userId, assetId) => {
    const currentAsset = asset(assetId); const currentUser = user(userId)
    if (!currentAsset) issues.push({ id: `missing-asset-${assetId}`, severity: 'Critical', entity: assetId, message: 'Custody points to an asset missing from the inventory master.' })
    else if (currentAsset.stockStatus !== 'Allocated') issues.push({ id: `status-${assetId}`, severity: 'Warning', entity: currentAsset.assetId, message: `Current custody exists but inventory status is ${currentAsset.stockStatus}.` })
    if (!currentUser) issues.push({ id: `missing-user-${assetId}`, severity: 'Critical', entity: currentAsset?.assetId ?? assetId, message: 'Custody points to a user missing from the user master.' })
    else if (currentUser.status !== 'Active') issues.push({ id: `inactive-${assetId}`, severity: 'Critical', entity: currentAsset?.assetId ?? assetId, message: `Inactive employee ${currentUser.employeeCode} still has current custody.` })
  })
  const pendingAssetIds = allocations.filter((item) => item.state === 'Pending Asset Manager' || item.state === 'Pending IT Head').flatMap((item) => item.assetIds)
  const pendingCounts = pendingAssetIds.reduce<Record<string, number>>((result, id) => ({ ...result, [id]: (result[id] ?? 0) + 1 }), {})
  Object.entries(pendingCounts).filter(([, count]) => count > 1).forEach(([id]) => issues.push({ id: `pending-duplicate-${id}`, severity: 'Critical', entity: asset(id)?.assetId ?? id, message: 'Asset is reserved by multiple open allocation requests.' }))
  assets.forEach((item) => {
    if (item.stockStatus === 'Allocated' && !custody.has(item.id)) issues.push({ id: `orphan-allocated-${item.id}`, severity: 'Critical', entity: item.assetId, message: 'Inventory says Allocated but no current custodian exists.' })
    if (item.stockStatus === 'Reserved' && !pendingAssetIds.includes(item.id)) issues.push({ id: `orphan-reserved-${item.id}`, severity: 'Warning', entity: item.assetId, message: 'Inventory says Reserved but no open allocation request exists.' })
  })
  lifecycle.filter((item) => item.kind === 'Offboarding' && item.state === 'Completed').forEach((item) => {
    if (user(item.userId)?.status === 'Active') issues.push({ id: `offboard-active-${item.id}`, severity: 'Critical', entity: item.code, message: 'Completed offboarding exists but employee remains Active.' })
    if ([...custody.values()].includes(item.userId)) issues.push({ id: `offboard-custody-${item.id}`, severity: 'Critical', entity: item.code, message: 'Completed offboarding exists but employee still retains asset custody.' })
  })
  return issues
}
