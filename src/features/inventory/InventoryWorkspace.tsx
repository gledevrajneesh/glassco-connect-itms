import { useState } from 'react'
import AssetCatalogue from '../catalogue/AssetCatalogue'
import InventoryOperations from './InventoryOperations'
import AssetLabels from './AssetLabels'
import BulkDataCentre from '../masters/BulkDataCentre'
import InventoryCodeGovernance from './InventoryCodeGovernance'
import SpecificationsMaster from './SpecificationsMaster'
import InventoryImportTemplates from './InventoryImportTemplates'
import SpareCompatibilityMapping from './SpareCompatibilityMapping'
import NetworkRegister from './NetworkRegister'
import './SpecificationsMaster.css'

type InventoryTab = 'Catalogue' | 'Goods receipt' | 'Asset register' | 'Network register' | 'QR labels' | 'Code governance' | 'Specifications master' | 'Import templates' | 'Compatibility'

export default function InventoryWorkspace() {
  const qrAssetCode = new URLSearchParams(window.location.search).get('asset') || ''
  const [tab, setTab] = useState<InventoryTab>(qrAssetCode ? 'Asset register' : 'Catalogue')
  const [bulkOpen, setBulkOpen] = useState(false)

  if (bulkOpen) return <BulkDataCentre initialDataset="Assets" onClose={() => setBulkOpen(false)} />

  return <>
    <section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-03</span><h1>Asset Inventory</h1><p>Control catalogue definitions, incoming deliveries and uniquely identified IT assets.</p></div><div className="toolbar-actions"><button type="button" className="secondary-action" onClick={() => setBulkOpen(true)}>Bulk upload / templates</button><span className="phase">SHARED CLOUD INVENTORY</span></div></section>
    <nav className="workspace-tabs" aria-label="Asset inventory workspace">
      {(['Catalogue', 'Goods receipt', 'Asset register', 'Network register', 'QR labels', 'Code governance', 'Specifications master', 'Import templates', 'Compatibility'] as InventoryTab[]).map((item) => <button type="button" className={tab === item ? 'selected' : ''} aria-current={tab === item ? 'page' : undefined} key={item} onClick={() => setTab(item)}>{item}</button>)}
    </nav>
    {tab === 'Catalogue' ? <AssetCatalogue embedded /> : tab === 'Network register' ? <NetworkRegister /> : tab === 'QR labels' ? <AssetLabels /> : tab === 'Code governance' ? <InventoryCodeGovernance /> : tab === 'Specifications master' ? <SpecificationsMaster /> : tab === 'Import templates' ? <InventoryImportTemplates /> : tab === 'Compatibility' ? <SpareCompatibilityMapping /> : <InventoryOperations mode={tab} initialAssetCode={qrAssetCode} />}
  </>
}
