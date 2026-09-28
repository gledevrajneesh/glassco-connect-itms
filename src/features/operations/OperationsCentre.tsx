import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import DataTable from "../../components/DataTable";
import Icon from "../../components/Icon";
import { useLocalStore } from "../../lib/localStore";
import {
  openAttachment,
  retainAttachment,
  type LocalAttachment,
} from "../../lib/localAttachmentStore";
import {
  cloudOperationalReady,
  inspectCloudMigration,
  migrateLocalStoresToCloud,
  type CloudStoreStatus,
} from "../../lib/cloudStore";
import { firebaseAuth } from "../../lib/firebase";
import {
  subscribeWorkspaceSearch,
  type WorkspaceSearchRow,
} from "../../lib/workspaceSearch";
import {
  subscribeIntegrationHealth,
  subscribePendingWorkspaceEvents,
  type IntegrationHealth,
  type WorkspaceEvent,
} from "../../lib/workspaceIntegration";
import "./OperationsCentre.css";

type Tab =
  | "Global search"
  | "Workspace health"
  | "Approval inbox"
  | "Warranty"
  | "Stock verification"
  | "Controlled export"
  | "Backup planner"
  | "Backup register"
  | "Cloud migration"
  | "Notification rules"
  | "Data quality";
type Basic = {
  id: string;
  code: string;
  name: string;
  email?: string;
  contact?: string;
};
type User = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  departmentId: string;
  locationId: string;
  groupId: string;
  status: string;
};
type Asset = {
  id: string;
  assetId: string;
  typeId: string;
  modelId: string;
  serialNumber: string;
  locationId: string;
  configId: string;
  purchaseDate: string;
  cost: number;
  condition: string;
  stockStatus: string;
};
type Model = {
  id: string;
  code: string;
  name: string;
  brand: string;
  typeId: string;
  warrantyMonths: string;
};
type Allocation = {
  id: string;
  code: string;
  userId: string;
  assetIds: string[];
  state: string;
  requestedAt: string;
};
type Maintenance = {
  id: string;
  code: string;
  assetId: string;
  activity: string;
  vendorId: string;
  state: string;
  dueDate: string;
  createdAt: string;
  completedAt: string;
};
type Incident = {
  id: string;
  code: string;
  assetId: string;
  userId: string;
  type: string;
  status: string;
  reportedAt: string;
  notes: string;
};
type Lifecycle = {
  id: string;
  code: string;
  kind: string;
  userId: string;
  assetIds: string[];
  state: string;
  createdAt: string;
};
type Disposal = {
  id: string;
  code: string;
  assetId: string;
  state: string;
  requestedAt: string;
  managerAt: string;
};
type Retirement = {
  id: string;
  code: string;
  assetIds: string[];
  assetId?: string;
  route: string;
  state: string;
  requestedAt: string;
  managerAt: string;
};
type Verification = {
  id: string;
  code: string;
  assetId: string;
  result: string;
  verifiedDate: string;
  createdAt: string;
};
type ClaimStatus =
  | "Draft"
  | "Submitted"
  | "Accepted"
  | "Dispatched"
  | "Vendor processing"
  | "Rejected"
  | "Resolved";
type WarrantyClaim = {
  id: string;
  code: string;
  assetId: string;
  vendorId: string;
  reportedDate: string;
  rmaReference: string;
  claimStatus: ClaimStatus;
  issue?: string;
  dispatchDate?: string;
  returnDate?: string;
  resolutionType?:
    | "Pending"
    | "Repaired"
    | "Replaced"
    | "Credit note"
    | "Rejected";
  replacementAssetId?: string;
  replacementOutcome: string;
  attachment?: LocalAttachment;
  history?: { id: string; status: ClaimStatus; note: string; at: string }[];
  closedAt: string;
  updatedAt: string;
};
type NotificationRule = {
  id: string;
  event: string;
  recipient: string;
  leadDays: number;
  escalationDays: number;
  enabled: boolean;
  updatedAt: string;
};
type BackupSchedule = {
  enabled: boolean;
  frequency: "Daily" | "Weekly" | "Monthly";
  weekday: number;
  monthDay: number;
  time: string;
  timezone: string;
  destination: string;
  retentionDays: number;
  updatedAt: string;
};
type BackupCompletion = {
  id: string;
  scheduledFor: string;
  completedAt: string;
  performedBy: string;
  destination: string;
  verification: "Verified" | "Partially verified" | "Failed";
  sizeMb: number;
  recordCount: number;
  retentionUntil: string;
  notes: string;
  createdAt: string;
};
type SearchRow = {
  id: string;
  kind: string;
  reference: string;
  title: string;
  detail: string;
  module: string;
  application?: string;
  recordId?: string;
  route?: string;
};
type ApprovalRow = {
  id: string;
  kind: string;
  reference: string;
  state: string;
  submitted: string;
  module: string;
};
type QualityIssue = {
  id: string;
  severity: "Critical" | "Warning";
  kind: string;
  reference: string;
  issue: string;
  module: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const defaultBackupSchedule: BackupSchedule = {
  enabled: false,
  frequency: "Weekly",
  weekday: 0,
  monthDay: 1,
  time: "02:00",
  timezone: "Asia/Kolkata",
  destination: "Google Cloud / approved archive",
  retentionDays: 90,
  updatedAt: "",
};
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function nextBackup(schedule: BackupSchedule) {
  if (!schedule.enabled) return "Planner disabled";
  const [hours, minutes] = schedule.time.split(":").map(Number);
  const now = new Date(),
    next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  if (schedule.frequency === "Daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (schedule.frequency === "Weekly") {
    const add = (schedule.weekday - next.getDay() + 7) % 7;
    if (add === 0 && next <= now) next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + add);
  } else {
    next.setDate(Math.min(Math.max(schedule.monthDay, 1), 28));
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(Math.max(schedule.monthDay, 1), 28));
    }
  }
  return next.toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
  });
}
const localDateTime = () => {
  const value = new Date();
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};
const retentionDate = (completedAt: string, days: number) => {
  const value = new Date(completedAt);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};
