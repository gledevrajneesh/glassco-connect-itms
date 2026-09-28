import { collection,doc,onSnapshot,query,setDoc,where } from 'firebase/firestore'
import { useEffect,useState } from 'react'
import { firestore } from './firebase'

export type FacilitiesRating={requestId:string;requestCode:string;requesterEmail:string;stars:number;comment:string;submittedAt:string}

export function useFacilitiesRatings(email:string,operator:boolean){
 const[ratings,setRatings]=useState<FacilitiesRating[]>([])
 useEffect(()=>{if(!firestore)return;const source=operator?collection(firestore,'facilitiesRatings'):query(collection(firestore,'facilitiesRatings'),where('requesterEmail','==',email.toLowerCase()));return onSnapshot(source,snapshot=>setRatings(snapshot.docs.map(item=>item.data() as FacilitiesRating)),()=>setRatings([]))},[email,operator])
 return ratings
}

export async function submitFacilitiesRating(rating:FacilitiesRating){
 if(!firestore)throw new Error('Facilities feedback requires a Firebase connection.')
 await setDoc(doc(firestore,'facilitiesRatings',rating.requestId),rating)
}
