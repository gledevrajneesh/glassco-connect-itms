import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { collection, doc, onSnapshot, query, runTransaction, where } from 'firebase/firestore'
import { firestore } from './firebase'

type FacilitiesRow={id:string;requesterEmail:string}
const clean=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))

/** Facilities requests stay in Firestore and are never cached in browser storage. */
export function useFacilitiesStore<T extends FacilitiesRow>(email:string,operator:boolean){
  const[rows,setRows]=useState<T[]>([]),[ready,setReady]=useState(false),[error,setError]=useState('');const current=useRef<T[]>([]);const serial=useRef(Promise.resolve())
  useEffect(()=>{setReady(false);setRows([]);current.current=[];if(!firestore){setError('Facilities Support requires a Firebase connection.');return}const source=operator?collection(firestore,'facilitiesRequests'):query(collection(firestore,'facilitiesRequests'),where('requesterEmail','==',email.toLowerCase()));return onSnapshot(source,snapshot=>{const next=snapshot.docs.map(entry=>({...entry.data(),id:entry.id}) as T);current.current=next;setRows(next);setReady(true);setError('')},failure=>{setReady(false);setError(failure.message)})},[email,operator])
  const save=useCallback((action:SetStateAction<T[]>):Promise<void>=>{const execute=async()=>{if(!firestore||!ready)throw new Error('Facilities data is not connected yet.');const before=current.current,next=clean(typeof action==='function'?action(before):action);for(const row of next){const old=before.find(item=>item.id===row.id);if(JSON.stringify(old)===JSON.stringify(row))continue;await runTransaction(firestore,async transaction=>{const ref=doc(firestore!,'facilitiesRequests',row.id),snapshot=await transaction.get(ref);if(!old){if(snapshot.exists())throw new Error('This request already exists.');transaction.set(ref,row)}else{if(!snapshot.exists())throw new Error('This request no longer exists.');transaction.set(ref,row)}})}};const pending=serial.current.then(execute);serial.current=pending.catch(failure=>setError(failure instanceof Error?failure.message:'Facilities save failed.'));return pending},[ready]);return[rows,save,{ready,error}]as const
}
