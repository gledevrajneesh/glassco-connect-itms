import type { ReactNode } from 'react'

export type IconName = 'dashboard' | 'masters' | 'inventory' | 'allocation' | 'maintenance' | 'assurance' | 'reports' | 'history' | 'package' | 'support' | 'requests' | 'service' | 'visitor' | 'chevron' | 'arrow' | 'plus' | 'check' | 'close' | 'bell' | 'mail' | 'menu' | 'empty'

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  masters: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/><path d="M17 5h4M17 9h4M18 13h3"/></>,
  inventory: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
  allocation: <><circle cx="7" cy="7" r="3"/><path d="M2 18a5 5 0 0 1 10 0"/><path d="M14 8h7m-3-3 3 3-3 3M21 16h-7m3-3-3 3 3 3"/></>,
  maintenance: <path d="M14.5 6.5a4 4 0 0 0-5-5l2.2 2.2-3 3-2.2-2.2a4 4 0 0 0 5 5L20 18a2 2 0 1 1-3 3l-8.5-8.5a4 4 0 0 0-5-5"/>,
  assurance: <><path d="M12 3 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  package: <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z"/><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4"/></>,
  support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2ZM20 13h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2ZM17 19c-1 2-3 2-5 2"/></>,
  requests: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/></>,
  service: <><path d="M3 8h18v10H3zM7 8V5h10v3M7 13h10"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/></>,
  visitor: <><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 11l2 2 4-4"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  empty: <><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></>,
}

export default function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={`it-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
