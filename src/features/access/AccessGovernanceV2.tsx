import { useEffect, useMemo, useState } from 'react'
import DataTable from '../../components/DataTable'
import Icon from '../../components/Icon'
import { moduleNames, roleById, roles, type RoleId } from '../../lib/accessControl'
import { useLocalStore } from '../../lib/localStore'
import { loadCentralAssignments, loadCentralEvents, saveCentralAssignment, saveCentralEvent } from '../../lib/centralAccess'
import './AccessGovernance.css'

type AccessState = 'Active' | 'Suspended' | 'Archived'
export type AccessAssignment = { id:string; name:string; email:string; roleId:RoleId; roleIds?:RoleId[]; status:AccessState; updatedAt:string; updatedBy:string }
type AccessEvent = { id:string; principal:string; before:string; after:string; action:string; actor:string; at:string }
type UserDraft = { id?:string; name:string; email:string; roleIds:RoleId[]; status:'Active'|'Suspended' }
const stamp=new Date().toISOString()
const seed:AccessAssignment[]=[
  {id:'dev',name:'Development Administrator',email:'dev@glasscolabs.com',roleId:'administrator',roleIds:['administrator'],status:'Active',updatedAt:stamp,updatedBy:'System seed'},
  {id:'asset-manager',name:'IT Asset Manager',email:'asset.manager@glasscolabs.com',roleId:'asset-manager',roleIds:['asset-manager'],status:'Active',updatedAt:stamp,updatedBy:'System seed'},
  {id:'it-head',name:'IT Head',email:'it.head@glasscolabs.com',roleId:'it-head',roleIds:['it-head'],status:'Active',updatedAt:stamp,updatedBy:'System seed'},
  {id:'auditor',name:'Independent Auditor',email:'auditor@example.test',roleId:'auditor',roleIds:['auditor'],status:'Active',updatedAt:stamp,updatedBy:'System seed'},
  {id:'dept-manager',name:'Department Manager',email:'department.manager@glasscolabs.com',roleId:'department-manager',roleIds:['department-manager'],status:'Active',updatedAt:stamp,updatedBy:'System seed'},
  {id:'standard-user',name:'Standard Employee',email:'employee@example.test',roleId:'standard-user',roleIds:['standard-user'],status:'Active',updatedAt:stamp,updatedBy:'System seed'},
  {id:'bootstrap-sanjay',name:'Sanjay',email:'sanjay@glasscolabs.com',roleId:'standard-user',roleIds:['standard-user'],status:'Active',updatedAt:stamp,updatedBy:'dev@glasscolabs.com'},
  {id:'bootstrap-vikas',name:'Vikas',email:'vikas@glasscolabs.com',roleId:'standard-user',roleIds:['standard-user'],status:'Active',updatedAt:stamp,updatedBy:'dev@glasscolabs.com'},
]
const blankDraft=():UserDraft=>({name:'',email:'',roleIds:['standard-user'],status:'Active'})
const assignedRoles=(assignment:AccessAssignment)=>assignment.roleIds?.length?assignment.roleIds:[assignment.roleId]
const roleSummary=(roleIds:RoleId[])=>roleIds.map(id=>roleById(id).name).join(', ')
const effectiveModules=(roleIds:RoleId[])=>moduleNames.filter(module=>roleIds.some(id=>roleById(id).modules.includes(module)))

