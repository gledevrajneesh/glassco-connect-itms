import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { collection, doc, onSnapshot, query, runTransaction, where } from 'firebase/firestore'
import { firestore } from './firebase'

type Row = { id: string; requesterEmail: string; messages?: { visibility: string }[] }
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function mergeEventRows(serverValue: unknown, intendedValue: unknown) {
  if (!Array.isArray(serverValue) || !Array.isArray(intendedValue)) return intendedValue
  const rows = [...serverValue]
  const seen = new Set(rows.map(row => JSON.stringify(row)))
  for (const row of intendedValue) {
    const key = JSON.stringify(row)
    if (!seen.has(key)) { rows.push(row); seen.add(key) }
  }
  return rows
}

/** Shared support records. No browser cache is used for confidential ticket data. */
export function useSupportStore<T extends Row>(name: 'supportTickets' | 'supportRatings' | 'supportRequests', email: string, agent: boolean) {
  const [rows, setRows] = useState<T[]>([])
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const current = useRef<T[]>([])
  const serial = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    setReady(false); setRows([]); current.current = []
    if (!firestore) { setError('Support Desk requires a Firebase connection.'); return }
    let publicRows: T[] = []
    let notes = new Map<string, NonNullable<T['messages']>>()
    const publish = () => {
      const next = publicRows.map(row => name === 'supportTickets' && agent
        ? { ...row, messages: [...(row.messages || []), ...(notes.get(row.id) || [])] } : row)
      current.current = next; setRows(next)
    }
    const base = collection(firestore, name)
    const stop = onSnapshot(agent ? base : query(base, where('requesterEmail', '==', email.toLowerCase())), snapshot => {
      publicRows = snapshot.docs.map(entry => ({ ...entry.data(), id: entry.id }) as T)
      publish(); setReady(true); setError('')
    }, failure => { setReady(false); setError(failure.message) })
    const stopNotes = agent && name === 'supportTickets' ? onSnapshot(collection(firestore, 'supportPrivateNotes'), snapshot => {
      notes = new Map(snapshot.docs.map(entry => [entry.id, entry.data().messages || []])); publish()
    }, failure => setError(failure.message)) : () => undefined
    return () => { stop(); stopNotes() }
  }, [name, email, agent])

  const save = useCallback((action: SetStateAction<T[]>): Promise<void> => {
    const execute = async () => {
      if (!firestore || !ready) throw new Error('Ticket data is not connected yet. Please retry after it loads.')
      const before = current.current
      const next = clean(typeof action === 'function' ? action(before) : action)
      for (const row of next) {
        const old = before.find(item => item.id === row.id)
        if (JSON.stringify(old) === JSON.stringify(row)) continue
        const publicRow = { ...row }
        const privateMessages = row.messages?.filter(message => message.visibility === 'internal') || []
        if (name === 'supportTickets') publicRow.messages = row.messages?.filter(message => message.visibility !== 'internal') || []
        await runTransaction(firestore, async transaction => {
          const reference = doc(firestore!, name, row.id)
          const snapshot = await transaction.get(reference)
          const oldPrivate = old?.messages?.filter(message => message.visibility === 'internal') || []
          const notesChanged = agent && name === 'supportTickets' && JSON.stringify(privateMessages) !== JSON.stringify(oldPrivate)
          if (notesChanged) {
            const storedNotes = await transaction.get(doc(firestore!, 'supportPrivateNotes', row.id))
            if (JSON.stringify(storedNotes.data()?.messages || []) !== JSON.stringify(oldPrivate)) throw new Error('Private notes changed. Please review the latest notes and retry.')
          }
          if (!old) {
            if (snapshot.exists()) throw new Error('This record already exists. Refresh and retry.')
            transaction.set(reference, publicRow)
          } else {
            if (!snapshot.exists()) throw new Error('This record no longer exists.')
            const patch: Record<string, unknown> = {}
            const oldPublic = { ...old, ...(name === 'supportTickets' ? { messages: old.messages?.filter(message => message.visibility !== 'internal') || [] } : {}) }
            for (const key of new Set([...Object.keys(oldPublic), ...Object.keys(publicRow)])) {
              const field = key as keyof T
              if (JSON.stringify(oldPublic[field]) === JSON.stringify(publicRow[field])) continue
              const serverValue = snapshot.data()[key]
              const changedRemotely = JSON.stringify(serverValue) !== JSON.stringify(oldPublic[field])
              // Mailbox automation and another open browser may legitimately append activity
              // between snapshot delivery and this transaction. Rebase append-only records on
              // the newest server value instead of blocking the operator with a false conflict.
              patch[key] = changedRemotely && (key === 'history' || key === 'messages')
                ? mergeEventRows(serverValue, publicRow[field])
                : publicRow[field] ?? null
            }
            transaction.update(reference, patch)
          }
          if (notesChanged) {
            transaction.set(doc(firestore!, 'supportPrivateNotes', row.id), { messages: privateMessages, updatedBy: email })
          }
        })
      }
    }
    const pending = serial.current.then(execute)
    serial.current = pending.catch(failure => { setError(failure instanceof Error ? failure.message : 'Saving failed.') })
    return pending
  }, [name, email, agent, ready])
  return [rows, save, { ready, error }] as const
}
