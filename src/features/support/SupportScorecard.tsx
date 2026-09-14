import { useMemo } from 'react'
import type { RatingInvite } from './EmailTicketing'
import './SupportScorecard.css'

type Ticket = { id:string; code:string; title:string; assignee?:string }

function percentage(value:number,total:number){return total ? Math.round(value / total * 100) : 0}

export default function SupportScorecard({ratings,tickets,onOpenTicket}:{ratings:RatingInvite[];tickets:Ticket[];onOpenTicket:(id:string)=>void}){
  const submitted = ratings.filter((rating)=>rating.submittedAt && rating.stars)
  const average = submitted.length ? submitted.reduce((sum,rating)=>sum+(rating.stars||0),0)/submitted.length : 0
  const satisfied = submitted.filter((rating)=>(rating.stars||0)>=4).length
  const confirmed = submitted.filter((rating)=>rating.resolved).length
  const distribution = [5,4,3,2,1].map((stars)=>({stars,count:submitted.filter((rating)=>rating.stars===stars).length}))
  const owners = useMemo(()=>{
    const rows = new Map<string,{count:number;total:number}>()
    submitted.forEach((rating)=>{
      const owner=rating.assignee||rating.resolvedBy||'Unassigned'
      const row=rows.get(owner)||{count:0,total:0}; row.count+=1; row.total+=rating.stars||0; rows.set(owner,row)
    })
    return [...rows.entries()].sort((a,b)=>b[1].count-a[1].count)
  },[submitted])
  const comments=submitted.filter((rating)=>rating.comment).slice().sort((a,b)=>Date.parse(b.submittedAt||'')-Date.parse(a.submittedAt||'')).slice(0,5)

  return <section className="support-scorecard">
    <header><div><h2>Employee service ratings</h2><small>Support quality from completed feedback. No response is never counted as a zero-star rating.</small></div></header>
    <div className="scorecard-kpis">
      <article><span>Average rating</span><strong>{average ? average.toFixed(1) : '—'}<small>/5</small></strong></article>
      <article><span>Satisfied employees</span><strong>{percentage(satisfied,submitted.length)}<small>%</small></strong><small>4 or 5 stars</small></article>
      <article><span>Response rate</span><strong>{percentage(submitted.length,ratings.length)}<small>%</small></strong><small>{submitted.length} of {ratings.length} invitations</small></article>
      <article><span>Confirmed resolved</span><strong>{percentage(confirmed,submitted.length)}<small>%</small></strong><small>Employee-confirmed outcome</small></article>
    </div>
    <div className="scorecard-grid">
      <div className="score-distribution"><h3>Rating distribution</h3>{distribution.map((row)=><div key={row.stars}><span>{row.stars} ★</span><i><b style={{width:`${percentage(row.count,Math.max(...distribution.map(item=>item.count),1))}%`}}/></i><strong>{row.count}</strong></div>)}</div>
      <div className="score-owners"><h3>Support owner score</h3><div className="score-head"><span>Owner</span><span>Responses</span><span>Score</span></div>{owners.map(([owner,row])=><div key={owner}><strong>{owner}</strong><span>{row.count}</span><span>{(row.total/row.count).toFixed(1)} ★</span></div>)}{!owners.length&&<p>No submitted ratings yet.</p>}</div>
    </div>
    {comments.length>0&&<div className="score-comments"><h3>Recent employee comments</h3>{comments.map((rating)=>{const ticket=tickets.find((item)=>item.id===rating.ticketId);return <button key={rating.id} type="button" onClick={()=>onOpenTicket(rating.ticketId)}><span><strong>{rating.stars} ★ · {rating.ticketCode}</strong><small>{rating.requesterEmail}</small></span><q>{rating.comment}</q><em>{ticket?.title||'Open ticket'}</em></button>})}</div>}
  </section>
}
