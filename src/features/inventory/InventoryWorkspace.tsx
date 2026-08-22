import { useState } from 'react'
import AssetCatalogue from '../catalogue/AssetCatalogue'
import InventoryOperations from './InventoryOperations'
import AssetLabels from './AssetLabels'

type InventoryTab = 'Catalogue' | 'Goods receipt' | 'Asset register' | 'QR labels'

export default function InventoryWorkspace() {
  const [tab, setTab] = useState<InventoryTab>('Catalogue')

  return <>
    <section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-03</span><h1>Asset Inventory</h1><p>Control catalogue definitions, incoming deliveries and uniquely identified IT assets.</p></div><span className="phase">LOCALHOST INVENTORY</span></section>
    <nav className="workspace-tabs" aria-label="Asset inventory workspace">
      {(['Catalogue', 'Goods receipt', 'Asset register', 'QR labels'] as InventoryTab[]).map((item) => <button type="button" className={tab === item ? 'selected' : ''} aria-current={tab === item ? 'page' : undefined} key={item} onClick={() => setTab(item)}>{item}</button>)}
    </nav>
    {tab === 'Catalogue' ? <AssetCatalogue embedded /> : tab === 'QR labels' ? <AssetLabels /> : <InventoryOperations mode={tab} />}
  </>
}
