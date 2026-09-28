import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { useLocalStore } from "../../lib/localStore";
import {
  saveFlowTask,
  subscribeFlowProjects,
  subscribeFlowTeams,
  type FlowProjectRecord,
  type FlowTaskRecord,
  type FlowTeamRecord,
} from "../flow/flowStore";
import "./TeamsChannelWorkspace.css";
import "./TeamsChannelTaskForm.css";

type Message = {
  id: string;
  teamId: string;
  channel: string;
  body: string;
  authorEmail: string;
  createdAt: string;
  replyTo?: string;
  promotedTaskId?: string;
};
type User = { id: string; name: string; email?: string };
type TaskForm = {
  title: string;
  ownerEmail: string;
  priority: FlowTaskRecord["priority"];
  status: FlowTaskRecord["status"];
  dueDate: string;
};

const channels = [
  { id: "general", label: "general", note: "Day-to-day team discussion" },
  { id: "updates", label: "updates", note: "Progress and announcements" },
  { id: "blockers", label: "blockers", note: "Issues requiring attention" },
];
const today = () => new Date().toISOString().slice(0, 10);

export default function TeamsChannelWorkspace({
  identityEmail,
  onNotice,
  onOpenWork,
}: {
  identityEmail: string;
  onNotice: (message: string) => void;
  onOpenWork: () => void;
}) {
  const [messages, setMessages] = useLocalStore<Message[]>(
    "teams.channel-messages.v1",
    [],
  );
  const [users] = useLocalStore<User[]>("itms.users.v1", []);
  const [teams, setTeams] = useState<FlowTeamRecord[]>([]);
  const [projects, setProjects] = useState<FlowProjectRecord[]>([]);
  const [teamId, setTeamId] = useState("");
  const [channel, setChannel] = useState("general");
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState("");
  const [taskSource, setTaskSource] = useState<Message | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null);

  useEffect(() => {
    const stopTeams = subscribeFlowTeams(setTeams);
    const stopProjects = subscribeFlowProjects(setProjects);
    return () => { stopTeams(); stopProjects(); };
  }, []);

  const activeTeams = teams.filter((item) => item.status === "Active");
  const team = activeTeams.find((item) => item.id === teamId) || activeTeams[0];
  const projectChannels = projects.filter((item) => item.departmentId === team?.departmentId && item.status !== "Complete").map((item) => ({ id: `project:${item.id}`, label: item.title, note: `Project · ${item.status} · target ${item.targetDate}`, project: item }));
  const allChannels = [...channels, ...projectChannels];
  const channelInfo = allChannels.find((item) => item.id === channel) || channels[0];
  const person = (email: string) => users.find((user) => user.email === email)?.name || email;
  const visible = useMemo(
    () =>
      messages
        .filter((item) => item.teamId === team?.id && item.channel === channel && !item.replyTo)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [messages, team?.id, channel],
  );
  const thread = messages
    .filter((item) => item.id === threadId || item.replyTo === threadId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const post = (replyTo?: string) => {
    if (!team || !draft.trim()) return;
    const message: Message = {
      id: crypto.randomUUID(),
      teamId: team.id,
      channel,
      body: draft.trim(),
      authorEmail: identityEmail,
      createdAt: new Date().toISOString(),
      replyTo,
    };
    setMessages((current) => [...current, message]);
    setDraft("");
    if (replyTo) setThreadId(replyTo);
    onNotice(replyTo ? "Reply posted." : `Message sent to #${channel}.`);
  };

  const openTaskForm = (message: Message) => {
    if (!team || message.promotedTaskId) return;
    setTaskSource(message);
    setTaskForm({
      title: message.body.length > 120 ? `${message.body.slice(0, 117)}...` : message.body,
      ownerEmail: identityEmail,
      priority: message.channel === "blockers" ? "High" : "Medium",
      status: "Not started",
      dueDate: "",
    });
  };

  const createTask = async () => {
    if (!team || !taskSource || !taskForm) return;
    if (!taskForm.title.trim() || !taskForm.ownerEmail || !taskForm.dueDate) {
      onNotice("Enter a task title, owner and due date before creating the work item.");
      return;
    }
    const now = new Date().toISOString();
    const task: FlowTaskRecord = {
      id: crypto.randomUUID(),
      title: taskForm.title.trim(),
      departmentId: team.departmentId,
      ownerEmail: taskForm.ownerEmail,
      participantEmails: Array.from(
        new Set([identityEmail, team.managerEmail, ...team.memberEmails, taskForm.ownerEmail]),
      ),
      status: taskForm.status,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate,
      teamId: team.id,
      projectId: taskSource.channel.startsWith("project:") ? taskSource.channel.slice(8) : undefined,
      managerEmail: team.managerEmail,
      sourceApp: "Flow",
      sourceRecordId: `conversation:${taskSource.channel}:${taskSource.id}`,
      createdBy: identityEmail,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await saveFlowTask(task, identityEmail, `Conversation from #${taskSource.channel} converted to work`);
      setMessages((current) =>
        current.map((item) =>
          item.id === taskSource.id ? { ...item, promotedTaskId: task.id } : item,
        ),
      );
      setTaskSource(null);
      setTaskForm(null);
      onNotice("Work item created with the selected owner, priority, status and due date.");
    } catch {
      onNotice("The message could not be converted to a work item.");
    }
  };

  if (!team) {
    return <section className="channel-empty"><Icon name="allocation" size={28} /><h2>No active team is available</h2><p>Create a team before starting a shared conversation.</p></section>;
  }

  return <section className="channel-workspace">
    <aside className="channel-rail" style={{ background: "#f5f9fc", color: "#214662", borderRight: "1px solid #dce8f0" }}>
      <header><span>TEAM SPACE</span><select value={team.id} onChange={(event) => setTeamId(event.target.value)}>{activeTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></header>
      <button className="channel-create" onClick={() => { setChannel("general"); setThreadId(""); document.querySelector<HTMLTextAreaElement>(".channel-composer textarea")?.focus(); }}><Icon name="plus" size={16} />New message</button>
      <nav><small>TEAM CHANNELS</small>{channels.map((item) => <button className={channel === item.id ? "selected" : ""} key={item.id} onClick={() => { setChannel(item.id); setThreadId(""); }}><b>#</b>{item.label}</button>)}</nav>
      {projectChannels.length > 0 && <nav><small>PROJECT CHANNELS</small>{projectChannels.map((item) => <button className={channel === item.id ? "selected" : ""} key={item.id} onClick={() => { setChannel(item.id); setThreadId(""); }}><Icon name="reports" size={14} />{item.label}</button>)}</nav>}
      <nav><small>TEAM TOOLS</small><button onClick={onOpenWork}><Icon name="dashboard" size={16} />Formal work board</button><button onClick={() => onNotice("Use @name in a message to direct a teammate’s attention.")}><Icon name="bell" size={16} />Mentions & reactions</button></nav>
      <footer><Icon name="allocation" size={16} /><span>{team.memberEmails.length} team members<br /><small>Private to this delivery team</small></span></footer>
    </aside>
    <main className="channel-main">
      <header className="channel-title"><div><h1>{channelInfo.id.startsWith("project:") ? "▣" : "#"} {channelInfo.label}</h1><p>{channelInfo.note} · {team.name}</p></div><div><button onClick={() => onNotice("Team members can be added from the Team Directory.")}>Add people</button><button onClick={onOpenWork}>Open scrum <Icon name="arrow" size={14} /></button></div></header>
      <section className="channel-feed">
        {visible.map((message) => <article key={message.id} className={threadId === message.id ? "selected" : ""}><i>{person(message.authorEmail).slice(0, 1).toUpperCase()}</i><div><header><strong>{person(message.authorEmail)}</strong><time>{new Date(message.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></header><p>{message.body.split(/(@[a-zA-Z0-9._-]+)/g).map((part, index) => part.startsWith("@") ? <mark key={index}>{part}</mark> : part)}</p><div className="channel-message-actions"><button onClick={() => setThreadId(message.id)}>{messages.filter((item) => item.replyTo === message.id).length ? `View thread · ${messages.filter((item) => item.replyTo === message.id).length} replies` : "Reply in thread"}</button>{message.promotedTaskId ? <small>Work item created</small> : <button onClick={() => openTaskForm(message)}>Convert to task</button>}</div></div></article>)}
        {!visible.length && <div className="channel-welcome"><Icon name="mail" size={28} /><h2>Welcome to #{channelInfo.label}</h2><p>Start the conversation. Use @name when someone needs to see it.</p></div>}
      </section>
      <footer className="channel-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); post(); } }} placeholder={`Message #${channelInfo.label} · use @name to mention a teammate`} /><div><span><Icon name="plus" size={16} /> Attach <Icon name="bell" size={16} /> Mention</span><button onClick={() => post()} disabled={!draft.trim()}>Send <Icon name="arrow" size={15} /></button></div></footer>
    </main>
    <aside className="thread-panel" style={{ background: "#f8fbfd" }}>
      <header><div><span>THREAD</span><h2>{threadId ? "Conversation" : "Channel context"}</h2></div>{threadId && <button onClick={() => setThreadId("")} aria-label="Close thread">×</button>}</header>
      {threadId ? <><div className="thread-messages">{thread.map((message) => <article key={message.id}><i>{person(message.authorEmail).slice(0, 1).toUpperCase()}</i><div><strong>{person(message.authorEmail)}</strong><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div></article>)}</div><div className="thread-reply"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Reply in thread" /><button onClick={() => post(threadId)} disabled={!draft.trim()}>Reply</button></div></> : <div className="thread-context"><Icon name="mail" size={24} /><h3>Keep discussion in context</h3><p>Select a message to open its thread. Quick team discussions stay here; committed work moves to the formal scrum board.</p><button onClick={onOpenWork}>Open formal Work Board <Icon name="arrow" size={14} /></button></div>}
    </aside>
    {taskForm && taskSource && <div className="channel-task-scrim" onMouseDown={() => { setTaskSource(null); setTaskForm(null); }}><section className="channel-task-form" onMouseDown={(event) => event.stopPropagation()}><header><div><span>CREATE GOVERNED WORK</span><h2>Convert conversation to a task</h2><p>The original message remains linked as the source context.</p></div><button onClick={() => { setTaskSource(null); setTaskForm(null); }} aria-label="Close">×</button></header><label>Task title<input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} autoFocus /></label><div className="channel-task-grid"><label>Owner<select value={taskForm.ownerEmail} onChange={(event) => setTaskForm({ ...taskForm, ownerEmail: event.target.value })}>{Array.from(new Set([identityEmail, team.managerEmail, ...team.memberEmails])).map((email) => <option key={email} value={email}>{person(email)}</option>)}</select></label><label>Priority<select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as FlowTaskRecord["priority"] })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Initial status<select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value as FlowTaskRecord["status"] })}><option>Not started</option><option>In progress</option><option>Awaiting review</option><option>Blocked</option></select></label><label>Due date<input type="date" min={today()} value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></label></div><footer><button onClick={() => { setTaskSource(null); setTaskForm(null); }}>Cancel</button><button className="teams-primary" onClick={() => void createTask()}>Create work item</button></footer></section></div>}
  </section>;
}
