import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { useLocalStore } from "../../lib/localStore";
import {
  saveFlowTask,
  subscribeFlowProjects,
  subscribeFlowTasks,
  subscribeFlowTeams,
  type FlowProjectRecord,
  type FlowTaskRecord,
  type FlowTeamRecord,
} from "../flow/flowStore";
import "./TeamsWorkBoard.css";
type User = { id: string; name: string; email?: string; status?: string };
const lanes: FlowTaskRecord["status"][] = [
  "Not started",
  "In progress",
  "Awaiting review",
  "Blocked",
];
export default function TeamsWorkBoard({
  identityEmail,
  isLeader,
  onAllocate,
  onNotice,
  onOpenDetail,
}: {
  identityEmail: string;
  isLeader: boolean;
  onAllocate: () => void;
  onNotice: (text: string) => void;
  onOpenDetail: () => void;
}) {
  const [tasks, setTasks] = useState<FlowTaskRecord[]>([]),
    [teams, setTeams] = useState<FlowTeamRecord[]>([]),
    [projects, setProjects] = useState<FlowProjectRecord[]>([]),
    [teamId, setTeamId] = useState("all"),
    [ownerEmail, setOwnerEmail] = useState("all"),
    [query, setQuery] = useState(""),
    [mode, setMode] = useState<"board" | "list">("board");
  const [users] = useLocalStore<User[]>("itms.users.v1", []);
  useEffect(() => {
    const a = subscribeFlowTasks(setTasks),
      b = subscribeFlowTeams(setTeams),
      c = subscribeFlowProjects(setProjects);
    return () => {
      a();
      b();
      c();
    };
  }, []);
  const active = teams.filter((team) => team.status === "Active"),
    visible = useMemo(
      () =>
        tasks
          .filter((task) => teamId === "all" || task.teamId === teamId)
          .filter((task) => ownerEmail === "all" || task.ownerEmail === ownerEmail)
          .filter((task) => !query.trim() || `${task.title} ${task.ownerEmail} ${task.priority} ${task.status}`.toLowerCase().includes(query.trim().toLowerCase()))
          .filter((task) => task.status !== "Closed"),
      [tasks, teamId, ownerEmail, query],
    ),
    person = (email: string) =>
      users.find((user) => user.email === email)?.name || email,
    team = (id?: string) => active.find((item) => item.id === id),
    project = (id?: string) => projects.find((item) => item.id === id),
    today = new Date().toISOString().slice(0, 10),
    owners = [...new Set(tasks.filter((task) => teamId === "all" || task.teamId === teamId).map((task) => task.ownerEmail).filter(Boolean))],
    overdue = visible.filter((task) => task.dueDate && task.dueDate < today).length,
    blocked = visible.filter((task) => task.status === "Blocked").length,
    review = visible.filter((task) => task.status === "Awaiting review").length;
  const update = async (
    task: FlowTaskRecord,
    next: FlowTaskRecord["status"],
  ) => {
    try {
      await saveFlowTask(
        { ...task, status: next, updatedAt: new Date().toISOString() },
        identityEmail,
        "Work item moved to " + next,
      );
      onNotice("Work item moved to " + next + ".");
    } catch {
      onNotice("The work item could not be updated.");
    }
  };
  const nextStatus = (task: FlowTaskRecord) =>
    task.status === "Not started"
      ? "In progress"
      : task.status === "In progress"
        ? "Awaiting review"
        : task.status === "Awaiting review"
          ? "Closed"
          : "In progress";
  return (
    <section className="teams-workboard">
      <header className="workboard-head">
        <div>
          <span>TEAM DELIVERY BOARD</span>
          <h1>Work that is owned and moving</h1>
          <p>
            One work system for team execution—clear owner, due date, priority
            and project context.
          </p>
        </div>
        <button className="teams-primary" onClick={onAllocate}>
          <Icon name="plus" size={16} />
          Allocate work
        </button>
      </header>
      <section className="workboard-signals" aria-label="Manager delivery signals">
        <article><span>Active work</span><strong>{visible.length}</strong><small>Across the current selection</small></article>
        <article className={blocked ? "risk" : ""}><span>Blocked</span><strong>{blocked}</strong><small>Needs manager intervention</small></article>
        <article className={overdue ? "risk" : ""}><span>Overdue</span><strong>{overdue}</strong><small>Past the committed due date</small></article>
        <article><span>Ready for review</span><strong>{review}</strong><small>Awaiting a decision or closure</small></article>
      </section>
      <section className="workboard-toolbar">
        <select
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
        >
          <option value="all">All visible teams</option>
          {active.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <label className="workboard-search"><Icon name="search" size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search work or owner"/></label>
        <select value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} aria-label="Filter by owner">
          <option value="all">All owners</option>
          {owners.map((email) => <option key={email} value={email}>{person(email)}</option>)}
        </select>
        <span>{visible.length} active items</span>
        <div>
          <button
            className={mode === "board" ? "active" : ""}
            onClick={() => setMode("board")}
          >
            <Icon name="dashboard" size={16} />
            Board
          </button>
          <button
            className={mode === "list" ? "active" : ""}
            onClick={() => setMode("list")}
          >
            <Icon name="history" size={16} />
            List
          </button>
          <button onClick={onOpenDetail}>
            Work item centre <Icon name="arrow" size={14} />
          </button>
        </div>
      </section>
      {mode === "board" ? (
        <div className="workboard-lanes">
          {lanes.map((lane) => (
            <section
              className={
                "workboard-lane " + lane.toLowerCase().replaceAll(" ", "-")
              }
              key={lane}
            >
              <header>
                <b>{lane === "Awaiting review" ? "Review" : lane}</b>
                <span>
                  {visible.filter((task) => task.status === lane).length}
                </span>
              </header>
              {visible
                .filter((task) => task.status === lane)
                .map((task) => (
                  <article key={task.id}>
                    <div className="workboard-card-top">
                      <em className={task.priority.toLowerCase()}>
                        {task.priority}
                      </em>
                      <small>
                        {team(task.teamId)?.name || "Unassigned team"}
                      </small>
                    </div>
                    <b>{task.title}</b>
                    <p>
                      {project(task.projectId)?.title ||
                        "Independent work item"}
                    </p>
                    <footer>
                      <span>
                        <i>
                          {person(task.ownerEmail).slice(0, 1).toUpperCase()}
                        </i>
                        {person(task.ownerEmail)}
                      </span>
                      <time>{task.dueDate}</time>
                    </footer>
                    {(isLeader || task.managerEmail === identityEmail) && (
                      <button
                        onClick={() => void update(task, nextStatus(task))}
                      >
                        {task.status === "Awaiting review"
                          ? "Close item"
                          : "Move forward"}{" "}
                        <Icon name="arrow" size={13} />
                      </button>
                    )}
                  </article>
                ))}
              {!visible.some((task) => task.status === lane) && (
                <p className="workboard-empty">No work here</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="workboard-list">
          <header>
            <span>Work item</span>
            <span>Owner</span>
            <span>Project</span>
            <span>Due date</span>
            <span>Status</span>
          </header>
          {visible.map((task) => (
            <article key={task.id}>
              <div>
                <b>{task.title}</b>
                <small>{team(task.teamId)?.name || "No team"}</small>
              </div>
              <span>{person(task.ownerEmail)}</span>
              <span>{project(task.projectId)?.title || "—"}</span>
              <time>{task.dueDate}</time>
              <em className={task.status.toLowerCase().replaceAll(" ", "-")}>
                {task.status}
              </em>
            </article>
          ))}
          {!visible.length && (
            <p className="workboard-empty">
              No active work is visible for this team selection.
            </p>
          )}
        </section>
      )}
    </section>
  );
}
