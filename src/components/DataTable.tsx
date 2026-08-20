import type { ReactNode } from 'react'

export type DataColumn<T> = { key: string; label: string; render: (row: T) => ReactNode; sticky?: boolean; width?: string }

export default function DataTable<T>({ columns, rows, rowKey, empty }: { columns: DataColumn<T>[]; rows: T[]; rowKey: (row: T) => string; empty: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>
  return <div className="data-table-scroll" role="region" aria-label="Master data table" tabIndex={0}>
    <table className="data-table">
      <thead><tr>{columns.map((column) => <th className={column.sticky ? 'sticky-column' : ''} style={{ minWidth: column.width }} scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td className={column.sticky ? 'sticky-column' : ''} key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
  </div>
}
