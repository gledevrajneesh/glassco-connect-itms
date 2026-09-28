import { useMemo, useState } from 'react'
import DataTable from '../../components/DataTable'
import { useLocalStore } from '../../lib/localStore'
import { defaultPrefix, suggestedCode, type InventoryCodeRule } from './inventoryCode'

type AssetType = { id: string; code: string; name: string; status: 'Active' | 'Inactive' }
type Asset = { id: string; assetId: string; typeId: string }

export default function InventoryCodeGovernance() {
  const [types] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [assets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [rules, setRules] = useLocalStore<InventoryCodeRule[]>('itms.inventory-code-rules.v1', [])
  const [message, setMessage] = useState('')
  const activeTypes = types.filter((item) => item.status === 'Active')
  const rows = useMemo(() => activeTypes.map((type) => {
    const rule = rules.find((item) => item.typeId === type.id)
    return { type, rule, next: suggestedCode(rule, type.code, assets), issued: assets.filter((asset) => asset.typeId === type.id).length }
  }), [activeTypes, assets, rules])
  function update(type: AssetType, patch: Partial<InventoryCodeRule>) {
    setRules((current) => {
      const existing = current.find((item) => item.typeId === type.id)
      const base: InventoryCodeRule = existing ?? { id: crypto.randomUUID(), typeId: type.id, prefix: defaultPrefix(type.code), nextNumber: 1, padding: 4, status: 'Active', updatedAt: new Date().toISOString() }
      const next = { ...base, ...patch, prefix: (patch.prefix ?? base.prefix).toUpperCase().replace(/\s+/g, '-'), updatedAt: new Date().toISOString() }
      return existing ? current.map((item) => item.id === existing.id ? next : item) : [...current, next]
    })
  }
  function save() { setMessage('Inventory code rules saved. New assets will use the next controlled code for their category.') }
  const governed = rows.filter((row) => row.rule?.status === 'Active').length
  const legacy = assets.filter((asset) => !rules.some((rule) => rule.typeId === asset.typeId)).length
  return <section className="master-panel inventory-code-governance"><div className="operation-heading"><div><span className="eyebrow">CONTROLLED INVENTORY IDENTITY</span><h2>Inventory Code Governance</h2><p>Keep existing Excel codes, then control the next asset code by item category.</p></div><button type="button" className="primary-action" onClick={save}>Save code rules</button></div>{message&&<div className="success-message" role="status">✓ {message}</div>}<div className="master-summary"><div><span>Governed categories</span><strong>{governed}</strong></div><div><span>Assets with existing codes</span><strong>{assets.length}</strong></div><div><span>Categories awaiting a rule</span><strong>{Math.max(0,activeTypes.length-governed)}</strong></div></div><div className="code-governance-note"><strong>How this works</strong><span>Existing Asset IDs are retained. The next code is proposed while registering a new asset. Manual edits are checked for duplicates and recorded in Asset Register history.</span></div><DataTable rows={rows} rowKey={(row) => row.type.id} columns={[{key:'type',label:'Item category',sticky:true,width:'240px',render:(row)=><><strong>{row.type.code} · {row.type.name}</strong><small>{row.issued} existing asset code{row.issued===1?'':'s'}</small></>},{key:'prefix',label:'Code prefix',width:'210px',render:(row)=><input aria-label={`Code prefix for ${row.type.name}`} value={row.rule?.prefix??defaultPrefix(row.type.code)} onChange={(event)=>update(row.type,{prefix:event.target.value})} />},{key:'next',label:'Next number',width:'140px',render:(row)=><input aria-label={`Next number for ${row.type.name}`} type="number" min="1" value={row.rule?.nextNumber??1} onChange={(event)=>update(row.type,{nextNumber:Math.max(1,Number(event.target.value))})} />},{key:'padding',label:'Digits',width:'110px',render:(row)=><select aria-label={`Digits for ${row.type.name}`} value={row.rule?.padding??4} onChange={(event)=>update(row.type,{padding:Number(event.target.value)})}><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select>},{key:'preview',label:'Next proposed code',width:'230px',render:(row)=><strong className="inventory-code-preview">{row.next}</strong>},{key:'status',label:'Rule status',width:'160px',render:(row)=><button type="button" className="table-action" onClick={()=>update(row.type,{status:row.rule?.status==='Active'?'Disabled':'Active'})}>{row.rule?.status==='Disabled'?'Disabled':'Active'}</button>}]} empty={<div className="empty-state"><strong>No active asset categories</strong><p>Create an item category in the catalogue first.</p></div>}/>{legacy>0&&<p className="code-governance-footnote">{legacy} existing asset record{legacy===1?' is':'s are'} currently treated as legacy Excel codes until a category rule is saved. No existing code will be overwritten.</p>}</section>
}
