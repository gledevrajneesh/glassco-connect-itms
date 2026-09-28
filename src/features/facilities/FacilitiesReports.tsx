import { useMemo, useState } from "react";
import "./FacilitiesReports.css";

type ReportRow = {
  id: string;
  code: string;
  requesterName: string;
  departmentName: string;
  sectionName: string;
  issueType: string;
  site: string;
  area: string;
  urgency: string;
  state: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  materialNcrCode?: string;
  materialGrnNumber?: string;
};
const closed = new Set(["Resolved", "Closed", "Cancelled"]);
const quote = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function FacilitiesReports({
  rows,
  operator,
}: {
  rows: ReportRow[];
  operator: boolean;
}) {
  const [search, setSearch] = useState(""),
    [section, setSection] = useState("All"),
    [status, setStatus] = useState("All"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sort, setSort] = useState("newest");
  const sections = [...new Set(rows.map((row) => row.sectionName))].sort();
  const visible = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            (section === "All" || row.sectionName === section) &&
            (status === "All" || row.state === status) &&
            (!from || row.createdAt.slice(0, 10) >= from) &&
            (!to || row.createdAt.slice(0, 10) <= to) &&
            (!search.trim() ||
              `${row.code} ${row.requesterName} ${row.departmentName} ${row.sectionName} ${row.issueType} ${row.site} ${row.area} ${row.owner} ${row.materialNcrCode || ""} ${row.materialGrnNumber || ""}`
                .toLowerCase()
                .includes(search.toLowerCase())),
        )
        .sort((a, b) =>
          sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [rows, search, section, status, from, to, sort],
  );
  const completed = visible.filter((row) => closed.has(row.state)),
    avgHours = completed.length
      ? Math.round(
          completed.reduce(
            (sum, row) =>
              sum +
              Math.max(
                0,
                Date.parse(row.updatedAt) - Date.parse(row.createdAt),
              ),
            0,
          ) /
            completed.length /
            3600000,
        )
      : 0,
    waiting = visible.filter((row) => row.state.startsWith("Waiting")).length,
    open = visible.filter((row) => !closed.has(row.state)).length;
  function download() {
    const csv = [
      [
        "Request",
        "Created",
        "Requester",
        "Department",
        "Section",
        "Issue",
        "Location",
        "Urgency",
        "Owner",
        "Status",
        "NCR",
        "GRN",
        "Updated",
      ],
      ...visible.map((row) => [
        row.code,
        row.createdAt,
        row.requesterName,
        row.departmentName,
        row.sectionName,
        row.issueType,
        `${row.site} · ${row.area}`,
        row.urgency,
        row.owner,
        row.state,
        row.materialNcrCode || "",
        row.materialGrnNumber || "",
        row.updatedAt,
      ]),
    ]
      .map((line) => line.map(quote).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
        new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = `Facilities-${operator ? "operations" : "my-requests"}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="fac-reports">
      <header>
        <div>
          <small>
            {operator ? "OPERATIONS ANALYTICS" : "MY SERVICE HISTORY"}
          </small>
          <h2>Facilities performance</h2>
          <p>
            Search, investigate and download maintenance activity from the
            controlled record.
          </p>
        </div>
        <button onClick={download}>Download CSV</button>
      </header>
      <div className="fac-report-kpis">
        <article>
          <span>Requests</span>
          <strong>{visible.length}</strong>
        </article>
        <article>
          <span>Open workload</span>
          <strong>{open}</strong>
        </article>
        <article>
          <span>Waiting</span>
          <strong>{waiting}</strong>
        </article>
        <article>
          <span>Resolved / closed</span>
          <strong>{completed.length}</strong>
        </article>
        <article>
          <span>Average completion</span>
          <strong>{avgHours}h</strong>
        </article>
      </div>
      <div className="fac-report-filters">
        <label>
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Request, person, department, issue, owner, NCR or GRN"
          />
        </label>
        <label>
          Section
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <option>All</option>
            {sections.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All</option>
            {[...new Set(rows.map((row) => row.state))].sort().map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest activity</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button
          onClick={() => {
            setSearch("");
            setSection("All");
            setStatus("All");
            setFrom("");
            setTo("");
            setSort("newest");
          }}
        >
          Clear
        </button>
      </div>
      <div className="fac-report-table">
        <header>
          <span>Request</span>
          <span>Requester / department</span>
          <span>Section / issue</span>
          <span>Owner</span>
          <span>Status</span>
          <span>NCR / GRN</span>
        </header>
        {visible.map((row) => (
          <article key={row.id}>
            <span>
              <strong>{row.code}</strong>
              <small>
                {new Date(row.createdAt).toLocaleDateString("en-IN")} ·{" "}
                {row.urgency}
              </small>
            </span>
            <span>
              <strong>{row.requesterName}</strong>
              <small>{row.departmentName}</small>
            </span>
            <span>
              {row.sectionName}
              <small>
                {row.issueType} · {row.site} · {row.area}
              </small>
            </span>
            <span>{row.owner}</span>
            <b>{row.state}</b>
            <span>
              {row.materialNcrCode || "—"}
              <small>{row.materialGrnNumber || "No GRN"}</small>
            </span>
          </article>
        ))}
        {!visible.length && (
          <p>No Facilities records match the current filters.</p>
        )}
      </div>
    </section>
  );
}
