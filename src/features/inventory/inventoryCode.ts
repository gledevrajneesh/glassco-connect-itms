export type InventoryCodeRule = { id: string; typeId: string; prefix: string; nextNumber: number; padding: number; status: 'Active' | 'Disabled'; updatedAt: string }
export type InventoryCodeAsset = { assetId: string; typeId: string }

export function defaultPrefix(code: string) { return `GL-IT-${code.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8) || 'ASSET'}` }

export function suggestedCode(rule: InventoryCodeRule | undefined, typeCode: string, assets: InventoryCodeAsset[]) {
  const prefix = rule?.prefix?.trim().toUpperCase() || defaultPrefix(typeCode)
  const padding = Math.max(3, Math.min(8, Number(rule?.padding ?? 4)))
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highest = assets.filter((asset) => asset.typeId === rule?.typeId || asset.assetId.startsWith(`${prefix}-`)).reduce((max, asset) => {
    const match = asset.assetId.match(new RegExp(`^${escaped}-(\\d+)$`, 'i'))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  const next = Math.max(Number(rule?.nextNumber ?? 1), highest + 1)
  return `${prefix}-${String(next).padStart(padding, '0')}`
}
