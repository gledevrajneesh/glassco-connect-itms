import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from './firebase'

export type CloudEmailTicket = { id:string; code:string; requesterEmail:string; [key:string]:unknown }
export function subscribeEmailTickets(receive:(tickets:CloudEmailTicket[])=>void){if(!firestore)return()=>undefined;return onSnapshot(collection(firestore,'supportEmailTickets'),snapshot=>receive(snapshot.docs.flatMap(doc=>{try{return [JSON.parse(String(doc.data().payload||'{}')) as CloudEmailTicket]}catch{return []}}))) }
export async function queueSupportEmail(payload:{ticketId:string;ticketCode:string;to:string;subject:string;body:string;event:string}){if(!firestore)return false;await addDoc(collection(firestore,'supportMailQueue'),{payload:JSON.stringify(payload),ticketId:payload.ticketId,ticketCode:payload.ticketCode,recipient:payload.to,event:payload.event,status:'Queued',createdAt:new Date().toISOString()});return true}
export function subscribeMailStatus(ticketCode:string,receive:(rows:Record<string,unknown>[])=>void){if(!firestore)return()=>undefined;return onSnapshot(query(collection(firestore,'supportMailQueue'),where('ticketCode','==',ticketCode)),snapshot=>receive(snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))))}
