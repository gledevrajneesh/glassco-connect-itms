import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import DataTable from '../../components/DataTable'
import { useLocalStore } from '../../lib/localStore'

type Asset = { id: string; assetId: string; typeId: string; modelId: string; serialNumber: string; stockStatus: string }
type AssetType = { id: string; code: string; name: string }
type Model = { id: string; brand: string; name: string }
type PrintEvent = { id: string; assetIds: string[]; format: string; printedAt: string; printedBy: string; reason: string }
const ASSET_PROFILE_BASE = 'https://itms.glasscolabs.com/assets/'

export default function AssetLabels() {
  const [assets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [types] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [models] = useLocalStore<Model[]>('itms.asset-models.v1', [])
  const [events, setEvents] = useLocalStore<PrintEvent[]>('itms.asset-label-events.v1', [])
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [format, setFormat] = useState<'Compact 50 × 25 mm' | 'Standard 70 × 40 mm'>('Standard 70 × 40 mm')
  const [reason, setReason] = useState('Initial label issue')
  const [codes, setCodes] = useState<Record<string, string>>({})
  const visible = useMemo(() => { const query = search.trim().toLowerCase(); return assets.filter((asset) => { const model = models.find((item) => item.id === asset.modelId); return (category === 'all' || asset.typeId === category) && (!query || `${asset.assetId} ${asset.serialNumber} ${model?.brand ?? ''} ${model?.name ?? ''}`.toLowerCase().includes(query)) }) }, [assets, category, models, search])
  const printAssets = useMemo(() => assets.filter((asset) => selected.includes(asset.id)), [assets, selected])
  useEffect(() => { let live = true; Promise.all(printAssets.map(async (asset) => [asset.id, await QRCode.toDataURL(`${ASSET_PROFILE_BASE}${encodeURIComponent(asset.assetId)}`, { errorCorrectionLevel: 'M', margin: 1, width: 260 })] as const)).then((entries) => { if (live) setCodes(Object.fromEntries(entries)) }); return () => { live = false } }, [printAssets])
  function modelLabel(asset: Asset) { const model = models.find((item) => item.id === asset.modelId); return model ? `${model.brand} ${model.name}` : 'Model unavailable' }
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  function printLabels() { if (!printAssets.length) return; setEvents((current) => [...current, { id: crypto.randomUUID(), assetIds: printAssets.map((asset) => asset.id), format, printedAt: new Date().toISOString(), printedBy: 'dev@glasscolabs.com', reason }]); setTimeout(() => window.print(), 80) }
  return <section className="master-panel label-workspace"><div className="operation-heading"><div><span className="eyebrow">CONTROLLED ASSET IDENTITY</span><h2>QR asset labels</h2><p>Generate scannable labels without exposing employee, financial or credential data.</p></div><button className="primary-action" type="button" disabled={!selected.length} onClick={printLabels}>Print {selected.length || ''} label{selected.length === 1 ? '' : 's'}</button></div>
    <div className="asset-register-filters"><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Asset ID, serial, brand or model" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{types.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Label format<select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}><option>Compact 50 × 25 mm</option><option>Standard 70 × 40 mm</option></select></label><label>Print reason<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Initial label issue</option><option>Damaged label replacement</option><option>Lost label replacement</option><option>Bulk relabelling</option></select></label></div>
    <div className="label-selection-bar"><span><strong>{selected.length}</strong> selected of {visible.length} visible</span><div><button type="button" onClick={() => setSelected((current) => [...new Set([...current, ...visible.map((item) => item.id)])])}>Select visible</button><button type="button" onClick={() => setSelected([])}>Clear selection</button></div></div>
    <DataTable rows={visible} rowKey={(item) => item.id} columns={[{ key: 'select', label: 'Print', sticky: true, width: '80px', render: (item) => <input aria-label={`Select ${item.assetId}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /> }, { key: 'asset', label: 'Asset ID', width: '190px', render: (item) => <strong>{item.assetId}</strong> }, { key: 'category', label: 'Category', width: '190px', render: (item) => types.find((type) => type.id === item.typeId)?.name ?? 'Unavailable' }, { key: 'model', label: 'Brand / model', width: '230px', render: modelLabel }, { key: 'serial', label: 'Serial', width: '170px', render: (item) => item.serialNumber || 'Not applicable' }, { key: 'status', label: 'Status', width: '160px', render: (item) => item.stockStatus }, { key: 'preview', label: 'QR target', width: '340px', render: (item) => `${ASSET_PROFILE_BASE}${item.assetId}` }]} empty={<div className="empty-state"><strong>No assets available</strong><p>Register assets before generating labels.</p></div>} />
    <section className="label-audit"><h3>Label print history</h3><DataTable rows={[...events].reverse()} rowKey={(item) => item.id} columns={[{ key: 'time', label: 'Printed', sticky: true, width: '190px', render: (item) => new Date(item.printedAt).toLocaleString('en-IN') }, { key: 'count', label: 'Labels', width: '90px', render: (item) => item.assetIds.length }, { key: 'format', label: 'Format', width: '190px', render: (item) => item.format }, { key: 'reason', label: 'Reason', width: '220px', render: (item) => item.reason }, { key: 'actor', label: 'Printed by', width: '220px', render: (item) => item.printedBy }]} empty={<div className="empty-state"><strong>No labels printed</strong><p>Every initial print and reprint will be recorded here.</p></div>} /></section>
    <div className={`asset-label-print ${format.startsWith('Compact') ? 'compact' : 'standard'}`}>{printAssets.map((asset) => <article key={asset.id}><header><strong>GLASSCO</strong><span>IT ASSET</span></header><div><img src={codes[asset.id]} alt="" /><section><b>{asset.assetId}</b><span>{types.find((item) => item.id === asset.typeId)?.name}</span><span>{modelLabel(asset)}</span><small>S/N: {asset.serialNumber || 'N/A'}</small></section></div><footer>Property of Glassco · Scan for controlled record</footer></article>)}</div>
  </section>
}
