import { useMemo, useState } from 'react'
import Icon, { type IconName } from './Icon'

export type GroupedAsset = { id: string; assetId: string; typeId?: string; modelId: string; serialNumber?: string; iconName?: IconName }
export type GroupedAssetType = { id: string; code: string; name: string }
export type GroupedAssetModel = { id: string; brand: string; name: string; typeId?: string }

type Props = {
  title: string
  assets: GroupedAsset[]
  assetTypes: GroupedAssetType[]
  models: GroupedAssetModel[]
  selectedAssetIds: string[]
  onSelectedAssetIdsChange?: (ids: string[]) => void
  groupIds: string[]
  onGroupIdsChange?: (ids: string[]) => void
  readOnly?: boolean
  emptyMessage: string
}

export default function GroupedAssetPicker({ title, assets, assetTypes, models, selectedAssetIds, onSelectedAssetIdsChange, groupIds, onGroupIdsChange, readOnly = false, emptyMessage }: Props) {
  const [groupToAdd, setGroupToAdd] = useState('')
  const [search, setSearch] = useState('')
  const resolveTypeId = (asset: GroupedAsset) => asset.typeId || models.find((model) => model.id === asset.modelId)?.typeId || ''
  const availableGroups = useMemo(() => assetTypes.filter((type) => assets.some((asset) => resolveTypeId(asset) === type.id)), [assets, assetTypes, models])
  const visibleGroupIds = readOnly ? availableGroups.map((type) => type.id) : groupIds
  const label = (asset: GroupedAsset) => {
    const model = models.find((item) => item.id === asset.modelId)
    return `${asset.assetId} · ${model ? `${model.brand} ${model.name}` : 'Model unavailable'}${asset.serialNumber ? ` · ${asset.serialNumber}` : ''}`
  }
  const toggle = (assetId: string) => onSelectedAssetIdsChange?.(selectedAssetIds.includes(assetId) ? selectedAssetIds.filter((id) => id !== assetId) : [...selectedAssetIds, assetId])
  const removeGroup = (groupId: string) => {
    const ids = assets.filter((asset) => resolveTypeId(asset) === groupId).map((asset) => asset.id)
    onSelectedAssetIdsChange?.(selectedAssetIds.filter((id) => !ids.includes(id)))
    onGroupIdsChange?.(groupIds.filter((id) => id !== groupId))
  }
  const addGroup = () => { if (groupToAdd && !groupIds.includes(groupToAdd)) onGroupIdsChange?.([...groupIds, groupToAdd]); setGroupToAdd('') }
  return <fieldset className="asset-picker grouped-asset-picker"><legend>{title} <span>{selectedAssetIds.length} selected</span></legend>
    {!readOnly && <div className="group-picker-toolbar"><label>Add item group<select value={groupToAdd} onChange={(event) => setGroupToAdd(event.target.value)}><option value="">Select group</option>{availableGroups.filter((type) => !groupIds.includes(type.id)).map((type) => <option value={type.id} key={type.id}>{type.code} · {type.name}</option>)}</select></label><button type="button" disabled={!groupToAdd} onClick={addGroup}>＋ Add group</button><label className="group-picker-search">Search selected groups<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Asset ID, serial, brand or model" /></label></div>}
    {!visibleGroupIds.length ? <p>Select an item group, then choose the item(s) to include.</p> : visibleGroupIds.map((groupId) => {
      const type = assetTypes.find((item) => item.id === groupId)
      const allGroupAssets = assets.filter((asset) => resolveTypeId(asset) === groupId)
      const query = search.trim().toLowerCase()
      const groupAssets = query ? allGroupAssets.filter((asset) => label(asset).toLowerCase().includes(query)) : allGroupAssets
      if (!allGroupAssets.length) return null
      return <section className="asset-group" key={groupId}><header><div><strong>{type?.code} · {type?.name || 'Item group'}</strong><small>{groupAssets.length}{query ? ` of ${allGroupAssets.length}` : ''} available · {allGroupAssets.filter((asset) => selectedAssetIds.includes(asset.id)).length} selected</small></div>{!readOnly && <div><button type="button" onClick={() => onSelectedAssetIdsChange?.([...new Set([...selectedAssetIds, ...allGroupAssets.map((asset) => asset.id)])])}>Select group</button><button type="button" onClick={() => removeGroup(groupId)}>Remove group</button></div>}</header>{groupAssets.length ? groupAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={selectedAssetIds.includes(asset.id)} readOnly={readOnly} onChange={() => !readOnly && toggle(asset.id)} /><Icon name={asset.iconName ?? 'package'} size={20}/><span>{label(asset)}</span></label>) : <p>No items match this search.</p>}</section>
    })}
    {!assets.length && <p>{emptyMessage}</p>}
  </fieldset>
}
