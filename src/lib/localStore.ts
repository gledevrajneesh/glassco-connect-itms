import { useEffect, useRef, useState } from 'react'
import { cloudOperationalReady, isOperationalStoreKey, isSharedValueStoreKey, subscribeOperationalStore, subscribeSharedValueStore, syncOperationalStore, syncSharedValueStore } from './cloudStore'

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
  const isSharedValue = isSharedValueStoreKey(key)
  const cloudActive = useRef(false)
  const lastCloudValue = useRef('')

  useEffect(() => {
    const activate = () => setCloudEpoch((current) => current + 1)
    window.addEventListener('itms-cloud-migrated', activate)
    return () => window.removeEventListener('itms-cloud-migrated', activate)
  }, [])

  useEffect(() => {
    if ((!isArrayStore || !isOperationalStoreKey(key)) && !isSharedValue || !cloudOperationalReady()) return
    let cancelled = false
    let unsubscribe: () => void = () => undefined
    const receive=(records:unknown) => {
      if (cancelled) return
      lastCloudValue.current = JSON.stringify(records)
      cloudActive.current = true
      setValue(records as T)
    }
    const connect = isSharedValue
      ? subscribeSharedValueStore(key, receive, value)
      : subscribeOperationalStore<unknown>(key, receive, Array.isArray(value) ? value as Record<string, unknown>[] : [])
    void connect.then((stop) => { if (cancelled) stop(); else unsubscribe = stop }).catch((error) => {
      window.dispatchEvent(new CustomEvent('itms-cloud-error', { detail: error instanceof Error ? error.message : 'Cloud synchronization failed' }))
    })
    return () => { cancelled = true; cloudActive.current = false; unsubscribe() }
  }, [cloudEpoch, isArrayStore, isSharedValue, key])

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
    if (((Array.isArray(value) && isOperationalStoreKey(key)) || isSharedValue) && cloudActive.current) {
      const serialized = JSON.stringify(value)
      if (serialized !== lastCloudValue.current) {
        lastCloudValue.current = serialized
        const request=isSharedValue?syncSharedValueStore(key,value):syncOperationalStore(key as Parameters<typeof syncOperationalStore>[0], value as Record<string, unknown>[])
        void request.catch((error) => window.dispatchEvent(new CustomEvent('itms-cloud-error', { detail: error instanceof Error ? error.message : 'Cloud synchronization failed' })))
      }
    }
  }, [isSharedValue, key, value])

  return [value, setValue] as const
}
