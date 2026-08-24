import { useEffect, useRef, useState } from 'react'
import { cloudOperationalReady, isOperationalStoreKey, subscribeOperationalStore, syncOperationalStore } from './cloudStore'

export function useLocalStore<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })
  const [cloudEpoch, setCloudEpoch] = useState(0)
  const isArrayStore = Array.isArray(initialValue)
  const cloudActive = useRef(false)
  const lastCloudValue = useRef('')

  useEffect(() => {
    const activate = () => setCloudEpoch((current) => current + 1)
    window.addEventListener('itms-cloud-migrated', activate)
    return () => window.removeEventListener('itms-cloud-migrated', activate)
  }, [])

  useEffect(() => {
    if (!isArrayStore || !isOperationalStoreKey(key) || !cloudOperationalReady()) return
    let cancelled = false
    let unsubscribe: () => void = () => undefined
    void subscribeOperationalStore<unknown>(key, (records) => {
      if (cancelled) return
      lastCloudValue.current = JSON.stringify(records)
      cloudActive.current = true
      setValue(records as T)
    }).then((stop) => { if (cancelled) stop(); else unsubscribe = stop })
    return () => { cancelled = true; cloudActive.current = false; unsubscribe() }
  }, [cloudEpoch, isArrayStore, key])

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
    if (Array.isArray(value) && isOperationalStoreKey(key) && cloudActive.current) {
      const serialized = JSON.stringify(value)
      if (serialized !== lastCloudValue.current) {
        lastCloudValue.current = serialized
        void syncOperationalStore(key, value as Record<string, unknown>[]).catch((error) => window.dispatchEvent(new CustomEvent('itms-cloud-error', { detail: error instanceof Error ? error.message : 'Cloud synchronization failed' })))
      }
    }
  }, [key, value])

  return [value, setValue] as const
}
