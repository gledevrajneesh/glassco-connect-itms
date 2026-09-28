import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon";
import {
  subscribeFlowProjects,
  subscribeFlowMilestones,
  subscribeFlowSignals,
  subscribeFlowTasks,
  subscribeFlowTeams,
  type FlowProjectRecord,
  type FlowMilestoneRecord,
  type FlowSignalRecord,
  type FlowTaskRecord,
  type FlowTeamRecord,
} from "../flow/flowStore";
import "./TeamsDeliveryReport.css";
import "./TeamsProjectHealth.css";

const csv = (value: string) => `"${value.replaceAll('"', '""')}"`;

export default function TeamsDeliveryReport({
  identityEmail,
  isLeader,
}: {
  identityEmail: string;
  isLeader: boolean;
}) {
  const [tasks, setTasks] = useState<FlowTaskRecord[]>([]),
    [teams, setTeams] = useState<FlowTeamRecord[]>([]),
    [projects, setProjects] = useState<FlowProjectRecord[]>([]),
    [milestones, setMilestones] = useState<FlowMilestoneRecord[]>([]),
    [signals, setSignals] = useState<FlowSignalRecord[]>([]),
    [teamId, setTeamId] = useState("");
  useEffect(() => {
    const a = subscribeFlowTasks(setTasks),
      b = subscribeFlowTeams(setTeams),
      c = subscribeFlowProjects(setProjects),
      d = subscribeFlowMilestones(setMilestones),
      e = subscribeFlowSignals(setSignals);
    return () => {
      a();
      b();
      c();
      d();
      e();
    };
  }, []);
  const visibleTeams = teams.filter(
    (team) =>
      isLeader ||
      team.managerEmail === identityEmail ||
      team.memberEmails.includes(identityEmail),
  );
  const team =
    visibleTeams.find((item) => item.id === teamId) || visibleTeams[0];
  const work = useMemo(
    () => (team ? tasks.filter((item) => item.teamId === team.id) : []),
    [tasks, team?.id],
  );
  const today = new Date().toISOString().slice(0, 10),
    open = work.filter((item) => item.status !== "Closed"),
    done = work.filter((item) => item.status === "Closed"),
    overdue = open.filter((item) => item.dueDate < today),
    blocked = open.filter((item) => item.status === "Blocked");
  const projectIds = new Set(
      work.map((item) => item.projectId).filter(Boolean),
    ),
    teamProjects = projects.filter((project) => projectIds.has(project.id));
  const teamProjectIds = new Set(teamProjects.map((project) => project.id)),
    healthMilestones = milestones.filter((milestone) => teamProjectIds.has(milestone.projectId)),
    overdueMilestones = healthMilestones.filter((milestone) => milestone.status !== "Complete" && milestone.dueDate < today),
    blockedMilestones = healthMilestones.filter((milestone) => milestone.status === "Blocked"),
    unresolvedDependencies = signals.filter((signal) => signal.teamId === team.id && signal.status === "Open" && signal.kind === "Dependency");
  const exportCsv = () => {
    const rows = [
      [
        "Task",
        "Project / workstream",
        "Owner",
        "Priority",
        "Due date",
        "Status",
      ],
      ...work.map((task) => [
        task.title,
        projects.find((project) => project.id === task.projectId)?.title ||
          "Routine team work",
        task.ownerEmail,
        task.priority,
        task.dueDate,
        task.status,
      ]),
    ];
    const content = rows
        .map((row) => row.map((cell) => csv(cell)).join(","))
        .join("\n"),
      url = URL.createObjectURL(
        new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = `Teams-delivery-${team?.name?.replace(/[^a-z0-9]+/gi, "-") || "report"}-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (!team)
    return (
      <div className="teams-delivery-report">
        <section className="delivery-no-team">
          <Icon name="reports" size={28} />
          <b>No team is available to report on yet.</b>
          <span>
            Create a team and allocate work to start building delivery
            visibility.
          </span>
        </section>
      </div>
    );
  return (
    <div className="teams-delivery-report">
      <section className="delivery-report-head">
        <div>
          <small>TEAM DELIVERY REPORT</small>
          <h1>Delivery health at a glance</h1>
          <p>
            A clean manager view for review meetings, decisions and follow-up.
          </p>
        </div>
        <div>
          <label>
            Team
            <select
              value={team.id}
              onChange={(event) => setTeamId(event.target.value)}
            >
              {visibleTeams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="teams-primary" onClick={exportCsv}>
            <Icon name="reports" size={16} />
            Export CSV
          </button>
        </div>
      </section>
      <section className="delivery-kpis">
        <article>
          <small>Open work</small>
          <b>{open.length}</b>
          <span>Current commitments</span>
        </article>
        <article>
          <small>Completed</small>
          <b>{done.length}</b>
          <span>Closed work items</span>
        </article>
        <article className={overdue.length ? "warning" : ""}>
          <small>Overdue</small>
          <b>{overdue.length}</b>
          <span>Past target date</span>
        </article>
        <article className={blocked.length ? "danger" : ""}>
          <small>Blocked</small>
          <b>{blocked.length}</b>
          <span>Needs intervention</span>
        </article>
      </section>
      <div className="delivery-grid">
        <section className="delivery-panel">
          <header>
            <div>
              <small>PROJECT DELIVERY</small>
              <h2>Linked workstreams</h2>
            </div>
            <span>{teamProjects.length} linked</span>
          </header>
          {teamProjects.map((project) => {
            const projectWork = work.filter(
                (task) => task.projectId === project.id,
              ),
              closed = projectWork.filter(
                (task) => task.status === "Closed",
              ).length,
              progress = projectWork.length
                ? Math.round((closed / projectWork.length) * 100)
                : 0;
            return (
              <article key={project.id}>
                <div>
                  <b>{project.title}</b>
                  <small>
                    {projectWork.length} tasks · Target {project.targetDate}
                  </small>
                </div>
                <span className="delivery-progress">
                  <i style={{ width: `${progress}%` }} />
                  <small>{progress}% task completion</small>
                </span>
                <em
                  className={project.status.toLowerCase().replaceAll(" ", "-")}
                >
                  {project.status}
                </em>
              </article>
            );
          })}
          {!teamProjects.length && (
            <p className="delivery-empty">
              No workstreams are linked yet. Routine team work is still included
              in the delivery totals.
            </p>
          )}
        </section>
        <section className="delivery-panel">
          <header>
            <div>
              <small>OWNERSHIP BALANCE</small>
              <h2>Open work by person</h2>
            </div>
            <span>{team.memberEmails.length} members</span>
          </header>
          {team.memberEmails.map((email) => {
            const owned = open.filter((task) => task.ownerEmail === email),
              late = owned.filter((task) => task.dueDate < today).length;
            return (
              <article key={email}>
                <div>
                  <b>{email}</b>
                  <small>
                    {late
                      ? `${late} overdue item${late > 1 ? "s" : ""}`
                      : "No overdue item"}
                  </small>
                </div>
                <strong className={owned.length > 5 ? "warning" : ""}>
                  {owned.length} open
                </strong>
                <em className={owned.length > 5 ? "warning" : ""}>
                  {owned.length > 5 ? "Review capacity" : "Balanced"}
                </em>
              </article>
            );
          })}
        </section>
      </div>
      <section className="delivery-panel delivery-exceptions">
        <header>
          <div>
            <small>EXCEPTIONS TO REVIEW</small>
            <h2>Blocked and overdue work</h2>
          </div>
          <span>
            {
              [
                ...blocked,
                ...overdue.filter((task) => task.status !== "Blocked"),
              ].length
            }{" "}
            items
          </span>
        </header>
        {[
          ...blocked,
          ...overdue.filter((task) => task.status !== "Blocked"),
        ].map((task) => (
          <article key={task.id}>
            <div>
              <b>{task.title}</b>
              <small>
                {task.ownerEmail} · Due {task.dueDate}
              </small>
            </div>
            <em className={task.status === "Blocked" ? "blocked" : "overdue"}>
              {task.status === "Blocked" ? "Blocked" : "Overdue"}
            </em>
          </article>
        ))}
        {!blocked.length && !overdue.length && (
          <p className="delivery-empty">
            No current exceptions. The team is operating within its commitments.
          </p>
        )}
      </section>
      <section className="delivery-panel delivery-project-health">
        <header>
          <div>
            <small>PROJECT HEALTH</small>
            <h2>Milestones and dependencies needing attention</h2>
          </div>
          <span>{overdueMilestones.length + blockedMilestones.length + unresolvedDependencies.length} signals</span>
        </header>
        <div className="delivery-health-kpis">
          <article className={overdueMilestones.length ? "warning" : ""}><small>Overdue milestones</small><b>{overdueMilestones.length}</b><span>Past committed target</span></article>
          <article className={blockedMilestones.length ? "danger" : ""}><small>Blocked milestones</small><b>{blockedMilestones.length}</b><span>Needs an owner decision</span></article>
          <article className={unresolvedDependencies.length ? "danger" : ""}><small>Open dependencies</small><b>{unresolvedDependencies.length}</b><span>Awaiting another team or decision</span></article>
        </div>
        {[...blockedMilestones, ...overdueMilestones.filter((item) => item.status !== "Blocked")].map((milestone) => {
          const project = projects.find((item) => item.id === milestone.projectId);
          return <article key={milestone.id}><div><b>{milestone.title}</b><small>{project?.title || "Project milestone"} · Owner {milestone.ownerEmail} · Due {milestone.dueDate}</small></div><em className={milestone.status === "Blocked" ? "blocked" : "overdue"}>{milestone.status === "Blocked" ? "Blocked" : "Overdue"}</em></article>;
        })}
        {unresolvedDependencies.map((signal) => <article key={signal.id}><div><b>{signal.title}</b><small>Dependency · {signal.detail || "No dependency detail provided"}</small></div><em className="blocked">Open dependency</em></article>)}
        {!overdueMilestones.length && !blockedMilestones.length && !unresolvedDependencies.length && <p className="delivery-empty">No project-health risks are currently recorded for this team.</p>}
      </section>
    </div>
  );
}
