import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'

export type FlowTaskRecord = {
  id: string; title: string; departmentId: string; ownerEmail: string; participantEmails: string[]
  description?: string
  workOrigin?: 'Personal plan'|'Allocated'
  status: 'Not started'|'In progress'|'Awaiting review'|'Blocked'|'Closed'; priority: 'High'|'Medium'|'Low'
  dueDate: string; teamId?:string; projectId?:string; cycleId?:string; managerEmail?:string; sourceApp?: 'ITMS'|'NCR'|'Facilities'|'Flow'; sourceRecordId?: string; createdBy: string; createdAt: string; updatedAt: string
}
export type FlowMeetingRecord = {
  id: string; title: string; departmentId: string; scheduledAt: string; ownerEmail: string; participantEmails: string[]
  status: 'Draft'|'Scheduled'|'In progress'|'Closed'; agenda: string[]; createdBy: string; createdAt: string; updatedAt: string
}
export type FlowTeamRecord = {
  id:string; name:string; departmentId:string; managerEmail:string; memberEmails:string[]; description:string
  status:'Active'|'Inactive'; createdBy:string; createdAt:string; updatedAt:string
}
export type FlowGoalRecord = {
  id:string; title:string; departmentId:string; ownerEmail:string; participantEmails:string[]
  outcome:string; status:'On track'|'At risk'|'On hold'|'Complete'; progress:number; targetDate:string
  createdBy:string; createdAt:string; updatedAt:string
}
export type FlowProjectRecord = {
  id:string; title:string; departmentId:string; goalId?:string; ownerEmail:string; participantEmails:string[]
  status:'On track'|'At risk'|'On hold'|'Complete'; progress:number; targetDate:string; dependency?:string
  createdBy:string; createdAt:string; updatedAt:string
}
export type FlowProjectUpdateRecord = { id:string; projectId:string; authorEmail:string; participantEmails:string[]; summary:string; status:'On track'|'At risk'|'On hold'|'Complete'; createdAt:string }
export type FlowCheckInRecord = {
  id:string; teamId:string; authorEmail:string; participantEmails:string[]; completed:string; nextPriority:string; blocker:string; supportNeeded:string; status?:'On track'|'At risk'|'Blocked'
  weekOf:string; createdAt:string; updatedAt:string
}
export type FlowTaskNoteRecord = {
  id:string; taskId:string; authorEmail:string; participantEmails:string[]; body:string; evidenceLabel?:string; evidenceUrl?:string; createdAt:string
}
export type FlowMilestoneRecord = { id:string; projectId:string; title:string; phase?:string; phaseOwnerEmail?:string; ownerEmail:string; participantEmails:string[]; dueDate:string; status:'Not started'|'In progress'|'Blocked'|'Complete'; dependency?:string; createdAt:string; updatedAt:string }
export type FlowCycleRecord = { id:string; teamId:string; name:string; startDate:string; endDate:string; status:'Planned'|'Active'|'Closed'; managerEmail:string; participantEmails:string[]; carryForwardReason?:string; createdBy:string; createdAt:string; updatedAt:string }
export type FlowSprintMomRecord = { id:string; teamId:string; cycleId?:string; authorEmail:string; participantEmails:string[]; completed:string; decisions:string; blockers:string; carryForward:string; nextPriorities:string; createdAt:string }
export type FlowSignalRecord = { id:string; teamId:string; kind:'Blocker'|'Decision'|'Dependency'|'Update'; title:string; detail:string; requesterEmail:string; managerEmail:string; ownerEmail?:string; participantEmails:string[]; status:'Open'|'Resolved'; resolution?:string; dueDate?:string; severity?:'Low'|'Medium'|'High'|'Critical'; sourceRecordId?:string; createdAt:string; updatedAt:string }
export type FlowActivityRecord = { id:string; taskId?:string; meetingId?:string; action:string; detail:string; actorEmail:string; createdAt:string }

const taskCollection=()=>collection(firestore!, 'flowTasks')
const meetingCollection=()=>collection(firestore!, 'flowMeetings')
const activityCollection=()=>collection(firestore!, 'flowActivity')
const teamCollection=()=>collection(firestore!, 'flowTeams')
const goalCollection=()=>collection(firestore!, 'flowGoals')
const projectCollection=()=>collection(firestore!, 'flowProjects')
const projectUpdateCollection=()=>collection(firestore!, 'flowProjectUpdates')
const checkInCollection=()=>collection(firestore!, 'flowCheckins')
const taskNoteCollection=()=>collection(firestore!, 'flowTaskNotes')
const milestoneCollection=()=>collection(firestore!, 'flowMilestones')
const cycleCollection=()=>collection(firestore!, 'flowCycles')
const sprintMomCollection=()=>collection(firestore!, 'flowSprintMoms')
const signalCollection=()=>collection(firestore!, 'flowSignals')

