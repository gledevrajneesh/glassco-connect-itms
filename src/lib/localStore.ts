import { useEffect, useRef, useState } from 'react'
import { cloudOperationalReady, isOperationalStoreKey, isSharedValueStoreKey, subscribeOperationalStore, subscribeSharedValueStore, syncOperationalStore, syncSharedValueStore } from './cloudStore'

export function useLocalStore<T>(key: string, initialValue: T) {
  const isArrayStore = Array.isArray(initialValue)
  const isSharedValue = isSharedValueStoreKey(key)
  const isCloudManagedStore = (isArrayStore && isOperationalStoreKey(key)) || isSharedValue
  const legacyBrowserSeed = useRef<T | undefined>(undefined)
  if (legacyBrowserSeed.current === undefined) {
    try {
      const stored = window.localStorage.getItem(key)
      legacyBrowserSeed.current = stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      legacyBrowserSeed.current = initialValue
    }
  }
  const [value, setValue] = useState<T>(() => {
    // Once a business store is cloud-managed, Firestore is its source of truth.
    // Do not briefly render a stale browser copy while the subscription connects.
    if (isCloudManagedStore && cloudOperationalReady()) return initialValue
    return legacyBrowserSeed.current as T
  })
  const [cloudEpoch, setCloudEpoch] = useState(0)
  const cloudActive = useRef(false)
  const lastCloudValue = useRef('')

  useEffect(() => {
    const activate = () => setCloudEpoch((current) => current + 1)
    window.addEventListener('itms-cloud-migrated', activate)
    return () => window.removeEventListener('itms-cloud-migrated', activate)
  }, [])

  useEffect(() => {
    if (!isCloudManagedStore || !cloudOperationalReady()) return
    let cancelled = false
    let unsubscribe: () => void = () => undefined
    const receive=(records:unknown) => {
      if (cancelled) return
      lastCloudValue.current = JSON.stringify(records)
      cloudActive.current = true
      setValue(records as T)
    }
    const connect = isSharedValue
      ? subscribeSharedValueStore(key, receive, legacyBrowserSeed.current as T)
      : subscribeOperationalStore<unknown>(key, receive, Array.isArray(legacyBrowserSeed.current) ? legacyBrowserSeed.current as Record<string, unknown>[] : [])
    void connect.then((stop) => { if (cancelled) stop(); else unsubscribe = stop }).catch((error) => {
      window.dispatchEvent(new CustomEvent('itms-cloud-error', { detail: error instanceof Error ? error.message : 'Cloud synchronization failed' }))
    })
    return () => { cancelled = true; cloudActive.current = false; unsubscribe() }
  }, [cloudEpoch, isCloudManagedStore, isSharedValue, key])

  useEffect(() => {
    // Browser storage is only a convenience cache for UI state and drafts.
    // Operational and shared business data is intentionally never mirrored back.
    if (!isCloudManagedStore) window.localStorage.setItem(key, JSON.stringify(value))
    if (isCloudManagedStore && cloudActive.current) {
      const serialized = JSON.stringify(value)
      if (serialized !== lastCloudValue.current) {
        lastCloudValue.current = serialized
        const request=isSharedValue?syncSharedValueStore(key,value):syncOperationalStore(key as Parameters<typeof syncOperationalStore>[0], value as Record<string, unknown>[])
        void request.catch((error) => window.dispatchEvent(new CustomEvent('itms-cloud-error', { detail: error instanceof Error ? error.message : 'Cloud synchronization failed' })))
      }
    }
  }, [isCloudManagedStore, isSharedValue, key, value])

  return [value, setValue] as const
}