export default function AccessGovernanceV2({activeRole}:{activeRole:RoleId}){
  const [assignments,setAssignments]=useLocalStore<AccessAssignment[]>('itms.access-assignments.v1',seed)
  const [events,setEvents]=useLocalStore<AccessEvent[]>('itms.access-events.v1',[])
  const [migrationAssignments]=useState(assignments)
  const [history,setHistory]=useState(false)
  const [showArchived,setShowArchived]=useState(false)
  const [showRoleGuide,setShowRoleGuide]=useState(false)
  const [showAdvancedRoles,setShowAdvancedRoles]=useState(false)
  const [draft,setDraft]=useState<UserDraft|null>(null)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [centralReady,setCentralReady]=useState(false)
  const editable=activeRole==='administrator'
  const visibleAssignments=useMemo(()=>assignments.filter(item=>showArchived||item.status!=='Archived'),[assignments,showArchived])
  useEffect(()=>{if(!editable)return;let active=true;(async()=>{try{const remote=await loadCentralAssignments();if(!active)return;if(remote.length)setAssignments(remote);else await Promise.all(migrationAssignments.map(item=>saveCentralAssignment(item)));const remoteEvents=await loadCentralEvents();if(active&&remoteEvents.length)setEvents(remoteEvents);if(active){setCentralReady(true);setMessage(remote.length?'Central access register synchronised.':'Existing access register migrated to central Firebase control.')}}catch{if(active)setError('Central access register is not available yet. Local changes will not authorise other devices.')}})();return()=>{active=false}} ,[editable,migrationAssignments,setAssignments,setEvents])
  const record=async(principal:string,before:string,after:string,action:string,at=new Date().toISOString())=>{const event={id:crypto.randomUUID(),principal,before,after,action,actor:'dev@glasscolabs.com',at};setEvents(current=>[...current,event]);await saveCentralEvent(event)}
  function startEdit(assignment?:AccessAssignment){if(!editable)return;setError('');setMessage('');setShowAdvancedRoles(Boolean(assignment&&assignedRoles(assignment).length>1));setDraft(assignment?{id:assignment.id,name:assignment.name,email:assignment.email,roleIds:assignedRoles(assignment),status:assignment.status==='Suspended'?'Suspended':'Active'}:blankDraft())}
  function toggleRole(roleId:RoleId){setDraft(current=>current?{...current,roleIds:current.roleIds.includes(roleId)?current.roleIds.filter(id=>id!==roleId):[...current.roleIds,roleId]}:current)}
  async function saveUser(){
    if(!editable||!draft)return
    const name=draft.name.trim(),email=draft.email.trim().toLowerCase()
    if(!name||!/^\S+@\S+\.\S+$/.test(email)){setError('Enter a valid user name and email address.');return}
    if(!draft.roleIds.length){setError('Assign at least one role, or archive the user to revoke all access.');return}
    if(assignments.some(item=>item.email.toLowerCase()===email&&item.id!==draft.id)){setError('This email address already exists in the access register.');return}
    const at=new Date().toISOString()
    if(draft.id){
      const before=assignments.find(item=>item.id===draft.id);if(!before)return
      const next:AccessAssignment={...before,name,email,roleId:draft.roleIds[0],roleIds:draft.roleIds,status:draft.status,updatedAt:at,updatedBy:'dev@glasscolabs.com'}
      try{await saveCentralAssignment(next,before.email)}catch{setError('The central access record could not be saved. No login authority was changed.');return}
      setAssignments(current=>current.map(item=>item.id===draft.id?next:item))
      await record(before.email,`${before.name} · ${roleSummary(assignedRoles(before))} · ${before.status}`,`${next.name} · ${roleSummary(next.roleIds??[])} · ${next.status}`,'User details and roles updated',at)
      setMessage(`${email} updated with an immutable access event.`)
    }else{
      const created:AccessAssignment={id:crypto.randomUUID(),name,email,roleId:draft.roleIds[0],roleIds:draft.roleIds,status:draft.status,updatedAt:at,updatedBy:'dev@glasscolabs.com'}
      try{await saveCentralAssignment(created)}catch{setError('The central access record could not be saved. No login authority was created.');return}
      setAssignments(current=>[...current,created]);await record(email,'Not registered',`${name} · ${roleSummary(draft.roleIds)} · ${draft.status}`,'User added',at);setMessage(`${email} added to the central controlled access register.`)
    }
    setDraft(null);setError('')
  }
  async function changeState(assignment:AccessAssignment,status:AccessState){if(!editable||assignment.id==='dev')return;const at=new Date().toISOString();const next={...assignment,status,updatedAt:at,updatedBy:'dev@glasscolabs.com'};try{await saveCentralAssignment(next)}catch{setError('The central access state could not be changed.');return}setAssignments(current=>current.map(item=>item.id===assignment.id?next:item));await record(assignment.email,assignment.status,status,status==='Archived'?'User archived and all access revoked':'Access state changed',at);setMessage(status==='Archived'?`${assignment.email} archived; its history has been retained.`:`${assignment.email} access changed to ${status}.`)}
  return <>
    <section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-17</span><h1>User access</h1><p>Add users, choose their access level and control whether they can sign in.</p></div><span className="phase">CONTROLLED ACCESS</span></section>
    <section className="master-panel">
      <div className="master-toolbar access-toolbar"><div><span className="eyebrow">ACCESS REGISTER</span><h2>{history?'Access history':'Users and permissions'}</h2><p>{history?'A permanent record of permission changes.':'Select a user to edit their access.'}</p></div><div className="toolbar-actions"><button type="button" className="secondary-action" onClick={()=>setShowRoleGuide(value=>!value)}>{showRoleGuide?'Hide access guide':'Access guide'}</button><button type="button" className="secondary-action" onClick={()=>setHistory(!history)}><Icon name="history" size={17}/>{history?'Back to users':'History'}</button>{editable&&!history&&<button type="button" className="primary-action" onClick={()=>startEdit()}><Icon name="plus" size={17}/>Add user</button>}</div></div>
      {showRoleGuide&&<div className="access-guide">{roles.map(role=><article key={role.id}><strong>{role.name}</strong><span>{role.description}</span><small>{role.modules.length?`${role.modules.length} modules`:'Portal profile only'}</small></article>)}</div>}
      {!editable&&<div className="access-warning">Read-only: only an Administrator may change users, roles or access.</div>}{editable&&!centralReady&&!error&&<div className="access-warning">Connecting to the central access register…</div>}{message&&<div className="success-message"><Icon name="check" size={17}/>{message}</div>}
      {draft&&<div className="access-editor"><div className="access-editor-heading"><div><span className="eyebrow">{draft.id?'EDIT USER':'NEW USER'}</span><h3>{draft.id?'Update user access':'Add user access'}</h3></div><button type="button" className="editor-close" onClick={()=>setDraft(null)} aria-label="Close editor"><Icon name="close" size={18}/></button></div><div className="access-fields"><label>User name<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label><label>Business email<input type="email" value={draft.email} onChange={event=>setDraft({...draft,email:event.target.value})}/></label><label>Access state<select value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value as UserDraft['status']})}><option>Active</option><option>Suspended</option></select></label><label className="access-level-field">Access level<select value={draft.roleIds[0]} onChange={event=>setDraft({...draft,roleIds:[event.target.value as RoleId,...draft.roleIds.filter(id=>id!==event.target.value)]})}>{roles.map(role=><option value={role.id} key={role.id}>{role.name}</option>)}</select><small>{roleById(draft.roleIds[0]).description}</small></label></div><button type="button" className="advanced-role-toggle" onClick={()=>setShowAdvancedRoles(value=>!value)}>{showAdvancedRoles?'Hide additional roles':'Add another role (advanced)'}</button>{showAdvancedRoles&&<fieldset className="role-picker compact"><legend>Additional roles</legend>{roles.filter(role=>role.id!==draft.roleIds[0]).map(role=><label className={draft.roleIds.includes(role.id)?'selected':''} key={role.id}><input type="checkbox" checked={draft.roleIds.includes(role.id)} onChange={()=>toggleRole(role.id)}/><span><strong>{role.name}</strong></span></label>)}</fieldset>}<div className="effective-preview"><strong>Access summary</strong><span>{effectiveModules(draft.roleIds).length?`${effectiveModules(draft.roleIds).length} ITMS modules available`:'Portal profile only; no ITMS operational modules'}</span></div>{error&&<div className="access-error">{error}</div>}<div className="editor-actions"><button type="button" className="secondary-action" onClick={()=>setDraft(null)}>Cancel</button><button type="button" className="primary-action" onClick={saveUser}><Icon name="check" size={17}/>{draft.id?'Save changes':'Add user'}</button></div></div>}
      {history?<DataTable rows={[...events].reverse()} rowKey={item=>item.id} columns={[{key:'at',label:'Timestamp',sticky:true,width:'190px',render:item=>new Date(item.at).toLocaleString('en-IN')},{key:'principal',label:'User',width:'250px',render:item=><strong>{item.principal}</strong>},{key:'action',label:'Change',width:'230px',render:item=>item.action},{key:'before',label:'Before',width:'300px',render:item=>item.before},{key:'after',label:'After',width:'300px',render:item=>item.after},{key:'actor',label:'Changed by',width:'240px',render:item=>item.actor}]} empty={<div className="empty-state"><Icon name="history" size={30}/><strong>No access changes recorded</strong></div>}/>:<DataTable rows={visibleAssignments} rowKey={item=>item.id} columns={[{key:'user',label:'User',sticky:true,width:'300px',render:item=><><strong>{item.name}</strong><small>{item.email}</small></>},{key:'role',label:'Access level',width:'250px',render:item=><div className="assigned-role-chips">{assignedRoles(item).map(roleId=><span key={roleId}>{roleById(roleId).name}</span>)}</div>},{key:'scope',label:'Access scope',width:'220px',render:item=><span className="access-scope">{effectiveModules(assignedRoles(item)).length?`${effectiveModules(assignedRoles(item)).length} modules`:'Portal only'}</span>},{key:'status',label:'Status',width:'130px',render:item=><span className={`access-state-control ${item.status==='Active'?'active':'inactive'}`}>{item.status}</span>},{key:'actions',label:'Actions',width:'250px',render:item=><div className="access-row-actions"><button type="button" disabled={!editable||item.status==='Archived'} onClick={()=>startEdit(item)}>Edit access</button>{item.status!=='Archived'&&<button type="button" disabled={!editable||item.id==='dev'} onClick={()=>changeState(item,item.status==='Active'?'Suspended':'Active')}>{item.status==='Active'?'Suspend':'Reactivate'}</button>}<button type="button" className="archive" disabled={!editable||item.id==='dev'||item.status==='Archived'} onClick={()=>changeState(item,'Archived')}>Archive</button></div>}]} empty={<div className="empty-state"><strong>No access assignments</strong></div>}/>} 
      {!history&&<div className="archived-access-toggle"><button type="button" onClick={()=>setShowArchived(value=>!value)}>{showArchived?'Hide archived users':'Show archived users'}</button></div>}
    </section>
  </>
}