const addMonths = (date: string, months: number) => {
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) return "";
  value.setMonth(value.getMonth() + months);
  return value.toISOString().slice(0, 10);
};
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([type.includes("csv") ? "\ufeff" : "", content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function OperationsCentre({
  onNavigate,
}: {
  onNavigate: (module: string, focus?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("Global search");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [claimOpen, setClaimOpen] = useState(false);
  const [editingClaimId, setEditingClaimId] = useState("");
  const [claimFile, setClaimFile] = useState<File | null>(null);
  const [cloudStatuses, setCloudStatuses] = useState<CloudStoreStatus[]>([]);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [workspaceRows, setWorkspaceRows] = useState<WorkspaceSearchRow[]>([]);
  const [integrationHealth, setIntegrationHealth] = useState<
    IntegrationHealth[]
  >([]);
  const [pendingEvents, setPendingEvents] = useState<WorkspaceEvent[]>([]);
  const [backupSchedule, setBackupSchedule] = useLocalStore<BackupSchedule>(
    "connect.backup-schedule.v1",
    defaultBackupSchedule,
  );
  const [backupCompletions, setBackupCompletions] = useLocalStore<
    BackupCompletion[]
  >("connect.backup-completions.v1", []);
  const [backupFormOpen, setBackupFormOpen] = useState(false);
  const [backupQuery, setBackupQuery] = useState("");
  const [backupFrom, setBackupFrom] = useState("");
  const [backupTo, setBackupTo] = useState("");
  const blankBackup = {
    scheduledFor: localDateTime(),
    completedAt: localDateTime(),
    performedBy: firebaseAuth?.currentUser?.email ?? "",
    destination: backupSchedule.destination,
    verification: "Verified" as BackupCompletion["verification"],
    sizeMb: 0,
    recordCount: 0,
    notes: "",
  };
  const [backupCompletion, setBackupCompletion] = useState(blankBackup);
  const [users] = useLocalStore<User[]>("itms.users.v1", []);
  const [departments] = useLocalStore<Basic[]>("itms.departments.v1", []);
  const [locations] = useLocalStore<Basic[]>("itms.locations.v1", []);
  const [userGroups] = useLocalStore<Basic[]>("itms.user-groups.v1", []);
  const [vendors] = useLocalStore<Basic[]>("itms.vendors.v1", []);
  const [types] = useLocalStore<Basic[]>("itms.asset-types.v1", []);
  const [models] = useLocalStore<Model[]>("itms.asset-models.v1", []);
  const [profiles] = useLocalStore<Basic[]>("itms.config-profiles.v1", []);
  const [assets] = useLocalStore<Asset[]>("itms.assets.v1", []);
  const [allocations] = useLocalStore<Allocation[]>("itms.allocations.v1", []);
  const [maintenance] = useLocalStore<Maintenance[]>(
    "itms.asset-maintenance.v1",
    [],
  );
  const [incidents] = useLocalStore<Incident[]>("itms.asset-incidents.v1", []);
  const [lifecycle] = useLocalStore<Lifecycle[]>(
    "itms.employee-lifecycle.v1",
    [],
  );
  const [disposals] = useLocalStore<Disposal[]>("itms.asset-disposals.v1", []);
  const [retirements] = useLocalStore<Retirement[]>(
    "itms.asset-retirements.v1",
    [],
  );
  const [verifications] = useLocalStore<Verification[]>(
    "itms.asset-verifications.v1",
    [],
  );
  const [claims, setClaims] = useLocalStore<WarrantyClaim[]>(
    "itms.warranty-claims.v1",
    [],
  );
  const [rules, setRules] = useLocalStore<NotificationRule[]>(
    "itms.notification-rules.v1",
    [],
  );
  const blankClaim = {
    assetId: "",
    vendorId: "",
    reportedDate: today(),
    rmaReference: "",
    claimStatus: "Draft" as ClaimStatus,
    issue: "",
    dispatchDate: "",
    returnDate: "",
    resolutionType: "Pending" as NonNullable<WarrantyClaim["resolutionType"]>,
    replacementAssetId: "",
    replacementOutcome: "",
  };
  const [claim, setClaim] = useState(blankClaim);
  useEffect(() => subscribeWorkspaceSearch(setWorkspaceRows), []);
  useEffect(() => subscribeIntegrationHealth(setIntegrationHealth), []);
  useEffect(() => subscribePendingWorkspaceEvents(setPendingEvents), []);
  void profiles;
  const assetLabel = useCallback(
    (id: string) => {
      const asset = assets.find((item) => item.id === id),
        model = models.find((item) => item.id === asset?.modelId);
      return asset
        ? `${asset.assetId} · ${model?.brand ?? ""} ${model?.name ?? "Unknown model"}`
        : "Unavailable asset";
    },
    [assets, models],
  );
  const userLabel = useCallback(
    (id: string) => {
      const user = users.find((item) => item.id === id);
      return user ? `${user.employeeCode} · ${user.name}` : "Unavailable user";
    },
    [users],
  );
  const go = (module: string, focus: string) => {
    localStorage.setItem(
      "itms.navigation-focus.v1",
      JSON.stringify({ module, focus, at: new Date().toISOString() }),
    );
    onNavigate(module, focus);
  };
  const openSearchRow = (item: SearchRow) => {
    if (item.application && item.application !== "ITMS") {
      localStorage.setItem(
        "workspace.navigation-target.v1",
        JSON.stringify({
          application: item.application === "ITSD" ? "support" : "requests",
          target: item.route,
          recordId: item.recordId,
          at: new Date().toISOString(),
        }),
      );
      window.location.href = `/?app=${item.application === "ITSD" ? "support" : "requests"}`;
      return;
    }
    go(item.module, item.reference);
  };
  const searchRows = useMemo<SearchRow[]>(
    () => [
      ...assets.map((item) => ({
        id: `asset-${item.id}`,
        kind: "Asset",
        reference: item.assetId,
        title: assetLabel(item.id),
        detail: `Serial ${item.serialNumber || "N/A"} · ${item.stockStatus}`,
        module: "Asset Inventory",
      })),
      ...users.map((item) => ({
        id: `user-${item.id}`,
        kind: "Employee",
        reference: item.employeeCode,
        title: item.name,
        detail: `${item.email} · ${departments.find((value) => value.id === item.departmentId)?.name ?? "Department unavailable"}`,
        module: "Shared Masters",
      })),
      ...vendors.map((item) => ({
        id: `vendor-${item.id}`,
        kind: "Vendor",
        reference: item.code,
        title: item.name,
        detail: item.email || item.contact || "No contact recorded",
        module: "Asset Inventory",
      })),
      ...allocations.map((item) => ({
        id: `allocation-${item.id}`,
        kind: "Allocation",
        reference: item.code,
        title: userLabel(item.userId),
        detail: `${item.assetIds.length} assets · ${item.state}`,
        module: "Allocation & Custody",
      })),
      ...maintenance.map((item) => ({
        id: `maintenance-${item.id}`,
        kind: "Maintenance / repair",
        reference: item.code,
        title: assetLabel(item.assetId),
        detail: `${item.activity} · ${item.state}`,
        module: "Maintenance & Inspection",
      })),
      ...incidents.map((item) => ({
        id: `incident-${item.id}`,
        kind: "Asset incident",
        reference: item.code,
        title: assetLabel(item.assetId),
        detail: `${item.type} · ${item.status}`,
        module: "Shared Masters",
      })),
      ...lifecycle.map((item) => ({
        id: `lifecycle-${item.id}`,
        kind: `${item.kind} lifecycle`,
        reference: item.code,
        title: userLabel(item.userId),
        detail: `${item.assetIds.length} assets · ${item.state}`,
        module: "Allocation & Custody",
      })),
      ...workspaceRows.map((item) => ({
        ...item,
        module: "Operations Centre",
      })),
    ],
    [
      assets,
      users,
      vendors,
      allocations,
      maintenance,
      incidents,
      lifecycle,
      departments,
      assetLabel,
      userLabel,
      workspaceRows,
    ],
  );
  const filteredSearch = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value.length < 2
      ? []
      : searchRows
          .filter((item) =>
            `${item.kind} ${item.reference} ${item.title} ${item.detail}`
              .toLowerCase()
              .includes(value),
          )
          .slice(0, 100);
  }, [query, searchRows]);
  const approvals = useMemo<ApprovalRow[]>(
    () =>
      [
        ...allocations
          .filter((item) => item.state.startsWith("Pending"))
          .map((item) => ({
            id: `a-${item.id}`,
            kind: "Asset allocation",
            reference: item.code,
            state: item.state,
            submitted: item.requestedAt,
            module: "Allocation & Custody",
          })),
        ...disposals
          .filter((item) => item.state.startsWith("Pending"))
          .map((item) => ({
            id: `d-${item.id}`,
            kind: "Disposal / write-off",
            reference: item.code,
            state: item.state,
            submitted: item.managerAt || item.requestedAt,
            module: "Assurance & Controls",
          })),
        ...retirements
          .filter((item) => item.state.startsWith("Pending"))
          .map((item) => ({
            id: `r-${item.id}`,
            kind: item.route,
            reference: item.code,
            state: item.state,
            submitted: item.managerAt || item.requestedAt,
            module: "Asset Retirement & Circularity",
          })),
      ].sort((a, b) => a.submitted.localeCompare(b.submitted)),
    [allocations, disposals, retirements],
  );
  const warranties = useMemo(
    () =>
      assets
        .map((asset) => {
          const model = models.find((item) => item.id === asset.modelId);
          const expiry = addMonths(
            asset.purchaseDate,
            Number(model?.warrantyMonths || 0),
          );
          const claim = claims.find(
            (item) =>
              item.assetId === asset.id &&
              !["Rejected", "Resolved"].includes(item.claimStatus),
          );
          return { ...asset, model, expiry, claim };
        })
        .filter((item) => Number(item.model?.warrantyMonths || 0) > 0)
        .sort((a, b) => a.expiry.localeCompare(b.expiry)),
    [assets, models, claims],
  );
  const quality = useMemo<QualityIssue[]>(() => {
    const rows: QualityIssue[] = [];
    const serials = new Map<string, Asset[]>();
    assets.forEach((asset) => {
      if (asset.serialNumber) {
        const key = asset.serialNumber.trim().toLowerCase();
        serials.set(key, [...(serials.get(key) ?? []), asset]);
      }
      if (!models.some((item) => item.id === asset.modelId))
        rows.push({
          id: `model-${asset.id}`,
          severity: "Critical",
          kind: "Orphan asset",
          reference: asset.assetId,
          issue: "Model reference is unavailable",
          module: "Asset Inventory",
        });
      if (!types.some((item) => item.id === asset.typeId))
        rows.push({
          id: `type-${asset.id}`,
          severity: "Critical",
          kind: "Orphan asset",
          reference: asset.assetId,
          issue: "Item group reference is unavailable",
          module: "Asset Inventory",
        });
      if (!locations.some((item) => item.id === asset.locationId))
        rows.push({
          id: `location-${asset.id}`,
          severity: "Critical",
          kind: "Orphan asset",
          reference: asset.assetId,
          issue: "Location reference is unavailable",
          module: "Asset Inventory",
        });
      if (!asset.configId)
        rows.push({
          id: `config-${asset.id}`,
          severity: "Warning",
          kind: "Incomplete asset",
          reference: asset.assetId,
          issue: "Configuration profile is not assigned",
          module: "Asset Inventory",
        });
      const model = models.find((item) => item.id === asset.modelId);
      if (
        model &&
        addMonths(asset.purchaseDate, Number(model.warrantyMonths || 0)) <
          today()
      )
        rows.push({
          id: `warranty-${asset.id}`,
          severity: "Warning",
          kind: "Expired warranty",
          reference: asset.assetId,
          issue: "Warranty has expired",
          module: "Operations Centre",
        });
    });
    serials.forEach((group) => {
      if (group.length > 1)
        group.forEach((asset) =>
          rows.push({
            id: `serial-${asset.id}`,
            severity: "Critical",
            kind: "Duplicate serial",
            reference: asset.assetId,
            issue: `Serial ${asset.serialNumber} is used by ${group.length} assets`,
            module: "Asset Inventory",
          }),
        );
    });
    users.forEach((user) => {
      if (
        !departments.some((item) => item.id === user.departmentId) ||
        !locations.some((item) => item.id === user.locationId) ||
        !userGroups.some((item) => item.id === user.groupId)
      )
        rows.push({
          id: `user-${user.id}`,
          severity: "Critical",
          kind: "Unmapped employee",
          reference: user.employeeCode,
          issue: "Department, location or user group is unavailable",
          module: "Shared Masters",
        });
    });
    allocations
      .filter((item) => item.state === "Active custody")
      .forEach((item) =>
        item.assetIds.forEach((assetId) => {
          if (!assets.some((asset) => asset.id === assetId))
            rows.push({
              id: `custody-${item.id}-${assetId}`,
              severity: "Critical",
              kind: "Broken custody",
              reference: item.code,
              issue: "Allocation references an unavailable asset",
              module: "Allocation & Custody",
            });
        }),
      );
    return rows;
  }, [
    assets,
    models,
    types,
    locations,
    users,
    departments,
    userGroups,
    allocations,
  ]);
  async function saveClaim(event: FormEvent) {
    event.preventDefault();
    if (claimFile && claimFile.size > 10 * 1024 * 1024) {
      setMessage("Claim attachment must not exceed 10 MB.");
      return;
    }
    const now = new Date().toISOString();
    const existing = claims.find((item) => item.id === editingClaimId);
    const attachment = claimFile
      ? await retainAttachment(claimFile)
      : existing?.attachment;
    const history = [
      ...(existing?.history ?? [
        {
          id: crypto.randomUUID(),
          status: existing?.claimStatus ?? "Draft",
          note: "Claim registered",
          at: existing?.updatedAt ?? now,
        },
      ]),
      {
        id: crypto.randomUUID(),
        status: claim.claimStatus,
        note:
          claim.replacementOutcome.trim() ||
          claim.issue.trim() ||
          "Claim updated",
        at: now,
      },
    ];
    const record: WarrantyClaim = {
      id: existing?.id ?? crypto.randomUUID(),
      code:
        existing?.code ??
        `WAR-${new Date().getFullYear()}-${String(claims.length + 1).padStart(4, "0")}`,
      assetId: claim.assetId,
      vendorId: claim.vendorId,
      reportedDate: claim.reportedDate,
      rmaReference: claim.rmaReference.trim(),
      claimStatus: claim.claimStatus,
      issue: claim.issue.trim(),
      dispatchDate: claim.dispatchDate,
      returnDate: claim.returnDate,
      resolutionType: claim.resolutionType,
      replacementAssetId: claim.replacementAssetId,
      replacementOutcome: claim.replacementOutcome.trim(),
      attachment,
      history,
      closedAt: ["Rejected", "Resolved"].includes(claim.claimStatus) ? now : "",
      updatedAt: now,
    };
    setClaims((current) =>
      existing
        ? current.map((item) => (item.id === record.id ? record : item))
        : [...current, record],
    );
    setClaimOpen(false);
    setEditingClaimId("");
    setClaimFile(null);
    setClaim(blankClaim);
    setMessage(
      `${record.code} warranty claim ${existing ? "updated" : "recorded"}.`,
    );
  }
  function editClaim(record: WarrantyClaim) {
    setEditingClaimId(record.id);
    setClaimOpen(true);
    setClaim({
      assetId: record.assetId,
      vendorId: record.vendorId,
      reportedDate: record.reportedDate,
      rmaReference: record.rmaReference,
      claimStatus: record.claimStatus,
      issue: record.issue ?? "",
      dispatchDate: record.dispatchDate ?? "",
      returnDate: record.returnDate ?? "",
      resolutionType: record.resolutionType ?? "Pending",
      replacementAssetId: record.replacementAssetId ?? "",
      replacementOutcome: record.replacementOutcome,
    });
    setClaimFile(null);
  }
  function addRule() {
    setRules((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        event: "Warranty expiry",
        recipient: "dev@glasscolabs.com",
        leadDays: 30,
        escalationDays: 7,
        enabled: true,
        updatedAt: new Date().toISOString(),
      },
    ]);
  }
  function exportPackage() {
    const data: Record<string, unknown> = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith("itms.")) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) ?? "null");
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    const envelope = {
      format: "Glassco Connect ITMS controlled export",
      version: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: "dev@glasscolabs.com",
      recordStores: Object.keys(data).length,
      data,
    };
    download(
      `ITMS-controlled-export-${today()}.json`,
      JSON.stringify(envelope, null, 2),
      "application/json;charset=utf-8",
    );
    setMessage(
      "Complete controlled JSON export generated from all ITMS record stores.",
    );
  }
  function exportIndex() {
    const rows = [
      "Store,Records",
      ...Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      )
        .filter((key): key is string => Boolean(key?.startsWith("itms.")))
        .map((key) => {
          try {
            const value = JSON.parse(localStorage.getItem(key) ?? "[]");
            return `${csvCell(key)},${Array.isArray(value) ? value.length : 1}`;
          } catch {
            return `${csvCell(key)},1`;
          }
        }),
    ];
    download(
      `ITMS-export-index-${today()}.csv`,
      rows.join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  useEffect(() => {
    if (tab !== "Cloud migration" || !cloudOperationalReady()) return;
    void inspectCloudMigration()
      .then(setCloudStatuses)
      .catch((error) =>
        setCloudError(
          error instanceof Error ? error.message : "Cloud inspection failed.",
        ),
      );
  }, [tab]);
  async function migrateToCloud() {
    setCloudBusy(true);
    setCloudError("");
    setMessage("");
    try {
      const result = await migrateLocalStoresToCloud((status) =>
        setCloudStatuses((current) => [
          ...current.filter((item) => item.key !== status.key),
          status,
        ]),
      );
      setCloudStatuses(result);
      setMessage(
        "Non-destructive Firestore migration completed. Local records were created or updated; no cloud records were deleted.",
      );
    } catch (error) {
      setCloudError(
        error instanceof Error ? error.message : "Cloud migration failed.",
      );
    } finally {
      setCloudBusy(false);
    }
  }
  const filteredBackups = useMemo(() => {
    const text = backupQuery.trim().toLowerCase();
    return [...backupCompletions]
      .filter(
        (item) =>
          (!text ||
            `${item.performedBy} ${item.destination} ${item.verification} ${item.notes}`
              .toLowerCase()
              .includes(text)) &&
          (!backupFrom || item.completedAt.slice(0, 10) >= backupFrom) &&
          (!backupTo || item.completedAt.slice(0, 10) <= backupTo),
      )
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }, [backupCompletions, backupQuery, backupFrom, backupTo]);
  const lastVerified = useMemo(
    () =>
      [...backupCompletions]
        .filter((item) => item.verification === "Verified")
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0],
    [backupCompletions],
  );
  const backupOverdue =
    backupSchedule.enabled &&
    (!lastVerified ||
      (Date.now() - new Date(lastVerified.completedAt).getTime()) /
        (24 * 60 * 60 * 1000) >
        (backupSchedule.frequency === "Daily"
          ? 2
          : backupSchedule.frequency === "Weekly"
            ? 8
            : 32));
  function saveBackupCompletion(event: FormEvent) {
    event.preventDefault();
    const record: BackupCompletion = {
      id: crypto.randomUUID(),
      ...backupCompletion,
      performedBy: backupCompletion.performedBy.trim(),
      destination: backupCompletion.destination.trim(),
      notes: backupCompletion.notes.trim(),
      retentionUntil: retentionDate(
        backupCompletion.completedAt,
        backupSchedule.retentionDays,
      ),
      createdAt: new Date().toISOString(),
    };
    setBackupCompletions((current) => [...current, record]);
    setBackupFormOpen(false);
    setBackupCompletion({
      ...blankBackup,
      scheduledFor: localDateTime(),
      completedAt: localDateTime(),
      destination: backupSchedule.destination,
    });
    setMessage(
      "Manual backup completion recorded in the shared audit register.",
    );
  }
  function exportBackupHistory() {
    const rows = [
      "Completed at,Scheduled for,Performed by,Destination,Verification,Size MB,Record count,Retention until,Notes",
      ...filteredBackups.map((item) =>
        [
          item.completedAt,
          item.scheduledFor,
          item.performedBy,
          item.destination,
          item.verification,
          item.sizeMb,
          item.recordCount,
          item.retentionUntil,
          item.notes,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    download(
      `ITMS-backup-register-${today()}.csv`,
      rows.join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">GCCP-ITMS-BUILD-24</span>
          <h1>Workspace Operations Centre</h1>
          <p>
            Search, approvals, integration health, migration, export and
            data-quality control across Glassco Workspace.
          </p>
        </div>
        <span className="phase">CROSS-APP GOVERNANCE</span>
      </section>
      <nav className="workspace-tabs operations-tabs">
        {(
          [
            "Global search",
            "Workspace health",
            "Approval inbox",
            "Warranty",
            "Stock verification",
            "Controlled export",
            "Backup planner",
            "Backup register",
            "Cloud migration",
            "Notification rules",
            "Data quality",
          ] as Tab[]
        ).map((item) => (
          <button
            type="button"
            className={tab === item ? "selected" : ""}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
            key={item}
          >
            {item}
            {item === "Workspace health" && pendingEvents.length > 0 ? (
              <b>{pendingEvents.length}</b>
            ) : item === "Approval inbox" && approvals.length > 0 ? (
              <b>{approvals.length}</b>
            ) : item === "Data quality" && quality.length > 0 ? (
              <b>{quality.length}</b>
            ) : null}
          </button>
        ))}
      </nav>
      {message && (
        <div className="success-message">
          <Icon name="check" size={17} />
          {message}
        </div>
      )}
      {tab === "Global search" && (
        <section className="master-panel">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">WORKSPACE DISCOVERY</span>
              <h2>Find ITMS, IT Support and NCR records</h2>
            </div>
          </div>
          <div className="global-search-box">
            <Icon name="reports" size={22} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Asset, employee, IT ticket, purchase request, vendor or lifecycle reference"
            />
            <span>{filteredSearch.length} results</span>
          </div>
          <DataTable
            rows={filteredSearch}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "reference",
                label: "Reference",
                sticky: true,
                width: "180px",
                render: (item) => <strong>{item.reference}</strong>,
              },
              {
                key: "kind",
                label: "Record type",
                width: "190px",
                render: (item) => item.kind,
              },
              {
                key: "title",
                label: "Record",
                width: "320px",
                render: (item) => item.title,
              },
              {
                key: "detail",
                label: "Current context",
                width: "380px",
                render: (item) => item.detail,
              },
              {
                key: "action",
                label: "Action",
                width: "130px",
                render: (item) => (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => openSearchRow(item)}
                  >
                    Open
                  </button>
                ),
              },
            ]}
            empty={
              <div className="empty-state">
                <Icon name="reports" size={32} />
                <strong>
                  {query.length < 2
                    ? "Enter at least two characters"
                    : "No matching records"}
                </strong>
              </div>
            }
          />
        </section>
      )}
      {tab === "Workspace health" && (
        <section className="master-panel">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">INTEGRATION CONTROL</span>
              <h2>Workspace integration health</h2>
              <p>
                Monitor application services and retry-safe events without
                losing the originating business record.
              </p>
            </div>
          </div>
          <div className="summary-strip">
            <article>
              <span>Services monitored</span>
              <strong>{integrationHealth.length}</strong>
            </article>
            <article>
              <span>Pending events</span>
              <strong>
                {
                  pendingEvents.filter(
                    (item) => item.deliveryStatus === "Pending",
                  ).length
                }
              </strong>
            </article>
            <article>
              <span>Failed events</span>
              <strong>
                {
                  pendingEvents.filter(
                    (item) => item.deliveryStatus === "Failed",
                  ).length
                }
              </strong>
            </article>
          </div>
          <DataTable
            rows={integrationHealth}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "service",
                label: "Service",
                sticky: true,
                width: "240px",
                render: (item) => <strong>{item.service}</strong>,
              },
              {
                key: "application",
                label: "Application",
                width: "150px",
                render: (item) => item.application,
              },
              {
                key: "status",
                label: "Health",
                width: "130px",
                render: (item) => item.status,
              },
              {
                key: "pending",
                label: "Pending",
                width: "100px",
                render: (item) => item.pendingCount,
              },
              {
                key: "failed",
                label: "Failures",
                width: "100px",
                render: (item) => item.failureCount,
              },
              {
                key: "updated",
                label: "Last update",
                width: "220px",
                render: (item) =>
                  new Date(item.updatedAt).toLocaleString("en-IN"),
              },
              {
                key: "detail",
                label: "Detail",
                width: "340px",
                render: (item) => item.detail,
              },
            ]}
            empty={
              <div className="empty-state">
                <Icon name="support" size={32} />
                <strong>No integration health reports yet</strong>
                <span>Services will appear after their first heartbeat.</span>
              </div>
            }
          />
          {pendingEvents.length > 0 && (
            <>
              <div className="operation-heading">
                <div>
                  <h3>Pending and failed cross-app events</h3>
                </div>
              </div>
              <DataTable
                rows={pendingEvents}
                rowKey={(item) => item.id}
                columns={[
                  {
                    key: "record",
                    label: "Record",
                    sticky: true,
                    width: "180px",
                    render: (item) => <strong>{item.recordCode}</strong>,
                  },
                  {
                    key: "application",
                    label: "Application",
                    width: "130px",
                    render: (item) => item.application,
                  },
                  {
                    key: "event",
                    label: "Event",
                    width: "180px",
                    render: (item) => item.event,
                  },
                  {
                    key: "status",
                    label: "Delivery",
                    width: "130px",
                    render: (item) => item.deliveryStatus,
                  },
                  {
                    key: "attempts",
                    label: "Attempts",
                    width: "100px",
                    render: (item) => item.attempts,
                  },
                  {
                    key: "error",
                    label: "Last error",
                    width: "360px",
                    render: (item) => item.lastError || "Awaiting delivery",
                  },
                ]}
              />
            </>
          )}
        </section>
      )}
      {tab === "Approval inbox" && (
        <section className="master-panel">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">CONSOLIDATED DUAL CONTROL</span>
              <h2>Manager and IT Head approval inbox</h2>
              <p>Decisions remain in the authoritative source workflow.</p>
            </div>
          </div>
          <div className="master-summary">
            <div>
              <span>Total pending</span>
              <strong>{approvals.length}</strong>
            </div>
            <div>
              <span>Asset Manager</span>
              <strong>
                {
                  approvals.filter((item) =>
                    item.state.includes("Asset Manager"),
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>IT Head</span>
              <strong>
                {
                  approvals.filter((item) => item.state.includes("IT Head"))
                    .length
                }
              </strong>
            </div>
          </div>
          <DataTable
            rows={approvals}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "reference",
                label: "Reference",
                sticky: true,
                width: "180px",
                render: (item) => <strong>{item.reference}</strong>,
              },
              {
                key: "kind",
                label: "Workflow",
                width: "260px",
                render: (item) => item.kind,
              },
              {
                key: "state",
                label: "Approval stage",
                width: "220px",
                render: (item) => (
                  <span className="status inactive">{item.state}</span>
                ),
              },
              {
                key: "submitted",
                label: "Submitted",
                width: "180px",
                render: (item) =>
                  new Date(item.submitted).toLocaleString("en-IN"),
              },
              {
                key: "action",
                label: "Decision",
                width: "180px",
                render: (item) => (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => go(item.module, item.reference)}
                  >
                    Open source record
                  </button>
                ),
              },
            ]}
            empty={
              <div className="empty-state">
                <Icon name="check" size={32} />
                <strong>No approvals pending</strong>
              </div>
            }
          />
        </section>
      )}
      {tab === "Warranty" && (
        <section className="master-panel warranty-centre">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">WARRANTY & RMA CONTROL</span>
              <h2>Expiry calendar and governed claim register</h2>
              <p>
                Track vendor submission, dispatch, resolution evidence and
                replacement relationships.
              </p>
            </div>
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setClaimOpen(!claimOpen);
                setEditingClaimId("");
                setClaim(blankClaim);
                setClaimFile(null);
              }}
            >
              <Icon name="plus" size={17} />
              New claim
            </button>
          </div>
          <div className="master-summary">
            <div>
              <span>Covered assets</span>
              <strong>
                {warranties.filter((item) => item.expiry >= today()).length}
              </strong>
            </div>
            <div>
              <span>Expiring in 90 days</span>
              <strong>
                {
                  warranties.filter(
                    (item) =>
                      item.expiry >= today() &&
                      item.expiry <= addMonths(today(), 3),
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>Open claims</span>
              <strong>
                {
                  claims.filter(
                    (item) =>
                      !["Rejected", "Resolved"].includes(item.claimStatus),
                  ).length
                }
              </strong>
            </div>
          </div>
          {claimOpen && (
            <form
              className="master-form operation-form warranty-form"
              onSubmit={saveClaim}
            >
              <label>
                Asset
                <select
                  required
                  disabled={Boolean(editingClaimId)}
                  value={claim.assetId}
                  onChange={(event) =>
                    setClaim({ ...claim, assetId: event.target.value })
                  }
                >
                  <option value="">Select asset</option>
                  {warranties.map((item) => (
                    <option value={item.id} key={item.id}>
                      {assetLabel(item.id)} · expires {item.expiry}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vendor
                <select
                  required
                  value={claim.vendorId}
                  onChange={(event) =>
                    setClaim({ ...claim, vendorId: event.target.value })
                  }
                >
                  <option value="">Select vendor</option>
                  {vendors.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reported date
                <input
                  required
                  type="date"
                  value={claim.reportedDate}
                  onChange={(event) =>
                    setClaim({ ...claim, reportedDate: event.target.value })
                  }
                />
              </label>
              <label>
                RMA / ticket reference
                <input
                  value={claim.rmaReference}
                  onChange={(event) =>
                    setClaim({ ...claim, rmaReference: event.target.value })
                  }
                />
              </label>
              <label className="wide-field">
                Issue / claim description
                <textarea
                  required
                  value={claim.issue}
                  onChange={(event) =>
                    setClaim({ ...claim, issue: event.target.value })
                  }
                />
              </label>
              <label>
                Claim status
                <select
                  value={claim.claimStatus}
                  onChange={(event) =>
                    setClaim({
                      ...claim,
                      claimStatus: event.target.value as ClaimStatus,
                    })
                  }
                >
                  <option>Draft</option>
                  <option>Submitted</option>
                  <option>Accepted</option>
                  <option>Dispatched</option>
                  <option>Vendor processing</option>
                  <option>Rejected</option>
                  <option>Resolved</option>
                </select>
              </label>
              <label>
                Dispatch date
                <input
                  type="date"
                  value={claim.dispatchDate}
                  onChange={(event) =>
                    setClaim({ ...claim, dispatchDate: event.target.value })
                  }
                />
              </label>
              <label>
                Return / resolution date
                <input
                  type="date"
                  value={claim.returnDate}
                  onChange={(event) =>
                    setClaim({ ...claim, returnDate: event.target.value })
                  }
                />
              </label>
              <label>
                Resolution type
                <select
                  value={claim.resolutionType}
                  onChange={(event) =>
                    setClaim({
                      ...claim,
                      resolutionType: event.target.value as NonNullable<
                        WarrantyClaim["resolutionType"]
                      >,
                    })
                  }
                >
                  <option>Pending</option>
                  <option>Repaired</option>
                  <option>Replaced</option>
                  <option>Credit note</option>
                  <option>Rejected</option>
                </select>
              </label>
              <label>
                Replacement asset
                <select
                  value={claim.replacementAssetId}
                  onChange={(event) =>
                    setClaim({
                      ...claim,
                      replacementAssetId: event.target.value,
                    })
                  }
                >
                  <option value="">No replacement asset</option>
                  {assets
                    .filter((item) => item.id !== claim.assetId)
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {assetLabel(item.id)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="wide-field">
                Progress note / outcome
                <textarea
                  value={claim.replacementOutcome}
                  onChange={(event) =>
                    setClaim({
                      ...claim,
                      replacementOutcome: event.target.value,
                    })
                  }
                />
              </label>
              <label className="wide-field">
                Claim evidence
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(event) =>
                    setClaimFile(event.target.files?.[0] ?? null)
                  }
                />
                <small>
                  {claimFile
                    ? `${claimFile.name} · ${(claimFile.size / 1024).toFixed(0)} KB`
                    : (editingClaimId &&
                        claims.find((item) => item.id === editingClaimId)
                          ?.attachment?.name) ||
                      "Optional · maximum 10 MB"}
                </small>
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setClaimOpen(false);
                    setEditingClaimId("");
                    setClaim(blankClaim);
                    setClaimFile(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action">
                  {editingClaimId ? "Update claim" : "Save claim"}
                </button>
              </div>
            </form>
          )}
          <h3 className="register-heading">Warranty-bearing assets</h3>
          <DataTable
            rows={warranties}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "asset",
                label: "Asset",
                sticky: true,
                width: "260px",
                render: (item) => <strong>{assetLabel(item.id)}</strong>,
              },
              {
                key: "purchase",
                label: "Purchase date",
                width: "130px",
                render: (item) => item.purchaseDate,
              },
              {
                key: "expiry",
                label: "Warranty expiry",
                width: "150px",
                render: (item) => item.expiry,
              },
              {
                key: "status",
                label: "Warranty state",
                width: "150px",
                render: (item) => (
                  <span
                    className={`status ${item.expiry >= today() ? "active" : "inactive"}`}
                  >
                    {item.expiry >= today() ? "Covered" : "Expired"}
                  </span>
                ),
              },
              {
                key: "claim",
                label: "Open claim / RMA",
                width: "280px",
                render: (item) =>
                  item.claim
                    ? `${item.claim.code} · ${item.claim.claimStatus} · ${item.claim.rmaReference || "No RMA"}`
                    : "No open claim",
              },
              {
                key: "action",
                label: "Action",
                width: "130px",
                render: (item) => (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => go("Asset Inventory", item.assetId)}
                  >
                    Open asset
                  </button>
                ),
              },
            ]}
            empty={
              <div className="empty-state">
                <strong>No warranty-bearing assets</strong>
              </div>
            }
          />
          <h3 className="register-heading">Claim and RMA history</h3>
          <DataTable
            rows={[...claims].sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            )}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "code",
                label: "Claim",
                sticky: true,
                width: "170px",
                render: (item) => <strong>{item.code}</strong>,
              },
              {
                key: "asset",
                label: "Asset",
                width: "260px",
                render: (item) => assetLabel(item.assetId),
              },
              {
                key: "vendor",
                label: "Vendor",
                width: "220px",
                render: (item) =>
                  vendors.find((value) => value.id === item.vendorId)?.name ??
                  "Not assigned",
              },
              {
                key: "status",
                label: "Status",
                width: "150px",
                render: (item) => (
                  <span
                    className={`status ${item.claimStatus === "Resolved" ? "active" : "inactive"}`}
                  >
                    {item.claimStatus}
                  </span>
                ),
              },
              {
                key: "rma",
                label: "RMA / outcome",
                width: "320px",
                render: (item) => (
                  <>
                    {item.rmaReference || "No RMA"}
                    <small>
                      {item.resolutionType ?? "Pending"} ·{" "}
                      {item.replacementOutcome || "Outcome pending"}
                    </small>
                  </>
                ),
              },
              {
                key: "evidence",
                label: "Evidence",
                width: "180px",
                render: (item) =>
                  item.attachment ? (
                    <button
                      type="button"
                      className="document-link"
                      onClick={() =>
                        void openAttachment(item.attachment!).catch(() =>
                          setMessage(
                            "This claim attachment is not available in the current browser.",
                          ),
                        )
                      }
                    >
                      {item.attachment.name}
                    </button>
                  ) : (
                    "Not attached"
                  ),
              },
              {
                key: "history",
                label: "History",
                width: "260px",
                render: (item) => (
                  <details>
                    <summary>{item.history?.length ?? 1} events</summary>
                    {(item.history ?? []).map((event) => (
                      <small key={event.id}>
                        {new Date(event.at).toLocaleString("en-IN")} ·{" "}
                        {event.status} · {event.note}
                      </small>
                    ))}
                  </details>
                ),
              },
              {
                key: "action",
                label: "Action",
                width: "110px",
                render: (item) => (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => editClaim(item)}
                  >
                    Update
                  </button>
                ),
              },
            ]}
            empty={
              <div className="empty-state">
                <strong>No warranty claims recorded</strong>
              </div>
            }
          />
        </section>
      )}
      {tab === "Stock verification" && (
        <section className="master-panel verification-launch">
          <div>
            <Icon name="assurance" size={42} />
            <span className="eyebrow">
              MOBILE-FRIENDLY COUNT & RECONCILIATION
            </span>
            <h2>Physical stock verification</h2>
            <p>
              Scan or select assets, record missing/damaged/custody mismatch
              results, and reconcile exceptions in the governed Assurance
              workspace.
            </p>
            <div>
              <b>{assets.length}</b>
              <span>registered assets</span>
              <b>{verifications.length}</b>
              <span>verification records</span>
              <b>
                {
                  verifications.filter((item) => item.result !== "Verified")
                    .length
                }
              </b>
              <span>exceptions</span>
            </div>
            <button
              className="primary-action"
              type="button"
              onClick={() =>
                go("Assurance & Controls", "Physical verification")
              }
            >
              Open stock verification
            </button>
          </div>
        </section>
      )}
      {tab === "Controlled export" && (
        <section className="master-panel export-centre">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">RECOVERY & AUDIT PACKAGE</span>
              <h2>Controlled full-system export</h2>
              <p>
                Exports every ITMS local record store, relationship and audit
                trail.
              </p>
            </div>
          </div>
          <div className="export-cards">
            <article>
              <Icon name="package" size={30} />
              <strong>Complete JSON recovery package</strong>
              <p>
                Machine-readable backup preserving store names, internal
                identifiers and linked records.
              </p>
              <button
                type="button"
                className="primary-action"
                onClick={exportPackage}
              >
                Download full package
              </button>
            </article>
            <article>
              <Icon name="reports" size={30} />
              <strong>CSV control index</strong>
              <p>
                Human-readable inventory of record stores and record counts for
                reconciliation.
              </p>
              <button
                type="button"
                className="secondary-action"
                onClick={exportIndex}
              >
                Download control index
              </button>
            </article>
          </div>
          <div className="access-warning">
            Protect exported files as confidential company records. Test
            restoration before relying on an export as a backup.
          </div>
        </section>
      )}
      {tab === "Cloud migration" && (
        <section className="master-panel cloud-migration">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">
                NON-DESTRUCTIVE FIRESTORE ACTIVATION
              </span>
              <h2>Operational store migration &amp; reconciliation</h2>
              <p>
                Creates or updates individual Firestore documents from this
                browser. Existing cloud documents are never deleted.
              </p>
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={cloudBusy || !cloudOperationalReady()}
                onClick={() =>
                  void inspectCloudMigration()
                    .then(setCloudStatuses)
                    .catch((error) =>
                      setCloudError(
                        error instanceof Error
                          ? error.message
                          : "Inspection failed.",
                      ),
                    )
                }
              >
                Refresh status
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={cloudBusy || !cloudOperationalReady()}
                onClick={() => void migrateToCloud()}
              >
                {cloudBusy ? "Migrating…" : "Migrate local records"}
              </button>
            </div>
          </div>
          {!cloudOperationalReady() && (
            <div className="access-warning">
              An authenticated Firebase session is required. Localhost fallback
              cannot migrate operational data.
            </div>
          )}
          {cloudError && <div className="access-error">{cloudError}</div>}
          <div className="migration-safety">
            <Icon name="assurance" size={24} />
            <div>
              <strong>Safe first migration</strong>
              <p>
                Download a controlled export first. Migration only upserts
                records, activates real-time synchronization store by store, and
                reports count differences for review.
              </p>
            </div>
          </div>
          <div className="master-summary">
            <div>
              <span>Registered stores</span>
              <strong>{cloudStatuses.length || 26}</strong>
            </div>
            <div>
              <span>Migrated</span>
              <strong>
                {cloudStatuses.filter((item) => item.migrated).length}
              </strong>
            </div>
            <div>
              <span>Count reconciled</span>
              <strong>
                {cloudStatuses.filter((item) => item.reconciled).length}
              </strong>
            </div>
          </div>
          <DataTable
            rows={cloudStatuses}
            rowKey={(item) => item.key}
            columns={[
              {
                key: "store",
                label: "Operational store",
                sticky: true,
                width: "250px",
                render: (item) => (
                  <>
                    <strong>{item.store}</strong>
                    <small>{item.key}</small>
                  </>
                ),
              },
              {
                key: "local",
                label: "Local records",
                width: "130px",
                render: (item) => item.localCount,
              },
              {
                key: "cloud",
                label: "Cloud records",
                width: "130px",
                render: (item) => item.cloudCount,
              },
              {
                key: "migration",
                label: "Migration state",
                width: "150px",
                render: (item) => (
                  <span
                    className={`status ${item.migrated ? "active" : "inactive"}`}
                  >
                    {item.migrated ? "Active" : "Local only"}
                  </span>
                ),
              },
              {
                key: "reconciliation",
                label: "Reconciliation",
                width: "170px",
                render: (item) => (
                  <span
                    className={`quality-severity ${item.reconciled ? "warning" : "critical"}`}
                  >
                    {item.reconciled ? "Counts match" : "Review required"}
                  </span>
                ),
              },
              {
                key: "updated",
                label: "Last synchronized",
                width: "200px",
                render: (item) =>
                  item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString("en-IN")
                    : "Not migrated",
              },
            ]}
            empty={
              <div className="empty-state">
                <Icon name="package" size={32} />
                <strong>Cloud stores not inspected</strong>
                <p>Refresh status to read the migration register.</p>
              </div>
            }
          />
        </section>
      )}
      {tab === "Notification rules" && (
        <section className="master-panel">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">REMINDER & ESCALATION GOVERNANCE</span>
              <h2>Notification rules</h2>
              <p>
                Local email preparation remains manual until an approved
                delivery service is connected.
              </p>
            </div>
            <button type="button" className="primary-action" onClick={addRule}>
              <Icon name="plus" size={17} />
              Add rule
            </button>
          </div>
          <DataTable
            rows={rules}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "event",
                label: "Event",
                sticky: true,
                width: "220px",
                render: (item) => (
                  <select
                    value={item.event}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((value) =>
                          value.id === item.id
                            ? {
                                ...value,
                                event: event.target.value,
                                updatedAt: new Date().toISOString(),
                              }
                            : value,
                        ),
                      )
                    }
                  >
                    <option>Warranty expiry</option>
                    <option>Maintenance due</option>
                    <option>Pending approval</option>
                    <option>Employee offboarding</option>
                    <option>Open repair</option>
                  </select>
                ),
              },
              {
                key: "recipient",
                label: "Recipient",
                width: "260px",
                render: (item) => (
                  <input
                    value={item.recipient}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((value) =>
                          value.id === item.id
                            ? {
                                ...value,
                                recipient: event.target.value,
                                updatedAt: new Date().toISOString(),
                              }
                            : value,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                key: "lead",
                label: "Lead days",
                width: "120px",
                render: (item) => (
                  <input
                    type="number"
                    min="0"
                    value={item.leadDays}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((value) =>
                          value.id === item.id
                            ? {
                                ...value,
                                leadDays: Number(event.target.value),
                                updatedAt: new Date().toISOString(),
                              }
                            : value,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                key: "escalation",
                label: "Escalate after",
                width: "140px",
                render: (item) => (
                  <input
                    type="number"
                    min="0"
                    value={item.escalationDays}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((value) =>
                          value.id === item.id
                            ? {
                                ...value,
                                escalationDays: Number(event.target.value),
                                updatedAt: new Date().toISOString(),
                              }
                            : value,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                key: "state",
                label: "State",
                width: "120px",
                render: (item) => (
                  <button
                    className="table-action"
                    type="button"
                    onClick={() =>
                      setRules((current) =>
                        current.map((value) =>
                          value.id === item.id
                            ? {
                                ...value,
                                enabled: !value.enabled,
                                updatedAt: new Date().toISOString(),
                              }
                            : value,
                        ),
                      )
                    }
                  >
                    {item.enabled ? "Enabled" : "Disabled"}
                  </button>
                ),
              },
            ]}
            empty={
              <div className="empty-state">
                <strong>No notification rules configured</strong>
              </div>
            }
          />
        </section>
      )}
      {tab === "Data quality" && (
        <section className="master-panel">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">REFERENTIAL INTEGRITY</span>
              <h2>Data-quality dashboard</h2>
              <p>
                Duplicate, orphaned, expired and incomplete records requiring
                correction.
              </p>
            </div>
          </div>
          <div className="master-summary">
            <div>
              <span>Total findings</span>
              <strong>{quality.length}</strong>
            </div>
            <div>
              <span>Critical</span>
              <strong>
                {quality.filter((item) => item.severity === "Critical").length}
              </strong>
            </div>
            <div>
              <span>Warnings</span>
              <strong>
                {quality.filter((item) => item.severity === "Warning").length}
              </strong>
            </div>
          </div>
          <DataTable
            rows={quality}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "reference",
                label: "Reference",
                sticky: true,
                width: "180px",
                render: (item) => <strong>{item.reference}</strong>,
              },
              {
                key: "severity",
                label: "Severity",
                width: "130px",
                render: (item) => (
                  <span
                    className={`quality-severity ${item.severity.toLowerCase()}`}
                  >
                    {item.severity}
                  </span>
                ),
              },
              {
                key: "kind",
                label: "Finding type",
                width: "220px",
                render: (item) => item.kind,
              },
              {
                key: "issue",
                label: "Issue",
                width: "440px",
                render: (item) => item.issue,
              },
              {
                key: "action",
                label: "Action",
                width: "130px",
                render: (item) => (
                  <button
                    type="button"
                    className="table-action"
                    onClick={() => go(item.module, item.reference)}
                  >
                    Correct
                  </button>
                ),
              },
            ]}
            empty={
              <div className="empty-state">
                <Icon name="check" size={32} />
                <strong>No data-quality findings</strong>
              </div>
            }
          />
        </section>
      )}
      {tab === "Backup planner" && (
        <section className="master-panel backup-planner">
          <div className="operation-heading">
            <div>
              <span className="eyebrow">MANUAL BACKUP GOVERNANCE</span>
              <h2>Backup schedule planner</h2>
              <p>
                Set the approved backup day, date and time. This planner does
                not run or upload backups automatically.
              </p>
            </div>
            <span
              className={`status ${backupSchedule.enabled ? "active" : "inactive"}`}
            >
              {backupSchedule.enabled ? "Schedule active" : "Schedule disabled"}
            </span>
          </div>
          <form
            className="master-form operation-form"
            onSubmit={(event) => {
              event.preventDefault();
              setBackupSchedule((current) => ({
                ...current,
                updatedAt: new Date().toISOString(),
              }));
              setMessage(
                "Backup schedule saved. Backups remain manual and must be completed by the assigned administrator.",
              );
            }}
          >
            <label>
              Schedule state
              <select
                value={backupSchedule.enabled ? "Enabled" : "Disabled"}
                onChange={(event) =>
                  setBackupSchedule((current) => ({
                    ...current,
                    enabled: event.target.value === "Enabled",
                  }))
                }
              >
                <option>Enabled</option>
                <option>Disabled</option>
              </select>
            </label>
            <label>
              Frequency
              <select
                value={backupSchedule.frequency}
                onChange={(event) =>
                  setBackupSchedule((current) => ({
                    ...current,
                    frequency: event.target
                      .value as BackupSchedule["frequency"],
                  }))
                }
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </label>
            {backupSchedule.frequency === "Weekly" && (
              <label>
                Backup day
                <select
                  value={backupSchedule.weekday}
                  onChange={(event) =>
                    setBackupSchedule((current) => ({
                      ...current,
                      weekday: Number(event.target.value),
                    }))
                  }
                >
                  {weekdays.map((day, index) => (
                    <option value={index} key={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {backupSchedule.frequency === "Monthly" && (
              <label>
                Day of month
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={backupSchedule.monthDay}
                  onChange={(event) =>
                    setBackupSchedule((current) => ({
                      ...current,
                      monthDay: Number(event.target.value),
                    }))
                  }
                />
              </label>
            )}
            <label>
              Planned time
              <input
                type="time"
                value={backupSchedule.time}
                onChange={(event) =>
                  setBackupSchedule((current) => ({
                    ...current,
                    time: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Timezone
              <select
                value={backupSchedule.timezone}
                onChange={(event) =>
                  setBackupSchedule((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
              >
                <option>Asia/Kolkata</option>
                <option>UTC</option>
              </select>
            </label>
            <label className="wide-field">
              Destination / archive label
              <input
                value={backupSchedule.destination}
                onChange={(event) =>
                  setBackupSchedule((current) => ({
                    ...current,
                    destination: event.target.value,
                  }))
                }
                placeholder="Approved bucket, Drive folder or archive location"
              />
            </label>
            <label>
              Retention (days)
              <input
                type="number"
                min="1"
                max="3650"
                value={backupSchedule.retentionDays}
                onChange={(event) =>
                  setBackupSchedule((current) => ({
                    ...current,
                    retentionDays: Number(event.target.value),
                  }))
                }
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-action">
                Save schedule
              </button>
            </div>
          </form>
          <div className="backup-preview">
            <Icon name="history" size={25} />
            <div>
              <span>Next planned manual backup</span>
              <strong>{nextBackup(backupSchedule)}</strong>
              <small>
                Timezone: {backupSchedule.timezone} · Retain for{" "}
                {backupSchedule.retentionDays} days
                {backupSchedule.updatedAt
                  ? ` · Last saved ${new Date(backupSchedule.updatedAt).toLocaleString("en-IN")}`
                  : ""}
              </small>
            </div>
          </div>
          <div className="access-warning">
            Planning only: an authorised administrator must run the backup,
            verify the exported files and record completion separately.
          </div>
        </section>
      )}
      {tab === "Backup register" && (
        <section className="master-panel backup-register">
          <div
            className={`backup-health ${backupOverdue ? "overdue" : "current"}`}
          >
            <Icon name={backupOverdue ? "alerts" : "check"} size={20} />
            <div>
              <strong>
                {backupOverdue
                  ? "Backup completion overdue"
                  : "Backup register current"}
              </strong>
              <small>
                {lastVerified
                  ? `Last verified ${new Date(lastVerified.completedAt).toLocaleString("en-IN")}`
                  : "No verified backup has been recorded yet."}
              </small>
            </div>
          </div>
          <div className="operation-heading">
            <div>
              <span className="eyebrow">AUDIT &amp; RESTORABILITY</span>
              <h2>Backup completion register</h2>
              <p>
                Record each manually completed backup and its verification
                evidence.
              </p>
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={exportBackupHistory}
              >
                Download CSV
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  setBackupCompletion({
                    ...blankBackup,
                    scheduledFor: localDateTime(),
                    completedAt: localDateTime(),
                    destination: backupSchedule.destination,
                    performedBy:
                      firebaseAuth?.currentUser?.email ??
                      blankBackup.performedBy,
                  });
                  setBackupFormOpen(true);
                }}
              >
                <Icon name="plus" size={17} />
                Log completion
              </button>
            </div>
          </div>
          {backupFormOpen && (
            <form
              className="master-form operation-form backup-completion-form"
              onSubmit={saveBackupCompletion}
            >
              <label>
                Scheduled date and time
                <input
                  required
                  type="datetime-local"
                  value={backupCompletion.scheduledFor}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      scheduledFor: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Actual completion
                <input
                  required
                  type="datetime-local"
                  value={backupCompletion.completedAt}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      completedAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Performed by
                <input
                  required
                  type="email"
                  value={backupCompletion.performedBy}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      performedBy: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Verification
                <select
                  value={backupCompletion.verification}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      verification: event.target
                        .value as BackupCompletion["verification"],
                    }))
                  }
                >
                  <option>Verified</option>
                  <option>Partially verified</option>
                  <option>Failed</option>
                </select>
              </label>
              <label className="wide-field">
                Backup destination / reference
                <input
                  required
                  value={backupCompletion.destination}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      destination: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                File size (MB)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={backupCompletion.sizeMb}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      sizeMb: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Record count
                <input
                  type="number"
                  min="0"
                  value={backupCompletion.recordCount}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      recordCount: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="wide-field">
                Notes / failure reason
                <textarea
                  value={backupCompletion.notes}
                  onChange={(event) =>
                    setBackupCompletion((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={() => setBackupFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-action">
                  Save completion
                </button>
              </div>
            </form>
          )}
          <div className="backup-filters">
            <label>
              Search
              <input
                value={backupQuery}
                onChange={(event) => setBackupQuery(event.target.value)}
                placeholder="Administrator, destination, status or notes"
              />
            </label>
            <label>
              From
              <input
                type="date"
                value={backupFrom}
                onChange={(event) => setBackupFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={backupTo}
                onChange={(event) => setBackupTo(event.target.value)}
              />
            </label>
            <span>{filteredBackups.length} records</span>
          </div>
          <DataTable
            rows={filteredBackups}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "completed",
                label: "Completed",
                sticky: true,
                width: "190px",
                render: (item) => (
                  <>
                    <strong>
                      {new Date(item.completedAt).toLocaleString("en-IN")}
                    </strong>
                    <small>
                      Planned{" "}
                      {new Date(item.scheduledFor).toLocaleString("en-IN")}
                    </small>
                  </>
                ),
              },
              {
                key: "performed",
                label: "Performed by",
                width: "230px",
                render: (item) => item.performedBy,
              },
              {
                key: "destination",
                label: "Destination / reference",
                width: "300px",
                render: (item) => item.destination,
              },
              {
                key: "verification",
                label: "Verification",
                width: "160px",
                render: (item) => (
                  <span
                    className={`quality-severity ${item.verification === "Verified" ? "warning" : "critical"}`}
                  >
                    {item.verification}
                  </span>
                ),
              },
              {
                key: "evidence",
                label: "Evidence",
                width: "180px",
                render: (item) => (
                  <>
                    {item.sizeMb ? `${item.sizeMb} MB` : "Size not recorded"}
                    <small>
                      {item.recordCount
                        ? `${item.recordCount} records`
                        : "Count not recorded"}
                    </small>
                  </>
                ),
              },
              {
                key: "retention",
                label: "Retain until",
                width: "140px",
                render: (item) => item.retentionUntil,
              },
              {
                key: "notes",
                label: "Notes",
                width: "280px",
                render: (item) => item.notes || "No notes",
              },
            ]}
            empty={
              <div className="empty-state">
                <Icon name="history" size={32} />
                <strong>No backup completions recorded</strong>
                <p>
                  Use Log completion after manually creating and verifying a
                  backup.
                </p>
              </div>
            }
          />
          <div className="access-warning">
            Audit register only: backups remain manually executed and
            independently verified.
          </div>
        </section>
      )}
    </>
  );
}
