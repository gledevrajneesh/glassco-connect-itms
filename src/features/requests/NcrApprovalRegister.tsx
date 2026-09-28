import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import type { NcrRequest } from "./ConsumableRequests";
import NcrRequestDetail from "./NcrRequestDetail";
import "./NcrDataRegister.css";
import "./NcrDecision.css";

const money=(value:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value);

type Decision="Returned for correction"|"Rejected"|"Approved";
export default function NcrApprovalRegister({rows,onDecision}:{rows:NcrRequest[];onDecision:(row:NcrRequest,state:Decision,note:string)=>void}){
  const [search,setSearch]=useState(""); const [item,setItem]=useState("All"); const [from,setFrom]=useState(""); const [to,setTo]=useState(""); const [sort,setSort]=useState("newest");
  const [selected,setSelected]=useState<NcrRequest|null>(null); const [decision,setDecision]=useState<{row:NcrRequest;state:Decision}|null>(null); const [note,setNote]=useState("");
  const items=[...new Set(rows.flatMap(row=>row.items.map(line=>line.group)).filter(Boolean))].sort();
  const visible=useMemo(()=>{const term=search.trim().toLowerCase();return rows.filter(row=>(item==="All"||row.items.some(line=>line.group===item))&&(!from||row.createdAt.slice(0,10)>=from)&&(!to||row.createdAt.slice(0,10)<=to)&&(!term||`${row.code} ${row.requesterName} ${row.requesterEmail} ${row.departmentName} ${row.purpose} ${row.items.map(line=>`${line.group} ${line.description} ${line.specification}`).join(" ")}`.toLowerCase().includes(term))).sort((a,b)=>sort==="oldest"?a.createdAt.localeCompare(b.createdAt):sort==="value"?b.estimatedTotal-a.estimatedTotal:b.createdAt.localeCompare(a.createdAt))},[rows,search,item,from,to,sort]);
  return <section className="ncr-register">
    <header className="ncr-register-title"><div><strong>Pending department approvals</strong><small>{visible.length} of {rows.length} requests awaiting decision</small></div></header>
    <div className="ncr-register-controls">
      <label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Request, raiser, email, department or item"/></label>
      <label>Item<select value={item} onChange={e=>setItem(e.target.value)}><option>All</option>{items.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="value">Highest value</option></select></label>
      <button onClick={()=>{setSearch("");setItem("All");setFrom("");setTo("");setSort("newest")}}>Clear</button>
    </div>
    <div className="ncr-register-table">
      <header><span>Request / date</span><span>Raiser / department</span><span>Item details</span><span>Required / value</span><span>Status</span><span>Actions</span></header>
      {visible.map(row=><article key={row.id}>
        <span><strong>{row.code}</strong><small>{row.createdAt.slice(0,10)}</small></span>
        <span><strong>{row.requesterName}</strong><small>{row.departmentName}</small></span>
        <span><strong>{row.items.length} item{row.items.length===1?"":"s"}</strong><small title={row.items.map(line=>line.description).join(" · ")}>{row.items.map(line=>line.description).join(" · ")}</small></span>
        <span><strong>{row.requiredBy||"Not set"}</strong><small>{money(row.estimatedTotal)}</small></span>
        <b>{row.state}</b>
        <span className="ncr-row-actions"><button onClick={()=>setSelected(row)}>View</button><button onClick={()=>{setDecision({row,state:"Returned for correction"});setNote("")}}>Ask / return</button><button className="reject" onClick={()=>{setDecision({row,state:"Rejected"});setNote("")}}>Reject</button><button className="approve" onClick={()=>{setDecision({row,state:"Approved"});setNote("")}}>Approve</button></span>
      </article>)}
      {!visible.length&&<div className="ncr-empty"><Icon name="check" size={30}/><strong>No approvals match the filters</strong></div>}
    </div>
    {selected&&<NcrRequestDetail request={selected} onClose={()=>setSelected(null)}/>} 
    {decision&&<div className="ncr-decision-backdrop"><form className="ncr-decision" onSubmit={e=>{e.preventDefault();if(!note.trim())return;onDecision(decision.row,decision.state,note.trim());setDecision(null)}}><h3>{decision.state}: {decision.row.code}</h3><p>Enter a mandatory decision remark. It will be stored in the audit trail and included in the notification.</p><textarea autoFocus value={note} onChange={e=>setNote(e.target.value)} placeholder="Decision reason, instruction or approval note" required/><footer><button type="button" onClick={()=>setDecision(null)}>Cancel</button><button className={decision.state==="Approved"?"approve":"reject"} type="submit">Confirm {decision.state.toLowerCase()}</button></footer></form></div>}
  </section>
}
