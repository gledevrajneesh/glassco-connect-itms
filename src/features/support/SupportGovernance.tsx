import { useEffect, useMemo, useState } from "react";
import { useLocalStore } from "../../lib/localStore";
import { collection, onSnapshot, query } from "firebase/firestore";
import { firestore } from "../../lib/firebase";
import "./SupportGovernance.css";

export type SupportPriority = "Low" | "Medium" | "High" | "Critical";
export type SlaPolicy = {
  timezone: string;
  businessStart: string;
  businessEnd: string;
  workingDays: number[];
  reminderPercent: number;
  pauseStatuses: string[];
  targets: Record<
    SupportPriority,
    { responseMinutes: number; resolutionMinutes: number; escalateTo: string }
  >;
  updatedAt: string;
  updatedBy: string;
};
export type SupportDelivery = {
  id: string;
  ticketId: string;
  ticketCode: string;
  event: string;
  channel: "Portal" | "Email";
  recipient: string;
  template: string;
  status: "Recorded" | "Prepared" | "Failed";
  createdAt: string;
};
export type SupportTemplate = {
  id: string;
  event: string;
  subject: string;
  body: string;
  enabled: boolean;
};
type GovernanceTicket = {
  id: string;
  code: string;
  title: string;
  requesterEmail: string;
  priority: SupportPriority;
  status: string;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  assignee?: string;
};

export const defaultSlaPolicy: SlaPolicy = {
  timezone: "Asia/Kolkata",
  businessStart: "09:00",
  businessEnd: "18:00",
  workingDays: [1, 2, 3, 4, 5],
  reminderPercent: 75,
  pauseStatuses: ["Awaiting employee", "Awaiting approval"],
  updatedAt: "",
  updatedBy: "",
  targets: {
    Critical: {
      responseMinutes: 15,
      resolutionMinutes: 240,
      escalateTo: "Support Lead + IT Head",
    },
    High: {
      responseMinutes: 60,
      resolutionMinutes: 480,
      escalateTo: "Support Lead",
    },
    Medium: {
      responseMinutes: 240,
      resolutionMinutes: 960,
      escalateTo: "Service Desk Manager",
    },
    Low: {
      responseMinutes: 480,
      resolutionMinutes: 2400,
      escalateTo: "Service Desk Manager",
    },
  },
};

export const defaultSupportTemplates: SupportTemplate[] = [
  {
    id: "created",
    event: "Ticket created",
    subject: "{{ticket}} received",
    body: "Your request {{ticket}} has been recorded. Track progress in the employee portal.",
    enabled: true,
  },
  {
    id: "assigned",
    event: "Assignment changed",
    subject: "{{ticket}} assigned",
    body: "{{ticket}} is now assigned to {{assignee}}.",
    enabled: true,
  },
  {
    id: "reply",
    event: "Agent reply",
    subject: "New update on {{ticket}}",
    body: "The IT service team has posted a new reply. Open the portal to respond.",
    enabled: true,
  },
  {
    id: "waiting",
    event: "Waiting for employee",
    subject: "Action required on {{ticket}}",
    body: "IT needs information from you before work can continue.",
    enabled: true,
  },
  {
    id: "sla",
    event: "SLA escalation",
    subject: "SLA attention: {{ticket}}",
    body: "{{ticket}} is approaching or has exceeded its governed SLA.",
    enabled: true,
  },
  {
    id: "resolved",
    event: "Ticket resolved",
    subject: "{{ticket}} resolved",
    body: "The request has been resolved. Review the resolution or reopen it from the portal.",
    enabled: true,
  },
];

const standardTimezones = [
  { value: "Asia/Kolkata", label: "India Standard Time — Asia/Kolkata (UTC+05:30)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time — Asia/Dubai (UTC+04:00)" },
  { value: "Asia/Singapore", label: "Singapore Standard Time — Asia/Singapore (UTC+08:00)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time — Asia/Tokyo (UTC+09:00)" },
  { value: "Europe/London", label: "UK Time — Europe/London" },
  { value: "Europe/Berlin", label: "Central European Time — Europe/Berlin" },
  { value: "America/New_York", label: "US Eastern Time — America/New_York" },
  { value: "America/Chicago", label: "US Central Time — America/Chicago" },
  { value: "America/Los_Angeles", label: "US Pacific Time — America/Los_Angeles" },
  { value: "Australia/Sydney", label: "Australian Eastern Time — Australia/Sydney" },
  { value: "UTC", label: "Coordinated Universal Time — UTC" },
];