export function subscribeFlowTasks(receive:(records:FlowTaskRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(taskCollection(), snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowTaskRecord)), ()=>receive([]))
}
export function subscribeFlowMeetings(receive:(records:FlowMeetingRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(meetingCollection(), snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowMeetingRecord)), ()=>receive([]))
}
export function subscribeFlowTeams(receive:(records:FlowTeamRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(teamCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowTeamRecord)),()=>receive([]))
}
export function subscribeFlowGoals(receive:(records:FlowGoalRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(goalCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowGoalRecord)),()=>receive([]))
}
export function subscribeFlowProjects(receive:(records:FlowProjectRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(projectCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowProjectRecord)),()=>receive([]))
}
export function subscribeFlowProjectUpdates(receive:(records:FlowProjectUpdateRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(projectUpdateCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowProjectUpdateRecord)),()=>receive([]))
}
export function subscribeFlowCheckIns(receive:(records:FlowCheckInRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(checkInCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowCheckInRecord)),()=>receive([]))
}
export function subscribeFlowTaskNotes(receive:(records:FlowTaskNoteRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(taskNoteCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowTaskNoteRecord)),()=>receive([]))
}
export function subscribeFlowMilestones(receive:(records:FlowMilestoneRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(milestoneCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowMilestoneRecord)),()=>receive([]))
}
export function subscribeFlowCycles(receive:(records:FlowCycleRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(cycleCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowCycleRecord)),()=>receive([]))
}
export function subscribeFlowSprintMoms(receive:(records:FlowSprintMomRecord[])=>void):Unsubscribe { if(!firestore){receive([]);return()=>undefined};return onSnapshot(sprintMomCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowSprintMomRecord)),()=>receive([])) }
export function subscribeFlowSignals(receive:(records:FlowSignalRecord[])=>void):Unsubscribe {
  if(!firestore){receive([]);return()=>undefined}
  return onSnapshot(signalCollection(),snapshot=>receive(snapshot.docs.map(row=>row.data() as FlowSignalRecord)),()=>receive([]))
}
export async function saveFlowTask(task:FlowTaskRecord, actorEmail:string, action='Task updated') {
  if(!firestore) return
  await setDoc(doc(taskCollection(),task.id),task,{merge:true})
  await setDoc(doc(activityCollection(),`${task.id}-${Date.now()}`),{id:`${task.id}-${Date.now()}`,taskId:task.id,action,detail:task.title,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowMeeting(meeting:FlowMeetingRecord, actorEmail:string, action='Meeting updated') {
  if(!firestore) return
  await setDoc(doc(meetingCollection(),meeting.id),meeting,{merge:true})
  await setDoc(doc(activityCollection(),`${meeting.id}-${Date.now()}`),{id:`${meeting.id}-${Date.now()}`,meetingId:meeting.id,action,detail:meeting.title,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowTeam(team:FlowTeamRecord,actorEmail:string,action='Team updated') {
  if(!firestore)return
  await setDoc(doc(teamCollection(),team.id),team,{merge:true})
  await setDoc(doc(activityCollection(),`${team.id}-${Date.now()}`),{id:`${team.id}-${Date.now()}`,action,detail:team.name,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowGoal(goal:FlowGoalRecord,actorEmail:string,action='Goal updated') {
  if(!firestore)return
  await setDoc(doc(goalCollection(),goal.id),goal,{merge:true})
  await setDoc(doc(activityCollection(),`${goal.id}-${Date.now()}`),{id:`${goal.id}-${Date.now()}`,action,detail:goal.title,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowProject(project:FlowProjectRecord,actorEmail:string,action='Project updated') {
  if(!firestore)return
  await setDoc(doc(projectCollection(),project.id),project,{merge:true})
  await setDoc(doc(activityCollection(),`${project.id}-${Date.now()}`),{id:`${project.id}-${Date.now()}`,action,detail:project.title,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:new Date().toISOString()})
}
export async function saveFlowProjectUpdate(update:FlowProjectUpdateRecord,actorEmail:string) {
  if(!firestore)return
  await setDoc(doc(projectUpdateCollection(),update.id),update)
  await setDoc(doc(activityCollection(),`${update.id}-${Date.now()}`),{id:`${update.id}-${Date.now()}`,action:'Project update added',detail:update.summary,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowCheckIn(checkIn:FlowCheckInRecord,actorEmail:string,action='Weekly check-in saved') {
  if(!firestore)return
  await setDoc(doc(checkInCollection(),checkIn.id),checkIn,{merge:true})
  await setDoc(doc(activityCollection(),`${checkIn.id}-${Date.now()}`),{id:`${checkIn.id}-${Date.now()}`,action,detail:checkIn.nextPriority,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowTaskNote(note:FlowTaskNoteRecord,actorEmail:string) {
  if(!firestore)return
  await setDoc(doc(taskNoteCollection(),note.id),note)
  await setDoc(doc(activityCollection(),`${note.id}-${Date.now()}`),{id:`${note.id}-${Date.now()}`,taskId:note.taskId,action:'Work item update added',detail:note.body,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowMilestone(milestone:FlowMilestoneRecord,actorEmail:string,action='Project milestone updated') {
  if(!firestore)return
  await setDoc(doc(milestoneCollection(),milestone.id),milestone,{merge:true})
  await setDoc(doc(activityCollection(),`${milestone.id}-${Date.now()}`),{id:`${milestone.id}-${Date.now()}`,action,detail:milestone.title,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowCycle(cycle:FlowCycleRecord,actorEmail:string,action='Delivery cycle updated') {
  if(!firestore)return
  await setDoc(doc(cycleCollection(),cycle.id),cycle,{merge:true})
  await setDoc(doc(activityCollection(),`${cycle.id}-${Date.now()}`),{id:`${cycle.id}-${Date.now()}`,action,detail:cycle.name,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
export async function saveFlowSprintMom(mom:FlowSprintMomRecord,actorEmail:string) { if(!firestore)return;await setDoc(doc(sprintMomCollection(),mom.id),mom);await setDoc(doc(activityCollection(),`${mom.id}-${Date.now()}`),{id:`${mom.id}-${Date.now()}`,action:'Sprint MoM saved',detail:mom.nextPriorities,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()}) }
export async function saveFlowSignal(signal:FlowSignalRecord,actorEmail:string,action='Team signal updated') {
  if(!firestore)return
  await setDoc(doc(signalCollection(),signal.id),signal,{merge:true})
  await setDoc(doc(activityCollection(),`${signal.id}-${Date.now()}`),{id:`${signal.id}-${Date.now()}`,action,detail:signal.title,actorEmail,createdAt:new Date().toISOString(),serverCreatedAt:serverTimestamp()})
}
