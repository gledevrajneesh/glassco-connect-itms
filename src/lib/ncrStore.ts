import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { collection, doc, onSnapshot, query, runTransaction, where } from 'firebase/firestore'
import { firestore } from './firebase'

type NcrRow={id:string;requesterEmail:string;approverEmail?:string}
const clean=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))

/** Confidential NCR records are read directly from Firestore and are never browser-cached. */
export function useNcrStore<T extends NcrRow>(email:string,operator:boolean){
  const [rows,setRows]=useState<T[]>([]);const [ready,setReady]=useState(false);const [error,setError]=useState('');const current=useRef<T[]>([]);const serial=useRef(Promise.resolve())
  useEffect(()=>{setReady(false);setRows([]);current.current=[];if(!firestore){setError('NCR requires a Firebase connection.');return}const source=operator?collection(firestore,'ncrRequests'):query(collection(firestore,'ncrRequests'),where('requesterEmail','==',email.toLowerCase()));return onSnapshot(source,snapshot=>{const next=snapshot.docs.map(entry=>({...entry.data(),id:entry.id}) as T);current.current=next;setRows(next);setReady(true);setError('')},failure=>{setReady(false);setError(failure.message)})},[email,operator])
  const save=useCallback((action:SetStateAction<T[]>):Promise<void>=>{const execute=async()=>{if(!firestore||!ready)throw new Error('NCR data is not connected yet. Please retry.');const before=current.current;const next=clean(typeof action==='function'?action(before):action);for(const row of next){const old=before.find(item=>item.id===row.id);if(JSON.stringify(old)===JSON.stringify(row))continue;await runTransaction(firestore,async transaction=>{const reference=doc(firestore!,'ncrRequests',row.id),snapshot=await transaction.get(reference);if(!old){if(snapshot.exists())throw new Error('This request already exists.');transaction.set(reference,row)}else{if(!snapshot.exists())throw new Error('This request no longer exists.');transaction.set(reference,row)}})}};const pending=serial.current.then(execute);serial.current=pending.catch(failure=>setError(failure instanceof Error?failure.message:'NCR save failed.'));return pending},[ready])
  return [rows,save,{ready,error}] as const
}