export function addBusinessMinutes(
  startValue: string,
  minutes: number,
  policy: SlaPolicy,
) {
  let cursor = new Date(startValue);
  let remaining = minutes;
  const [startHour, startMinute] = policy.businessStart.split(":").map(Number);
  const [endHour, endMinute] = policy.businessEnd.split(":").map(Number);
  while (remaining > 0) {
    const day = cursor.getDay();
    const opening = new Date(cursor);
    opening.setHours(startHour, startMinute, 0, 0);
    const closing = new Date(cursor);
    closing.setHours(endHour, endMinute, 0, 0);
    if (!policy.workingDays.includes(day) || cursor >= closing) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(startHour, startMinute, 0, 0);
      continue;
    }
    if (cursor < opening) cursor = opening;
    const available = Math.max(
      0,
      Math.floor((closing.getTime() - cursor.getTime()) / 60000),
    );
    const used = Math.min(remaining, available);
    cursor = new Date(cursor.getTime() + used * 60000);
    remaining -= used;
  }
  return cursor.toISOString();
}

export function recordSupportDelivery(
  setDeliveries: React.Dispatch<React.SetStateAction<SupportDelivery[]>>,
  ticket: Pick<GovernanceTicket, "id" | "code" | "requesterEmail">,
  event: string,
  recipient?: string,
  channel: "Portal" | "Email" = "Portal",
) {
  setDeliveries((current) => [
    ...current,
    {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      ticketCode: ticket.code,
      event,
      channel,
      recipient: recipient || ticket.requesterEmail,
      template: event,
      status: channel === "Portal" ? "Recorded" : "Prepared",
      createdAt: new Date().toISOString(),
    },
  ]);
}

