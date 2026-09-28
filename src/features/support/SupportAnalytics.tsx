import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { useLocalStore } from "../../lib/localStore";
import { useSupportStore } from "../../lib/supportStore";
import type { SupportDelivery } from "./SupportGovernance";
import type { RatingInvite } from "./EmailTicketing";
import SupportScorecard from "./SupportScorecard";
import "./SupportAnalytics.css";
import "./SupportManagementAnalytics.css";

type Ticket = {
  id: string;
  code: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  assignee?: string;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
  updatedAt: string;
  resolutionDueAt: string;
  messages?: unknown[];
};
type Request = {
  id: string;
  code: string;
  title: string;
  category: string;
  state: string;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
};
type Article = {
  id: string;
  code: string;
  title: string;
  category: string;
  status: string;
  helpful: number;
  notHelpful: number;
  views: number;
};
type Drill = { title: string; kind: "ticket" | "request"; ids: string[] };
const palette = [
  "#1769e0",
  "#2ca56c",
  "#e6a117",
  "#e2534a",
  "#7c62c9",
  "#36a0b8",
];
function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
export default function SupportAnalytics({
  tickets,
  ratings,
  identityEmail,
  onOpenTicket,
}: {
  tickets: Ticket[];
  ratings: RatingInvite[];
  identityEmail: string;
  onOpenTicket: (id: string) => void;
}) {
  const [requests] = useSupportStore<Request>(
    "supportRequests",
    identityEmail,
    true,
  );
  const [articles] = useLocalStore<Article[]>(
    "connect.support-knowledge.v1",
    [],
  );
  const [deliveries] = useLocalStore<SupportDelivery[]>(
    "connect.support-deliveries.v1",
    [],
  );
  const [range, setRange] = useState<"30" | "90" | "365" | "custom">("90");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [drill, setDrill] = useState<Drill>();
  const [teamMember, setTeamMember] = useState("All team members");
  const [escalationLevel, setEscalationLevel] = useState<
    "Level 1" | "Level 2" | "Level 3"
  >("Level 1");
  const [showTicketRegister, setShowTicketRegister] = useState(false);
  const [ticketRegisterSearch, setTicketRegisterSearch] = useState("");
  const cutoff =
    range === "custom" && fromDate
      ? new Date(`${fromDate}T00:00:00`).getTime()
      : Date.now() - Number(range) * 86400000;
  const ceiling =
    range === "custom" && toDate
      ? new Date(`${toDate}T23:59:59`).getTime()
      : Date.now();
  const inRange = (date: string) => {
    const at = new Date(date).getTime();
    return at >= cutoff && at <= ceiling;
  };
  const rangedTickets = tickets.filter((t) => inRange(t.createdAt));
  const rangedRequests = requests.filter((r) => inRange(r.createdAt));
  const visibleRegisterTickets = useMemo(() => {
    const query = ticketRegisterSearch.trim().toLowerCase();
    return rangedTickets
      .filter((ticket) => !query || `${ticket.code} ${ticket.title} ${ticket.category} ${ticket.assignee || ""} ${ticket.status}`.toLowerCase().includes(query))
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rangedTickets, ticketRegisterSearch]);
  const open = rangedTickets.filter((t) => t.status !== "Resolved");
  const breached = open.filter(
    (t) => new Date(t.resolutionDueAt).getTime() < Date.now(),
  );
  const resolved = rangedTickets.filter((t) => t.status === "Resolved");
  const fulfilmentOpen = rangedRequests.filter(
    (r) => !["Fulfilled", "Rejected", "Cancelled"].includes(r.state),
  );
  const fulfilled = rangedRequests.filter((r) => r.state === "Fulfilled");
  const helpful = articles.reduce((n, a) => n + a.helpful, 0);
  const unhelpful = articles.reduce((n, a) => n + a.notHelpful, 0);
  const views = articles.reduce((n, a) => n + a.views, 0);
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    rangedTickets.forEach((t) =>
      map.set(t.category, (map.get(t.category) || 0) + 1),
    );
    return [...map].sort((a, b) => b[1] - a[1]);
  }, [rangedTickets]);
  const priorities = ["Critical", "High", "Medium", "Low"].map(
    (p) => [p, rangedTickets.filter((t) => t.priority === p).length] as const,
  );
  const statuses = [
    "Open",
    "In progress",
    "Awaiting approval",
    "Awaiting employee",
    "Resolved",
  ].map(
    (s) => [s, rangedTickets.filter((t) => t.status === s).length] as const,
  );
  const team = useMemo(() => {
    const map = new Map<string, { open: number; resolved: number }>();
    rangedTickets.forEach((t) => {
      const key = t.assignee || "Unassigned";
      const row = map.get(key) || { open: 0, resolved: 0 };
      t.status === "Resolved" ? row.resolved++ : row.open++;
      map.set(key, row);
    });
    return [...map].sort(
      (a, b) => b[1].open + b[1].resolved - (a[1].open + a[1].resolved),
    );
  }, [rangedTickets]);
  const selectedTeamTickets =
    teamMember === "All team members"
      ? rangedTickets
      : rangedTickets.filter(
          (t) => (t.assignee || "Unassigned") === teamMember,
        );
  const selectedOpen = selectedTeamTickets.filter(
    (t) => t.status !== "Resolved",
  );
  const selectedResolved = selectedTeamTickets.filter(
    (t) => t.status === "Resolved",
  );
  const selectedBreached = selectedOpen.filter(
    (t) => new Date(t.resolutionDueAt).getTime() < Date.now(),
  );
  const selectedCritical = selectedOpen.filter(
    (t) => t.priority === "Critical",
  );
  const selectedSla = Math.max(
    0,
    100 - pct(selectedBreached.length, selectedOpen.length),
  );
  const resolutionRate = pct(
    selectedResolved.length,
    selectedTeamTickets.length,
  );
  const escalationMeta = {
    "Level 1": {
      owner: "Service Desk Manager",
      detail: "Tickets due within four hours, including already overdue work.",
      filter: (ticket: Ticket) =>
        new Date(ticket.resolutionDueAt).getTime() - Date.now() <= 4 * 3600000,
    },
    "Level 2": {
      owner: "IT Lead",
      detail: "SLA-breached tickets requiring management intervention.",
      filter: (ticket: Ticket) =>
        new Date(ticket.resolutionDueAt).getTime() < Date.now(),
    },
    "Level 3": {
      owner: "Super Administrator",
      detail:
        "Critical tickets that have breached their resolution commitment.",
      filter: (ticket: Ticket) =>
        ticket.priority === "Critical" &&
        new Date(ticket.resolutionDueAt).getTime() < Date.now(),
    },
  }[escalationLevel];
  const escalations = selectedOpen.filter(escalationMeta.filter);
  const averageOpenHours = open.length
    ? Math.round(
        open.reduce(
          (total, ticket) =>
            total +
            (Date.now() - new Date(ticket.createdAt).getTime()) / 3600000,
          0,
        ) / open.length,
      )
    : 0;
  function exportReport() {
    const rows = [
      [
        "Ticket",
        "Summary",
        "Category",
        "Priority",
        "Status",
        "Owner",
        "Requester",
        "Created",
        "Updated",
        "Resolution due",
        "SLA state",
      ],
      ...rangedTickets.map((ticket) => [
        ticket.code,
        ticket.title,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.assignee || "Unassigned",
        ticket.requesterEmail,
        new Date(ticket.createdAt).toLocaleString(),
        new Date(ticket.updatedAt).toLocaleString(),
        new Date(ticket.resolutionDueAt).toLocaleString(),
        ticket.status === "Resolved"
          ? "Completed"
          : new Date(ticket.resolutionDueAt).getTime() < Date.now()
            ? "Breached"
            : "On track",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `glassco-it-support-kpi-${fromDate || range}-to-${toDate || "today"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function drillTickets(title: string, filter: (t: Ticket) => boolean) {
    setDrill({
      title,
      kind: "ticket",
      ids: rangedTickets.filter(filter).map((t) => t.id),
    });
  }
  function drillRequests(title: string, filter: (r: Request) => boolean) {
    setDrill({
      title,
      kind: "request",
      ids: rangedRequests.filter(filter).map((r) => r.id),
    });
  }
  const drillTicketsRows =
    drill?.kind === "ticket"
      ? tickets.filter((t) => drill.ids.includes(t.id))
      : [];
  const drillRequestRows =
    drill?.kind === "request"
      ? requests.filter((r) => drill.ids.includes(r.id))
      : [];
  return (
    <section className="support-analytics">
      <div className="support-page-heading">
        <div>
          <span>BUILD 08 · MANAGEMENT ANALYTICS</span>
          <h1>IT Support performance</h1>
          <p>
            Workload, SLA, fulfilment and self-service outcomes with direct
            operational drill-down.
          </p>
        </div>
        <div className="analytics-report-controls">
          <label>
            Reporting period
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as typeof range)}
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          {range === "custom" && (
            <>
              <label>
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
            </>
          )}
          <button type="button" onClick={exportReport}>
            Download KPI report
          </button>
        </div>
      </div>
      <div className="analytics-kpis">
        <button
          onClick={() =>
            drillTickets("Open support tickets", (t) => t.status !== "Resolved")
          }
        >
          <Icon name="support" size={21} />
          <span>
            Open tickets<strong>{open.length}</strong>
            <small>{breached.length} SLA breached</small>
          </span>
        </button>
        <button
          onClick={() =>
            drillTickets(
              "Resolved support tickets",
              (t) => t.status === "Resolved",
            )
          }
        >
          <Icon name="check" size={21} />
          <span>
            Resolved<strong>{resolved.length}</strong>
            <small>
              {pct(resolved.length, rangedTickets.length)}% of ticket volume
            </small>
          </span>
        </button>
        <button
          onClick={() =>
            drillRequests(
              "Open service requests",
              (r) => !["Fulfilled", "Rejected", "Cancelled"].includes(r.state),
            )
          }
        >
          <Icon name="requests" size={21} />
          <span>
            Service requests<strong>{fulfilmentOpen.length}</strong>
            <small>{fulfilled.length} fulfilled</small>
          </span>
        </button>
        <button onClick={() => setDrill(undefined)}>
          <Icon name="assurance" size={21} />
          <span>
            SLA compliance
            <strong>{100 - pct(breached.length, open.length)}%</strong>
            <small>Current open workload</small>
          </span>
        </button>
        <button onClick={() => setDrill(undefined)}>
          <Icon name="requests" size={21} />
          <span>
            Knowledge reach<strong>{views}</strong>
            <small>{pct(helpful, helpful + unhelpful)}% helpful</small>
          </span>
        </button>
        <button onClick={() => setDrill(undefined)}>
          <Icon name="mail" size={21} />
          <span>
            Notifications<strong>{deliveries.length}</strong>
            <small>Audited communication events</small>
          </span>
        </button>
      </div>
      <div className="analytics-grid">
        <section className="support-panel analytics-chart">
          <header>
            <div>
              <h2>Ticket volume by category</h2>
              <small>
                Hover for precise volume; select a bar to drill down.
              </small>
            </div>
          </header>
          <div className="bar-chart">
            {categories.map(([name, value], i) => (
              <button
                key={name}
                title={`${name}: ${value} tickets`}
                onClick={() => drillTickets(name, (t) => t.category === name)}
              >
                <span>{name}</span>
                <i>
                  <b
                    style={{
                      width: `${pct(value, Math.max(...categories.map((row) => row[1]), 1))}%`,
                      background: palette[i % palette.length],
                    }}
                  />
                </i>
                <strong>{value}</strong>
              </button>
            ))}
            {!categories.length && <p>No tickets in this period.</p>}
          </div>
        </section>
        <section className="support-panel analytics-chart">
          <header>
            <div>
              <h2>Priority distribution</h2>
              <small>Risk profile of incoming support demand.</small>
            </div>
          </header>
          <div className="donut-layout">
            <div
              className="donut"
              style={{
                background: `conic-gradient(${priorities.map(([, n], i) => `${palette[i]} ${(priorities.slice(0, i).reduce((s, row) => s + row[1], 0) / (rangedTickets.length || 1)) * 100}% ${((priorities.slice(0, i).reduce((s, row) => s + row[1], 0) + n) / (rangedTickets.length || 1)) * 100}%`).join(",")})`,
              }}
            >
              <span>
                <strong>{rangedTickets.length}</strong>tickets
              </span>
            </div>
            <div>
              {priorities.map(([name, value], i) => (
                <button
                  key={name}
                  onClick={() =>
                    drillTickets(`${name} priority`, (t) => t.priority === name)
                  }
                >
                  <i style={{ background: palette[i] }} />
                  <span>{name}</span>
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="support-panel analytics-chart">
          <header>
            <div>
              <h2>Queue state</h2>
              <small>Current flow across the service workflow.</small>
            </div>
          </header>
          <div className="bar-chart compact">
            {statuses.map(([name, value], i) => (
              <button
                key={name}
                onClick={() => drillTickets(name, (t) => t.status === name)}
              >
                <span>{name}</span>
                <i>
                  <b
                    style={{
                      width: `${pct(value, Math.max(...statuses.map((row) => row[1]), 1))}%`,
                      background: palette[i % palette.length],
                    }}
                  />
                </i>
                <strong>{value}</strong>
              </button>
            ))}
          </div>
        </section>
        <section className="support-panel analytics-chart">
          <header>
            <div>
              <h2>Team workload</h2>
              <small>Open and completed ownership by assignee.</small>
            </div>
          </header>
          <div className="team-table">
            <div>
              <span>Owner</span>
              <span>Open</span>
              <span>Resolved</span>
            </div>
            {team.map(([name, row]) => (
              <button
                key={name}
                onClick={() =>
                  drillTickets(
                    name,
                    (t) => (t.assignee || "Unassigned") === name,
                  )
                }
              >
                <strong>{name}</strong>
                <span>{row.open}</span>
                <span>{row.resolved}</span>
              </button>
            ))}
            {!team.length && <p>No ownership records in this period.</p>}
          </div>
        </section>
      </div>
      <section className="support-panel analytics-self">
        <header>
          <div>
            <h2>Self-service effectiveness</h2>
            <small>Knowledge coverage and employee feedback.</small>
          </div>
        </header>
        <div>
          <article>
            <span>Published articles</span>
            <strong>
              {articles.filter((a) => a.status === "Published").length}
            </strong>
          </article>
          <article>
            <span>Total article views</span>
            <strong>{views}</strong>
          </article>
          <article>
            <span>Helpful responses</span>
            <strong>{helpful}</strong>
          </article>
          <article>
            <span>Needs improvement</span>
            <strong>{unhelpful}</strong>
          </article>
          <article>
            <span>Helpful rate</span>
            <strong>{pct(helpful, helpful + unhelpful)}%</strong>
          </article>
        </div>
      </section>
      <section className="support-panel analytics-operations">
        <header>
          <div>
            <h2>Operational health</h2>
            <small>Essential indicators for daily IT Support management.</small>
          </div>
        </header>
        <div>
          <article>
            <span>Tickets received</span>
            <strong>{rangedTickets.length}</strong>
          </article>
          <article>
            <span>Average open age</span>
            <strong>{averageOpenHours}h</strong>
          </article>
          <article>
            <span>At SLA risk</span>
            <strong>
              {
                open.filter(
                  (ticket) =>
                    new Date(ticket.resolutionDueAt).getTime() - Date.now() <=
                      4 * 3600000 &&
                    new Date(ticket.resolutionDueAt).getTime() > Date.now(),
                ).length
              }
            </strong>
          </article>
          <article>
            <span>Breached</span>
            <strong>{breached.length}</strong>
          </article>
          <article>
            <span>Unassigned</span>
            <strong>{open.filter((ticket) => !ticket.assignee).length}</strong>
          </article>
        </div>
      </section>
      <section className="support-panel management-team-panel">
        <header>
          <div>
            <span className="management-eyebrow">MANAGEMENT VIEW</span>
            <h2>Team member KPIs and KRAs</h2>
            <small>
              Select a support owner to review their live workload, delivery
              targets and performance indicators.
            </small>
          </div>
          <label className="management-select">
            Team member
            <select
              value={teamMember}
              onChange={(e) => setTeamMember(e.target.value)}
            >
              <option>All team members</option>
              {team.map(([name]) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </header>
        <div className="management-kpis">
          <article>
            <span>Assigned volume</span>
            <strong>{selectedTeamTickets.length}</strong>
            <small>Tickets in period</small>
          </article>
          <article>
            <span>Open workload</span>
            <strong>{selectedOpen.length}</strong>
            <small>{selectedBreached.length} overdue</small>
          </article>
          <article>
            <span>Resolution rate</span>
            <strong>{resolutionRate}%</strong>
            <small>Target ≥ 90%</small>
          </article>
          <article>
            <span>SLA compliance</span>
            <strong>{selectedSla}%</strong>
            <small>Target ≥ 95%</small>
          </article>
          <article>
            <span>Critical exposure</span>
            <strong>{selectedCritical.length}</strong>
            <small>Open critical tickets</small>
          </article>
        </div>
        <div className="kra-list">
          <article>
            <div>
              <strong>Resolution ownership</strong>
              <span>
                Close assigned tickets within the agreed service target.
              </span>
            </div>
            <b
              className={resolutionRate >= 90 ? "on-track" : "needs-attention"}
            >
              {resolutionRate >= 90 ? "On track" : "Needs attention"} ·{" "}
              {resolutionRate}%
            </b>
          </article>
          <article>
            <div>
              <strong>SLA adherence</strong>
              <span>Keep active work inside the resolution commitment.</span>
            </div>
            <b className={selectedSla >= 95 ? "on-track" : "needs-attention"}>
              {selectedSla >= 95 ? "On track" : "Needs attention"} ·{" "}
              {selectedSla}%
            </b>
          </article>
          <article>
            <div>
              <strong>Queue hygiene</strong>
              <span>
                Maintain a clear, current queue with no overdue tickets.
              </span>
            </div>
            <b
              className={
                selectedBreached.length === 0 ? "on-track" : "needs-attention"
              }
            >
              {selectedBreached.length === 0 ? "On track" : "Needs attention"} ·{" "}
              {selectedBreached.length} overdue
            </b>
          </article>
        </div>
      </section>
      <section className="support-panel escalation-panel">
        <header>
          <div>
            <span className="management-eyebrow">ESCALATION MATRIX</span>
            <h2>Level-wise action queue</h2>
            <small>
              <strong>{escalationMeta.owner}:</strong> {escalationMeta.detail}
            </small>
          </div>
          <label className="management-select">
            Escalation level
            <select
              value={escalationLevel}
              onChange={(e) =>
                setEscalationLevel(e.target.value as typeof escalationLevel)
              }
            >
              <option>Level 1</option>
              <option>Level 2</option>
              <option>Level 3</option>
            </select>
          </label>
        </header>
        <div className="escalation-head">
          <span>Ticket</span>
          <span>Owner</span>
          <span>Priority</span>
          <span>Resolution due</span>
          <span>Action</span>
        </div>
        {escalations.map((ticket) => (
          <div className="escalation-row" key={ticket.id}>
            <strong>
              {ticket.code}
              <small>{ticket.title}</small>
            </strong>
            <span>{ticket.assignee || "Unassigned"}</span>
            <span className={`priority-${ticket.priority.toLowerCase()}`}>
              {ticket.priority}
            </span>
            <span>{new Date(ticket.resolutionDueAt).toLocaleString()}</span>
            <button onClick={() => onOpenTicket(ticket.id)}>
              Review ticket
            </button>
          </div>
        ))}
        {!escalations.length && (
          <div className="escalation-empty">
            No tickets currently require {escalationLevel.toLowerCase()} action
            for the selected team view.
          </div>
        )}
      </section>
      <SupportScorecard
        ratings={ratings}
        tickets={tickets}
        onOpenTicket={onOpenTicket}
      />
      {showTicketRegister ? <section className="support-panel analytics-report-table">
        <header>
          <div>
            <h2>IT Support ticket register</h2>
            <small>
              {rangedTickets.length} tickets in the selected reporting period.
              Use this table for operational review or download the KPI report.
            </small>
          </div>
          <div className="analytics-register-actions"><label>Search register<input value={ticketRegisterSearch} onChange={(event) => setTicketRegisterSearch(event.target.value)} placeholder="Ticket number, title, owner or status"/></label><button type="button" onClick={exportReport}>Export CSV</button><button type="button" className="analytics-secondary-action" onClick={() => setShowTicketRegister(false)}>Close register</button></div>
        </header>
        <div className="analytics-table-scroll">
          <div className="analytics-table-head">
            <span>Ticket</span>
            <span>Category</span>
            <span>Owner</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Created</span>
            <span>Resolution due</span>
            <span>SLA</span>
          </div>
          {visibleRegisterTickets.map((ticket) => (
              <button
                type="button"
                className="analytics-table-row"
                key={ticket.id}
                onClick={() => onOpenTicket(ticket.id)}
              >
                <span>
                  <strong>{ticket.code}</strong>
                  <small>{ticket.title}</small>
                </span>
                <span>{ticket.category}</span>
                <span>{ticket.assignee || "Unassigned"}</span>
                <span>{ticket.priority}</span>
                <span>{ticket.status}</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                <span>
                  {new Date(ticket.resolutionDueAt).toLocaleDateString()}
                </span>
                <b
                  className={
                    ticket.status === "Resolved"
                      ? "complete"
                      : new Date(ticket.resolutionDueAt).getTime() < Date.now()
                        ? "breached"
                        : "on-track"
                  }
                >
                  {ticket.status === "Resolved"
                    ? "Completed"
                    : new Date(ticket.resolutionDueAt).getTime() < Date.now()
                      ? "Breached"
                      : "On track"}
                </b>
              </button>
            ))}
          {!visibleRegisterTickets.length && (
            <p>{rangedTickets.length ? "No support tickets match this search." : "No support tickets were raised in this period."}</p>
          )}
        </div>
      </section> : <section className="support-panel analytics-register-launcher"><div><span>DETAILED REGISTER</span><h2>IT Support ticket register</h2><p>{rangedTickets.length} tickets are available for the selected reporting period. Open it only when you need operational detail, ticket lookup, or export.</p></div><button className="support-primary" type="button" onClick={() => setShowTicketRegister(true)}>Open ticket register</button></section>}
      {drill && (
        <section className="support-panel analytics-drill">
          <header>
            <div>
              <h2>{drill.title}</h2>
              <small>{drill.ids.length} underlying records</small>
            </div>
            <button onClick={() => setDrill(undefined)}>Close</button>
          </header>
          <div className="head">
            <span>Reference</span>
            <span>Title</span>
            <span>Owner / requester</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {drillTicketsRows.map((t) => (
            <div key={t.id}>
              <strong>{t.code}</strong>
              <span>{t.title}</span>
              <span>{t.assignee || t.requesterName}</span>
              <span>{t.status}</span>
              <button onClick={() => onOpenTicket(t.id)}>Open ticket</button>
            </div>
          ))}
          {drillRequestRows.map((r) => (
            <div key={r.id}>
              <strong>{r.code}</strong>
              <span>{r.title}</span>
              <span>{r.requesterName}</span>
              <span>{r.state}</span>
              <em>Service request</em>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