type MailOutboxRow = {
  id: string;
  ticketId: string;
  ticketCode: string;
  recipient: string;
  event: string;
  status: "Queued" | "Processing" | "Retry" | "Sent" | "Failed";
  attempts?: number;
  createdAt: string;
  sentAt?: string;
  lastAttemptAt?: string;
  failedAt?: string;
  error?: string;
};
export default function SupportGovernance({
  tickets,
  identityEmail,
  onOpenTicket,
}: {
  tickets: GovernanceTicket[];
  identityEmail: string;
  onOpenTicket: (id: string) => void;
}) {
  const [tab, setTab] = useState<
    "policy" | "templates" | "escalations" | "history" | "outbox"
  >("policy");
  const [policy, setPolicy] = useLocalStore<SlaPolicy>(
    "connect.support-sla-policy.v1",
    defaultSlaPolicy,
  );
  const [templates, setTemplates] = useLocalStore<SupportTemplate[]>(
    "connect.support-templates.v1",
    defaultSupportTemplates,
  );
  const [deliveries, setDeliveries] = useLocalStore<SupportDelivery[]>(
    "connect.support-deliveries.v1",
    [],
  );
  const [historySearch, setHistorySearch] = useState("");
  const [historyChannel, setHistoryChannel] = useState<
    "All" | SupportDelivery["channel"]
  >("All");
  const [historyStatus, setHistoryStatus] = useState<
    "All" | SupportDelivery["status"]
  >("All");
  const [historyEvent, setHistoryEvent] = useState("All");
  const [outbox, setOutbox] = useState<MailOutboxRow[]>([]);
  const [outboxSearch, setOutboxSearch] = useState("");
  useEffect(() => {
    if (!firestore) return;
    return onSnapshot(
      query(collection(firestore, "supportMailQueue")),
      (snapshot) =>
        setOutbox(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }) as MailOutboxRow)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
      () => setOutbox([]),
    );
  }, []);
  const escalationRows = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.status !== "Resolved")
        .map((ticket) => ({
          ticket,
          due: new Date(ticket.resolutionDueAt).getTime(),
          responseDue: new Date(ticket.firstResponseDueAt).getTime(),
        }))
        .filter(
          (row) => row.due <= Date.now() || row.due - Date.now() <= 4 * 3600000,
        )
        .sort((a, b) => a.due - b.due),
    [tickets],
  );
  const deliveryEvents = useMemo(
    () => [...new Set(deliveries.map((delivery) => delivery.event))].sort(),
    [deliveries],
  );
  const visibleDeliveries = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return [...deliveries]
      .reverse()
      .filter(
        (delivery) =>
          (historyChannel === "All" || delivery.channel === historyChannel) &&
          (historyStatus === "All" || delivery.status === historyStatus) &&
          (historyEvent === "All" || delivery.event === historyEvent) &&
          (!term ||
            `${delivery.ticketCode} ${delivery.event} ${delivery.channel} ${delivery.recipient} ${delivery.status}`
              .toLowerCase()
              .includes(term)),
      );
  }, [deliveries, historyChannel, historyEvent, historySearch, historyStatus]);
  const visibleOutbox = useMemo(() => {
    const term = outboxSearch.trim().toLowerCase();
    return outbox.filter(
      (item) =>
        !term ||
        `${item.ticketCode} ${item.event} ${item.recipient} ${item.status}`
          .toLowerCase()
          .includes(term),
    );
  }, [outbox, outboxSearch]);
  const savePolicy = () =>
    setPolicy({
      ...policy,
      updatedAt: new Date().toISOString(),
      updatedBy: identityEmail,
    });
  const runMonitor = () => {
    escalationRows.forEach(({ ticket, due }) => {
      const event = due <= Date.now() ? "SLA breached" : "SLA reminder";
      if (
        !deliveries.some(
          (delivery) =>
            delivery.ticketId === ticket.id && delivery.event === event,
        )
      )
        recordSupportDelivery(
          setDeliveries,
          ticket,
          event,
          policy.targets[ticket.priority].escalateTo,
          "Portal",
        );
    });
  };
  return (
    <section className="support-governance">
      <div className="support-page-heading">
        <div>
          <span>BUILD 05 · SERVICE GOVERNANCE</span>
          <h1>SLA & notification control</h1>
          <p>
            Govern service targets, reminders, escalations and auditable
            communication from one place.
          </p>
        </div>
        <button type="button" onClick={runMonitor}>
          Run SLA monitor
        </button>
      </div>
      <div className="support-governance-tabs">
        {(
          [
            ["policy", "SLA policy"],
            ["templates", "Templates"],
            ["escalations", "Escalation queue"],
            ["history", "Delivery history"],
            ["outbox", "Email outbox"],
          ] as const
        ).map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            type="button"
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "policy" && (
        <section className="support-panel support-policy">
          <header>
            <div>
              <h2>Business-hours policy</h2>
              <small>
                Targets pause while a ticket is waiting for employee input or
                approval.
              </small>
            </div>
            <button
              className="support-primary"
              type="button"
              onClick={savePolicy}
            >
              Save policy
            </button>
          </header>
          <div className="support-policy-settings">
            <label>
              Timezone
              <select
                value={policy.timezone}
                onChange={(event) =>
                  setPolicy({ ...policy, timezone: event.target.value })
                }
              >
                {!standardTimezones.some((zone) => zone.value === policy.timezone) && <option value={policy.timezone}>{policy.timezone}</option>}
                {standardTimezones.map((zone) => <option value={zone.value} key={zone.value}>{zone.label}</option>)}
              </select>
            </label>
            <label>
              Business day starts
              <input
                type="time"
                value={policy.businessStart}
                onChange={(event) =>
                  setPolicy({ ...policy, businessStart: event.target.value })
                }
              />
            </label>
            <label>
              Business day ends
              <input
                type="time"
                value={policy.businessEnd}
                onChange={(event) =>
                  setPolicy({ ...policy, businessEnd: event.target.value })
                }
              />
            </label>
            <label>
              Reminder at % of target
              <input
                type="number"
                min="25"
                max="95"
                value={policy.reminderPercent}
                onChange={(event) =>
                  setPolicy({
                    ...policy,
                    reminderPercent: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <div className="support-policy-table">
            <div>
              <strong>Priority</strong>
              <strong>First response</strong>
              <strong>Resolution</strong>
              <strong>Escalation recipient</strong>
            </div>
            {(["Critical", "High", "Medium", "Low"] as SupportPriority[]).map(
              (priority) => (
                <div key={priority}>
                  <strong>{priority}</strong>
                  <label>
                    <input
                      type="number"
                      value={policy.targets[priority].responseMinutes}
                      onChange={(event) =>
                        setPolicy({
                          ...policy,
                          targets: {
                            ...policy.targets,
                            [priority]: {
                              ...policy.targets[priority],
                              responseMinutes: Number(event.target.value),
                            },
                          },
                        })
                      }
                    />
                    <span>minutes</span>
                  </label>
                  <label>
                    <input
                      type="number"
                      value={policy.targets[priority].resolutionMinutes}
                      onChange={(event) =>
                        setPolicy({
                          ...policy,
                          targets: {
                            ...policy.targets,
                            [priority]: {
                              ...policy.targets[priority],
                              resolutionMinutes: Number(event.target.value),
                            },
                          },
                        })
                      }
                    />
                    <span>minutes</span>
                  </label>
                  <input
                    value={policy.targets[priority].escalateTo}
                    onChange={(event) =>
                      setPolicy({
                        ...policy,
                        targets: {
                          ...policy.targets,
                          [priority]: {
                            ...policy.targets[priority],
                            escalateTo: event.target.value,
                          },
                        },
                      })
                    }
                  />
                </div>
              ),
            )}
          </div>
          {policy.updatedAt && (
            <footer>
              Last governed change:{" "}
              {new Date(policy.updatedAt).toLocaleString("en-IN")} ·{" "}
              {policy.updatedBy}
            </footer>
          )}
        </section>
      )}
      {tab === "templates" && (
        <section className="support-panel support-template-list">
          <header>
            <div>
              <h2>Controlled notification templates</h2>
              <small>
                Placeholders remain visible and can be integrated with an email
                service later.
              </small>
            </div>
          </header>
          {templates.map((template) => (
            <article key={template.id}>
              <label>
                <input
                  type="checkbox"
                  checked={template.enabled}
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item) =>
                        item.id === template.id
                          ? { ...item, enabled: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                {template.event}
              </label>
              <input
                value={template.subject}
                onChange={(event) =>
                  setTemplates((current) =>
                    current.map((item) =>
                      item.id === template.id
                        ? { ...item, subject: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <textarea
                value={template.body}
                onChange={(event) =>
                  setTemplates((current) =>
                    current.map((item) =>
                      item.id === template.id
                        ? { ...item, body: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </article>
          ))}
        </section>
      )}
      {tab === "escalations" && (
        <section className="support-panel support-governance-table">
          <header>
            <div>
              <h2>Attention and breach queue</h2>
              <small>
                {escalationRows.length} active tickets require SLA attention.
              </small>
            </div>
          </header>
          <div className="head">
            <span>Ticket</span>
            <span>Priority</span>
            <span>Owner</span>
            <span>Resolution target</span>
            <span>Action</span>
          </div>
          {escalationRows.map(({ ticket, due }) => (
            <div key={ticket.id}>
              <span>
                <strong>{ticket.code}</strong>
                <small>{ticket.title}</small>
              </span>
              <span>{ticket.priority}</span>
              <span>{ticket.assignee || "Unassigned"}</span>
              <span className={due <= Date.now() ? "breached" : ""}>
                {due <= Date.now() ? "Breached" : "Due"} ·{" "}
                {new Date(ticket.resolutionDueAt).toLocaleString("en-IN")}
              </span>
              <button type="button" onClick={() => onOpenTicket(ticket.id)}>
                Open ticket
              </button>
            </div>
          ))}
          {!escalationRows.length && (
            <p>No tickets currently require escalation.</p>
          )}
        </section>
      )}
      {tab === "history" && (
        <section className="support-panel support-governance-table support-delivery-history">
          <header>
            <div>
              <span className="delivery-eyebrow">AUDITABLE COMMUNICATION</span>
              <h2>Communication delivery register</h2>
              <small>
                Portal activity is confirmed; email remains prepared until the
                sending service reports delivery.
              </small>
            </div>
            <strong className="delivery-count">
              {visibleDeliveries.length}
              <small>matching records</small>
            </strong>
          </header>
          <div className="delivery-toolbar">
            <label className="delivery-search">
              <span>Search history</span>
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Ticket, event, recipient or status"
              />
            </label>
            <label>
              Channel
              <select
                value={historyChannel}
                onChange={(event) =>
                  setHistoryChannel(event.target.value as typeof historyChannel)
                }
              >
                <option>All</option>
                <option>Portal</option>
                <option>Email</option>
              </select>
            </label>
            <label>
              Delivery status
              <select
                value={historyStatus}
                onChange={(event) =>
                  setHistoryStatus(event.target.value as typeof historyStatus)
                }
              >
                <option>All</option>
                <option>Recorded</option>
                <option>Prepared</option>
                <option>Failed</option>
              </select>
            </label>
            <label>
              Event
              <select
                value={historyEvent}
                onChange={(event) => setHistoryEvent(event.target.value)}
              >
                <option>All</option>
                {deliveryEvents.map((event) => (
                  <option key={event}>{event}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setHistorySearch("");
                setHistoryChannel("All");
                setHistoryStatus("All");
                setHistoryEvent("All");
              }}
            >
              Clear filters
            </button>
          </div>
          <div className="delivery-table-scroll">
            <div className="head history">
              <span>Ticket / event</span>
              <span>Channel</span>
              <span>Recipient</span>
              <span>Status / time</span>
              <span>Action</span>
            </div>
            {visibleDeliveries.map((delivery) => (
              <div className="history" key={delivery.id}>
                <span>
                  <strong>{delivery.ticketCode}</strong>
                  <small>{delivery.event}</small>
                </span>
                <span>
                  <b
                    className={`delivery-channel ${delivery.channel.toLowerCase()}`}
                  >
                    {delivery.channel}
                  </b>
                </span>
                <span>{delivery.recipient}</span>
                <span>
                  <b
                    className={`delivery-status ${delivery.status.toLowerCase()}`}
                  >
                    {delivery.status}
                  </b>
                  <small>
                    {new Date(delivery.createdAt).toLocaleString("en-IN")}
                  </small>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenTicket(delivery.ticketId)}
                >
                  Open
                </button>
              </div>
            ))}
            {!deliveries.length && (
              <p>No Support Desk notifications recorded yet.</p>
            )}
            {deliveries.length > 0 && !visibleDeliveries.length && (
              <p>No delivery records match the selected filters.</p>
            )}
          </div>
        </section>
      )}
      {tab === "outbox" && (
        <section className="support-panel support-governance-table support-delivery-history">
          <header>
            <div>
              <span className="delivery-eyebrow">
                LIVE GMAIL BRIDGE MONITOR
              </span>
              <h2>Email outbox</h2>
              <small>
                Queued mail is processed by the controlled Gmail bridge. Sent
                means Gmail accepted the message; delivery after that remains
                provider-side.
              </small>
            </div>
            <strong className="delivery-count">
              {outbox.filter((item) => item.status !== "Sent").length}
              <small>awaiting attention</small>
            </strong>
          </header>
          <div className="delivery-toolbar outbox-toolbar">
            <label className="delivery-search">
              <span>Search outbox</span>
              <input
                value={outboxSearch}
                onChange={(event) => setOutboxSearch(event.target.value)}
                placeholder="Ticket, event, recipient or status"
              />
            </label>
            <span>
              {visibleOutbox.length} of {outbox.length} messages
            </span>
          </div>
          <div className="delivery-table-scroll">
            <div className="head history">
              <span>Ticket / event</span>
              <span>Recipient</span>
              <span>Attempts</span>
              <span>Status / time</span>
              <span>Action</span>
            </div>
            {visibleOutbox.map((item) => (
              <div className="history" key={item.id}>
                <span>
                  <strong>{item.ticketCode}</strong>
                  <small>{item.event}</small>
                </span>
                <span>{item.recipient}</span>
                <span>{item.attempts || 0}</span>
                <span>
                  <b className={`delivery-status ${item.status.toLowerCase()}`}>
                    {item.status}
                  </b>
                  <small>
                    {new Date(
                      item.sentAt ||
                        item.lastAttemptAt ||
                        item.failedAt ||
                        item.createdAt,
                    ).toLocaleString("en-IN")}
                    {item.error ? ` · ${item.error}` : ""}
                  </small>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenTicket(item.ticketId)}
                >
                  Open
                </button>
              </div>
            ))}
            {!outbox.length && (
              <p>No Gmail bridge messages are currently visible.</p>
            )}
            {outbox.length > 0 && !visibleOutbox.length && (
              <p>No outbox messages match this search.</p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
