import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Icon from "../../components/Icon";
import { useLocalStore } from "../../lib/localStore";
import { useNcrStore } from "../../lib/ncrStore";
import {
  uploadNcrAttachments,
  validateNcrAttachments,
  type NcrAttachment,
} from "../../lib/ncrAttachmentStore";
import { queueSupportEmail } from "../../lib/supportEmailCloud";
import {
  boundedReceiptQuantity,
  isDedicatedRaiser,
  procurementActionError,
  receivedQuantity,
  type ProcurementAction,
} from "./ncrLifecycle";
import "./ConsumableRequests.css";
import "./ConsumableRequestsOperator.css";
import "./NcrRouting.css";
import "../../sidebarStandard.css";
import NcrApprovalMappings, {
  type NcrApprovalMapping,
} from "./NcrApprovalMappings";
import NcrAdmin, { defaultNcrMasterData, type NcrMasterData } from "./NcrAdmin";
import NcrProcurement from "./NcrProcurement";
import NcrApprovalRegister from "./NcrApprovalRegister";
import NcrRequestDetail from "./NcrRequestDetail";
import NcrMaterialReferrals from "./NcrMaterialReferrals";
import {
  linkFacilitiesMaterialReferral,
  resumeFacilitiesAfterReceipt,
  type FacilitiesMaterialReferral,
} from "../../lib/facilitiesMaterialReferral";
import { saveWorkspaceLink } from "../../lib/workspaceIntegration";
import "./NcrAutosave.css";
import "./NcrMobile.css";

type RequestState =
  | "Draft"
  | "Submitted"
  | "Question raised"
  | "Returned for correction"
  | "Approved"
  | "Rejected"
  | "Procurement review"
  | "Purchase order"
  | "Partially fulfilled"
  | "Fulfilled"
  | "Closed"
  | "Cancelled";
type LineItem = {
  id: string;
  group: string;
  description: string;
  specification: string;
  quantity: number;
  uom: string;
  customUom: string;
  unitCost: number;
  status: "Requested" | "Partially fulfilled" | "Fulfilled" | "Cancelled";
};
export type NcrRequest = {
  id: string;
  code: string;
  requesterEmail: string;
  requesterName: string;
  employeeId: string;
  departmentId: string;
  departmentName: string;
  hod: string;
  approverEmail: string;
  approvalEmails?: string[];
  procurementOwner?: string;
  vendor?: string;
  quotationReference?: string;
  quotations?: {
    id: string;
    vendorId: string;
    vendorName: string;
    reference: string;
    amount: number;
    taxTerms: string;
    deliveryTerms: string;
    recordedAt: string;
    recordedBy: string;
    selected?: boolean;
    selectionReason?: string;
  }[];
  poNumber?: string;
  expectedDelivery?: string;
  grnNumber?: string;
  receivedAt?: string;
  receipts?: {
    id: string;
    grnNumber: string;
    receivedAt: string;
    actor: string;
    lines: { itemId: string; quantity: number }[];
  }[];
  sourceFacilitiesReferralId?: string;
  sourceFacilitiesRequestId?: string;
  sourceFacilitiesRequestCode?: string;
  purpose: string;
  otherPurpose: string;
  requiredBy: string;
  priority: string;
  costCentre: string;
  deliveryLocation: string;
  justification: string;
  items: LineItem[];
  attachments: NcrAttachment[];
  state: RequestState;
  estimatedTotal: number;
  createdAt: string;
  updatedAt: string;
  history: { at: string; event: string; actor: string }[];
};
type User = {
  id: string;
  employeeCode?: string;
  code?: string;
  name: string;
  email: string;
  departmentId?: string;
  groupId?: string;
  status?: string;
};
type Department = {
  id: string;
  code?: string;
  name: string;
  status?: string;
  hod?: string;
  hodName?: string;
  hodEmail?: string;
  approverEmail?: string;
  costCentre?: string;
};

const purposes = [
  "New requirement",
  "Replacement",
  "Replenishment",
  "Maintenance / repair",
  "Project requirement",
  "New employee / onboarding",
  "Safety / compliance requirement",
  "Other",
];
const units = [
  "Piece",
  "Box",
  "Pack",
  "Set",
  "Kit",
  "Pair",
  "Roll",
  "Bottle",
  "Litre",
  "Kilogram",
  "Gram",
  "Metre",
  "Ream",
  "Other",
];
const emptyLine = (): LineItem => ({
  id: crypto.randomUUID(),
  group: "",
  description: "",
  specification: "",
  quantity: 1,
  uom: "Piece",
  customUom: "",
  unitCost: 0,
  status: "Requested",
});
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const nextCode = () =>
  `NCR-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;

export default function ConsumableRequests({
  identityEmail,
  identityName,
  isApprover,
  isPurchaser,
  canManageMappings,
  onExit,
}: {
  identityEmail: string;
  identityName: string;
  isApprover: boolean;
  isPurchaser: boolean;
  canManageMappings: boolean;
  onExit: () => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      localStorage.getItem("glassco.workspace.sidebar-collapsed.v1") === "true",
  );
  const [users] = useLocalStore<User[]>("itms.users.v1", []);
  const me = users.find(
    (user) => user.email?.toLowerCase() === identityEmail.toLowerCase(),
  );
  const [departments] = useLocalStore<Department[]>("itms.departments.v1", []);
  const [approvalMappings, setApprovalMappings] = useLocalStore<
    NcrApprovalMapping[]
  >("connect.ncr-approval-mappings.v1", []);
  const [ncrMasterData, setNcrMasterData] = useLocalStore<NcrMasterData>(
    "connect.ncr-master-data.v1",
    defaultNcrMasterData,
  );
  const activeCategories = ncrMasterData.categories
    .filter((item) => item.status === "Active")
    .map((item) => item.name);
  const mappingGroups = ncrMasterData.groups.length
    ? ncrMasterData.groups
    : departments
        .filter((department) => department.status !== "Inactive")
        .map((department) => ({
          id: department.id,
          code: department.code || "DEPT",
          name: department.name,
          memberUserIds: users
            .filter((user) => user.departmentId === department.id)
            .map((user) => user.id),
          status: "Active" as const,
        }));
  const capability = ncrMasterData.capabilities.find(
    (item) => item.userId === me?.id,
  );
  const canRaise = isDedicatedRaiser(me?.id, capability, approvalMappings);
  const effectivePurchaser = isPurchaser;
  const eligibleApprovers = ncrMasterData.capabilities.some(
    (item) => item.canApprove,
  )
    ? users.filter((user) =>
        ncrMasterData.capabilities.some(
          (item) =>
            item.userId === user.id &&
            item.status === "Active" &&
            item.canApprove,
        ),
      )
    : users;
  const [requests, setRequests, store] = useNcrStore<NcrRequest>(
    identityEmail,
    isApprover || isPurchaser,
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const department = departments.find(
    (item) => item.id === selectedDepartmentId,
  );
  const [view, setView] = useState<
    | "home"
    | "new"
    | "requests"
    | "drafts"
    | "action"
    | "approval"
    | "delivery"
    | "history"
    | "reports"
    | "approvals"
    | "procurement"
    | "referrals"
    | "mappings"
    | "admin"
  >("home");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [itemFilter, setItemFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updated-desc");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [otherPurpose, setOtherPurpose] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [costCentre, setCostCentre] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [justification, setJustification] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [pendingReferral, setPendingReferral] =
    useState<FacilitiesMaterialReferral | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const draftKey = `glassco.ncr.form-draft.${identityEmail.toLowerCase()}`;
  useEffect(() => {
    if (draftReady) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          selectedDepartmentId?: string;
          purpose?: string;
          otherPurpose?: string;
          requiredBy?: string;
          priority?: string;
          costCentre?: string;
          deliveryLocation?: string;
          justification?: string;
          items?: LineItem[];
          attachmentNames?: string[];
          savedAt?: string;
        };
        setSelectedDepartmentId(saved.selectedDepartmentId || "");
        setPurpose(saved.purpose || "");
        setOtherPurpose(saved.otherPurpose || "");
        setRequiredBy(saved.requiredBy || "");
        setPriority(saved.priority || "Normal");
        setCostCentre(saved.costCentre || "");
        setDeliveryLocation(saved.deliveryLocation || "");
        setJustification(saved.justification || "");
        if (saved.items?.length) setItems(saved.items);
        setDraftStatus(
          `Recovered draft${saved.savedAt ? ` from ${new Date(saved.savedAt).toLocaleString("en-IN")}` : ""}${saved.attachmentNames?.length ? ` · reselect ${saved.attachmentNames.length} attachment(s)` : ""}`,
        );
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
    setDraftReady(true);
  }, [draftKey, draftReady]);
  useEffect(() => {
    if (!draftReady || view !== "new") return;
    setDraftStatus("Saving draft…");
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          selectedDepartmentId,
          purpose,
          otherPurpose,
          requiredBy,
          priority,
          costCentre,
          deliveryLocation,
          justification,
          items,
          attachmentNames: files.map((file) => file.name),
          savedAt,
        }),
      );
      setDraftStatus(
        `Draft saved ${new Date(savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      );
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    draftReady,
    view,
    draftKey,
    selectedDepartmentId,
    purpose,
    otherPurpose,
    requiredBy,
    priority,
    costCentre,
    deliveryLocation,
    justification,
    items,
    files,
  ]);
  useEffect(() => {
    if (!selectedDepartmentId && me?.departmentId)
      setSelectedDepartmentId(me.departmentId);
  }, [me?.departmentId, selectedDepartmentId]);
  const mine = useMemo(
    () =>
      requests.filter(
        (row) =>
          row.requesterEmail.toLowerCase() === identityEmail.toLowerCase(),
      ),
    [identityEmail, requests],
  );
  const historicalItems = useMemo(() => {
    const source = isPurchaser || canManageMappings ? requests : mine;
    const latest = new Map<
      string,
      {
        group: string;
        description: string;
        specification: string;
        quantity: number;
        uom: string;
        customUom: string;
        unitCost: number;
        lastDate: string;
        uses: number;
      }
    >();
    source
      .filter(
        (row) =>
          !["Draft", "Submitted", "Rejected", "Cancelled"].includes(row.state),
      )
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .forEach((row) =>
        row.items.forEach((item) => {
          const key = item.description.trim().toLowerCase();
          if (!key) return;
          const prior = latest.get(key);
          latest.set(key, {
            group: item.group,
            description: item.description,
            specification: item.specification,
            quantity: item.quantity,
            uom: item.uom,
            customUom: item.customUom,
            unitCost: item.unitCost,
            lastDate: row.updatedAt,
            uses: (prior?.uses || 0) + 1,
          });
        }),
      );
    return [...latest.values()].sort(
      (a, b) => b.uses - a.uses || b.lastDate.localeCompare(a.lastDate),
    );
  }, [requests, mine, isPurchaser, canManageMappings]);
  const duplicateCandidates = useMemo(() => {
    const terms = items
      .map((item) => item.description.trim().toLowerCase())
      .filter((value) => value.length >= 4);
    if (!terms.length) return [];
    const cutoff = Date.now() - 90 * 86400000;
    return requests
      .filter(
        (row) =>
          row.id !== editingId &&
          row.departmentId === selectedDepartmentId &&
          Date.parse(row.createdAt) >= cutoff &&
          !["Rejected", "Cancelled"].includes(row.state) &&
          row.items.some((line) =>
            terms.some(
              (term) =>
                line.description.toLowerCase().includes(term) ||
                term.includes(line.description.toLowerCase()),
            ),
          ),
      )
      .slice(0, 3);
  }, [items, requests, editingId, selectedDepartmentId]);
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mine
      .filter(
        (row) =>
          (status === "All" || row.state === status) &&
          (itemFilter === "All" ||
            row.items.some((item) => item.group === itemFilter)) &&
          (!fromDate || row.createdAt.slice(0, 10) >= fromDate) &&
          (!toDate || row.createdAt.slice(0, 10) <= toDate) &&
          (!term ||
            `${row.code} ${row.requesterName} ${row.requesterEmail} ${row.purpose} ${row.departmentName} ${row.state} ${row.items.map((item) => `${item.group} ${item.description} ${item.specification}`).join(" ")}`
              .toLowerCase()
              .includes(term)),
      )
      .sort((a, b) =>
        sortBy === "updated-asc"
          ? a.updatedAt.localeCompare(b.updatedAt)
          : sortBy === "value-desc"
            ? b.estimatedTotal - a.estimatedTotal
            : sortBy === "value-asc"
              ? a.estimatedTotal - b.estimatedTotal
              : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [mine, search, status, itemFilter, fromDate, toDate, sortBy]);
  const actionable = mine.filter((row) =>
    ["Question raised", "Returned for correction"].includes(row.state),
  );
  const purchaseValue = mine
    .filter((row) => !["Draft", "Rejected", "Cancelled"].includes(row.state))
    .reduce((sum, row) => sum + row.estimatedTotal, 0);
  const activeBudget = (ncrMasterData.budgets || []).find(
      (row) =>
        row.status === "Active" &&
        row.costCentre.trim().toLowerCase() === costCentre.trim().toLowerCase(),
    ),
    budgetCommitted = activeBudget
      ? requests
          .filter(
            (row) =>
              row.id !== editingId &&
              row.costCentre.trim().toLowerCase() ===
                activeBudget.costCentre.trim().toLowerCase() &&
              !["Draft", "Rejected", "Cancelled"].includes(row.state),
          )
          .reduce((sum, row) => sum + row.estimatedTotal, 0)
      : 0,
    budgetRemaining = activeBudget
      ? Math.max(0, activeBudget.amount - budgetCommitted)
      : null;
  const downloadMyReport = () => {
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      [
        "Request",
        "Created",
        "Department",
        "Purpose",
        "Items",
        "Value INR",
        "Status",
        "Required by",
        "Approver",
        "PO",
        "GRN",
      ],
      ...mine.map((row) => [
        row.code,
        row.createdAt.slice(0, 10),
        row.departmentName,
        row.purpose,
        row.items.map((item) => item.description).join(" | "),
        row.estimatedTotal,
        row.state,
        row.requiredBy,
        row.approverEmail,
        row.poNumber || "",
        row.grnNumber || "",
      ]),
    ]
      .map((line) => line.map(quote).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `My-NCR-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const titleByView = {
    home: "My purchase requests",
    new: "Raise a consumable purchase request",
    requests: "My requests",
    drafts: "Drafts",
    action: "Action required",
    approval: "Approval tracking",
    delivery: "Delivery & receipts",
    history: "Purchase history",
    reports: "My reports",
    approvals: "Purchase approvals",
    procurement: "Procurement queue",
    referrals: "Facilities material referrals",
    mappings: "Approval mapping",
    admin: "Administration & masters",
  } as const;
  function updateLine(id: string, patch: Partial<LineItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []),
      issue = validateNcrAttachments([...files, ...selected]);
    if (issue) {
      setMessage(issue);
      return;
    }
    setFiles((current) => [...current, ...selected]);
    setMessage("");
  }
  function reset() {
    localStorage.removeItem(draftKey);
    setDraftStatus("");
    setEditingId("");
    setSelectedDepartmentId(me?.departmentId || "");
    setPurpose("");
    setOtherPurpose("");
    setRequiredBy("");
    setPriority("Normal");
    setCostCentre("");
    setDeliveryLocation("");
    setJustification("");
    setItems([emptyLine()]);
    setFiles([]);
  }
  function valid() {
    return (
      capability?.status !== "Inactive" &&
      canRaise &&
      department?.id &&
      resolveApprovalRoute().complete &&
      purpose &&
      requiredBy &&
      deliveryLocation &&
      justification.trim() &&
      (purpose !== "Other" || otherPurpose.trim()) &&
      items.length > 0 &&
      (budgetRemaining === null || total <= budgetRemaining) &&
      items.every(
        (item) =>
          item.group &&
          item.description.trim() &&
          item.quantity > 0 &&
          item.uom &&
          (item.uom !== "Other" || item.customUom.trim()),
      )
    );
  }
  function resolveApprovalRoute() {
    const categories = [
      ...new Set(items.map((item) => item.group).filter(Boolean)),
    ];
    const active = approvalMappings.filter((mapping) => {
      const assignedGroups = mapping.raiserGroupIds?.length
        ? mapping.raiserGroupIds
        : mapping.raiserGroupId
          ? [mapping.raiserGroupId]
          : [];
      const belongs = assignedGroups.some((groupId) =>
        mappingGroups
          .find((group) => group.id === groupId)
          ?.memberUserIds.includes(me?.id || ""),
      );
      return (
        mapping.status === "Active" &&
        belongs &&
        mapping.raiserUserIds.includes(me?.id || "")
      );
    });
    const routes = categories.map((category) => {
      const mapping = active
        .filter(
          (candidate) =>
            candidate.category === category ||
            candidate.category === "All categories",
        )
        .filter((candidate) => total <= candidate.priceLimit)
        .sort(
          (left, right) =>
            Number(right.category === category) -
              Number(left.category === category) ||
            left.priceLimit - right.priceLimit,
        )[0];
      const primary = users.find((user) => user.id === mapping?.approverUserId),
        today = new Date().toISOString().slice(0, 10),
        delegation = (ncrMasterData.delegations || []).find(
          (row) =>
            row.status === "Active" &&
            row.primaryUserId === primary?.id &&
            row.from <= today &&
            row.to >= today,
        ),
        approver = delegation
          ? users.find((user) => user.id === delegation.backupUserId) || primary
          : primary;
      return {
        category,
        mapping,
        approver,
        delegatedFrom: delegation ? primary : undefined,
      };
    });
    const emails = [
      ...new Set(
        routes
          .map((route) => route.approver?.email?.toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ),
    ];
    return {
      routes,
      emails,
      complete:
        categories.length > 0 &&
        routes.every((route) => route.mapping && route.approver),
    };
  }
  async function save(state: "Draft" | "Submitted") {
    if (state === "Submitted" && !valid()) {
      setMessage(
        "Complete all required fields and ensure an active approval mapping covers every item category and the total INR value.",
      );
      return;
    }
    if (saving) return;
    setSaving(true);
    const now = new Date().toISOString(),
      existing = mine.find((row) => row.id === editingId),
      id = existing?.id || crypto.randomUUID(),
      code = existing?.code || nextCode(),
      resolvedRoute = resolveApprovalRoute(),
      approvalEmails = resolvedRoute.emails,
      approverEmail = approvalEmails[0] || "";
    try {
      const attachments = files.length
        ? await uploadNcrAttachments(id, code, files, identityEmail)
        : [];
      const row: NcrRequest = {
        id,
        code,
        requesterEmail: identityEmail.toLowerCase(),
        requesterName: me?.name || identityName,
        employeeId: me?.employeeCode || me?.code || "Not linked",
        departmentId: department?.id || "",
        departmentName: department?.name || "Not configured in ITMS",
        hod: department?.hodName || department?.hod || "IT Head",
        approverEmail,
        approvalEmails,
        purpose,
        otherPurpose,
        requiredBy,
        priority,
        costCentre,
        deliveryLocation,
        justification,
        sourceFacilitiesReferralId:
          pendingReferral?.id || existing?.sourceFacilitiesReferralId,
        sourceFacilitiesRequestId:
          pendingReferral?.facilitiesRequestId ||
          existing?.sourceFacilitiesRequestId,
        sourceFacilitiesRequestCode:
          pendingReferral?.facilitiesRequestCode ||
          existing?.sourceFacilitiesRequestCode,
        items,
        attachments: [...(existing?.attachments || []), ...attachments],
        state,
        estimatedTotal: total,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        history: [
          ...(existing?.history || []),
          {
            at: now,
            event:
              state === "Draft"
                ? "Draft saved"
                : "Request submitted for department approval",
            actor: identityEmail.toLowerCase(),
          },
        ],
      };
      await setRequests((current) =>
        existing
          ? current.map((item) => (item.id === id ? row : item))
          : [...current, row],
      );
      if (pendingReferral) {
        await linkFacilitiesMaterialReferral(pendingReferral.id, id, code);
        await saveWorkspaceLink({
          source: {
            application: "facilities",
            recordId: pendingReferral.facilitiesRequestId,
            recordCode: pendingReferral.facilitiesRequestCode,
            route: "requests",
          },
          target: {
            application: "requests",
            recordId: id,
            recordCode: code,
            route: "requests",
          },
          linkType: "Requires",
          createdBy: identityEmail.toLowerCase(),
        });
        setPendingReferral(null);
      }
      if (state === "Submitted") {
        const link = `https://glassco-connect-itms-dev.web.app/?app=requests&request=${encodeURIComponent(id)}`;
        await Promise.allSettled([
          queueSupportEmail({
            ticketId: id,
            ticketCode: code,
            to: identityEmail.toLowerCase(),
            subject: `[${code}] Purchase request submitted`,
            body: `Your purchase request ${code} has been submitted for approval.\n\nDepartment: ${row.departmentName}\nEstimated value: ${money(total)}\nApprover: ${row.hod}\n\nOpen request: ${link}`,
            event: "Purchase request submitted",
          }),
          ...approvalEmails.map((to) =>
            queueSupportEmail({
              ticketId: id,
              ticketCode: code,
              to,
              subject: `[${code}] Purchase approval required`,
              body: `${row.requesterName} submitted purchase request ${code}.\n\nDepartment: ${row.departmentName}\nItems: ${row.items.length}\nEstimated value: ${money(total)}\nRequired by: ${requiredBy}\n\nReview request: ${link}`,
              event: "Purchase request submitted",
            }),
          ),
        ]);
      }
      setMessage(
        state === "Draft"
          ? `${code} saved as draft.`
          : `${code} submitted for approval and notifications queued.`,
      );
      reset();
      setView("requests");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The purchase request could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function decide(
    row: NcrRequest,
    state: "Approved" | "Rejected" | "Returned for correction",
    suppliedNote?: string,
  ) {
    const note =
      suppliedNote ??
      window.prompt(
        state === "Approved"
          ? "Optional approval comment:"
          : `Reason for ${state.toLowerCase()}:`,
      );
    if (state !== "Approved" && !note?.trim()) return;
    const now = new Date().toISOString(),
      next = {
        ...row,
        state,
        updatedAt: now,
        history: [
          ...row.history,
          {
            at: now,
            event: `${state}${note ? ` · ${note.trim()}` : ""}`,
            actor: identityEmail.toLowerCase(),
          },
        ],
      };
    try {
      await setRequests((current) =>
        current.map((item) => (item.id === row.id ? next : item)),
      );
      await queueSupportEmail({
        ticketId: row.id,
        ticketCode: row.code,
        to: row.requesterEmail,
        subject: `[${row.code}] ${state}`,
        body: `Your purchase request ${row.code} was ${state.toLowerCase()} by ${identityName}.${note ? `\n\nComment: ${note.trim()}` : ""}\n\nOpen Glassco Workspace to review the request.`,
        event: `Purchase request ${state.toLowerCase()}`,
      });
      setMessage(
        `${row.code} ${state.toLowerCase()}; requester notification queued.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The approval decision could not be saved.",
      );
    }
  }
  async function processPurchase(
    row: NcrRequest,
    action: ProcurementAction,
    payload?: Record<string, unknown>,
  ) {
    const transitionError = procurementActionError(row.state, action);
    if (transitionError) {
      setMessage(transitionError);
      return;
    }
    const now = new Date().toISOString();
    let patch: Partial<NcrRequest> = {
      updatedAt: now,
      procurementOwner: identityEmail.toLowerCase(),
    };
    let event = "";
    if (action === "start") {
      patch.state = "Procurement review";
      event = "Procurement started";
    }
    if (action === "quote") {
      const vendor = String(payload?.vendorName || "").trim(),
        reference = String(payload?.reference || "").trim(),
        amount = Number(payload?.amount || 0);
      if (!vendor || !reference || amount <= 0) return;
      const quotation = {
        id: crypto.randomUUID(),
        vendorId: String(payload?.vendorId || ""),
        vendorName: vendor,
        reference,
        amount,
        taxTerms: String(payload?.taxTerms || ""),
        deliveryTerms: String(payload?.deliveryTerms || ""),
        recordedAt: now,
        recordedBy: identityEmail.toLowerCase(),
      };
      patch = {
        ...patch,
        vendor,
        quotationReference: reference,
        quotations: [...(row.quotations || []), quotation],
        state: "Procurement review",
      };
      event = `Quotation recorded · ${vendor} · ${reference}`;
    }
    if (action === "po") {
      const po = String(payload?.poNumber || "").trim(),
        expected = String(payload?.expectedDelivery || "").trim(),
        vendor = String(payload?.vendorName || row.vendor || "").trim(),
        reason = String(payload?.selectionReason || "").trim();
      if (!po || !expected || !vendor || !reason) return;
      patch = {
        ...patch,
        poNumber: po,
        expectedDelivery: expected,
        vendor,
        quotations: (row.quotations || []).map((quote) => ({
          ...quote,
          selected: quote.vendorName === vendor,
          selectionReason:
            quote.vendorName === vendor ? reason : quote.selectionReason,
        })),
        state: "Purchase order",
      };
      event = `Purchase order ${po} created for ${vendor}`;
    }
    if (action === "grn") {
      const grn = String(payload?.grnNumber || "").trim();
      if (!grn) return;
      const prior = row.receipts || [];
      const submitted = Array.isArray(payload?.lines)
        ? (payload.lines as { itemId: string; quantity: number }[])
        : [];
      const lines = submitted
        .map((line) => {
          const item = row.items.find((value) => value.id === line.itemId);
          const already = receivedQuantity(line.itemId, prior);
          return {
            itemId: line.itemId,
            quantity: boundedReceiptQuantity(
              item?.quantity || 0,
              already,
              line.quantity,
            ),
          };
        })
        .filter((line) => line.quantity > 0);
      if (!lines.length) {
        setMessage("Record at least one received quantity.");
        return;
      }
      const receiptTime = payload?.receivedDate
        ? new Date(`${String(payload.receivedDate)}T12:00:00`).toISOString()
        : now;
      const receipts = [
        ...prior,
        {
          id: crypto.randomUUID(),
          grnNumber: grn,
          receivedAt: receiptTime,
          actor: identityEmail.toLowerCase(),
          lines,
        },
      ];
      const updatedItems = row.items.map((item) => {
        const received = receivedQuantity(item.id, receipts);
        return {
          ...item,
          status: (received >= item.quantity
            ? "Fulfilled"
            : received > 0
              ? "Partially fulfilled"
              : "Requested") as LineItem["status"],
        };
      });
      const complete = updatedItems.every(
        (item) => item.status === "Fulfilled",
      );
      patch = {
        ...patch,
        receipts,
        items: updatedItems,
        grnNumber: grn,
        receivedAt: receiptTime,
        state: complete ? "Fulfilled" : "Partially fulfilled",
      };
      event = `${complete ? "Goods fully received" : "Partial receipt recorded"} · GRN ${grn}`;
    }
    if (action === "exception") {
      const reason = String(payload?.reason || "").trim();
      if (!reason) return;
      patch = { ...patch, state: "Returned for correction" };
      event = `Procurement exception · ${reason}`;
    }
    const next = {
      ...row,
      ...patch,
      history: [
        ...row.history,
        { at: now, event, actor: identityEmail.toLowerCase() },
      ],
    };
    try {
      await setRequests((current) =>
        current.map((item) => (item.id === row.id ? next : item)),
      );
      if (action === "grn" && row.sourceFacilitiesRequestId)
        await resumeFacilitiesAfterReceipt(
          row.sourceFacilitiesRequestId,
          row.id,
          row.code,
          String(patch.grnNumber || ""),
          identityEmail.toLowerCase(),
        );
      const recipients = [
        row.requesterEmail,
        ...(row.approvalEmails?.length
          ? row.approvalEmails
          : [row.approverEmail]),
      ].filter(Boolean);
      await Promise.allSettled(
        [...new Set(recipients)].map((to) =>
          queueSupportEmail({
            ticketId: row.id,
            ticketCode: row.code,
            to,
            subject: `[${row.code}] ${event}`,
            body: `Purchase request ${row.code} was updated by the Purchase Department.\n\n${event}\nStatus: ${next.state}\n\nOpen Glassco Workspace for details.`,
            event: `Purchase request ${next.state.toLowerCase()}`,
          }),
        ),
      );
      setMessage(
        `${row.code}: ${event}${row.sourceFacilitiesRequestId && action === "grn" ? "; linked Facilities work resumed" : ""}. Notifications queued.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The procurement update could not be saved.",
      );
    }
  }
  function edit(row: NcrRequest) {
    if (row.state !== "Draft" && row.state !== "Returned for correction")
      return;
    setEditingId(row.id);
    setSelectedDepartmentId(row.departmentId);
    setPurpose(row.purpose);
    setOtherPurpose(row.otherPurpose);
    setRequiredBy(row.requiredBy);
    setPriority(row.priority);
    setCostCentre(row.costCentre);
    setDeliveryLocation(row.deliveryLocation);
    setJustification(row.justification);
    setItems(row.items);
    setFiles([]);
    setView("new");
  }
  function createFromReferral(referral: FacilitiesMaterialReferral) {
    setPendingReferral(referral);
    setSelectedDepartmentId(referral.departmentId);
    setPurpose("Maintenance / repair");
    setOtherPurpose("");
    setRequiredBy(
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    );
    setPriority("High");
    setCostCentre(
      departments.find((item) => item.id === referral.departmentId)
        ?.costCentre || "",
    );
    setDeliveryLocation(referral.departmentName);
    setJustification(
      `Material required for Facilities request ${referral.facilitiesRequestCode}. ${referral.requirement}`,
    );
    setItems([
      {
        ...emptyLine(),
        group: activeCategories.includes("Maintenance consumables")
          ? "Maintenance consumables"
          : activeCategories[0] || "",
        description: referral.requirement,
        specification: `Facilities ${referral.facilitiesRequestCode}${referral.assetId ? ` · Asset ${referral.assetId}` : ""}`,
      },
    ]);
    setFiles([]);
    setView("new");
  }
  const approvalRows = requests.filter(
    (row) =>
      row.state === "Submitted" &&
      (canManageMappings ||
        row.approverEmail === identityEmail.toLowerCase() ||
        row.approvalEmails?.includes(identityEmail.toLowerCase())),
  );
  const nav = [
    ["home", "Home", "dashboard"],
    ...(canRaise ? [["new", "New request", "requests"] as const] : []),
    ["requests", "My requests", "history"],
    ["drafts", "Drafts", "empty"],
    ["action", "Action required", "alerts"],
    ["approval", "Approval tracking", "assurance"],
    ["delivery", "Delivery & receipts", "package"],
    ["history", "Purchase history", "history"],
    ["reports", "Reports", "reports"],
    ...(isApprover
      ? [["approvals", "Approval workspace", "check"] as const]
      : []),
    ...(isPurchaser
      ? [["procurement", "Procurement queue", "service"] as const]
      : []),
    ...(isApprover || isPurchaser
      ? [["referrals", "Material referrals", "package"] as const]
      : []),
    ...(canManageMappings
      ? [["mappings", "Approval mapping", "assurance"] as const]
      : []),
    ...(canManageMappings
      ? [["admin", "Administration & masters", "masters"] as const]
      : []),
  ] as const;
  const rows =
    view === "drafts"
      ? visible.filter((row) => row.state === "Draft")
      : view === "action"
        ? visible.filter((row) =>
            ["Question raised", "Returned for correction"].includes(row.state),
          )
        : view === "delivery"
          ? visible.filter((row) =>
              ["Purchase order", "Partially fulfilled", "Fulfilled"].includes(
                row.state,
              ),
            )
          : view === "history"
            ? visible.filter((row) =>
                ["Fulfilled", "Closed", "Rejected", "Cancelled"].includes(
                  row.state,
                ),
              )
            : visible;
  return (
    <div className="ncr-shell">
      <header className="ncr-topbar">
        <div className="ncr-brand">
          <img src="/brand/glassco-logo-transparent.png" alt="Glassco" />
          <strong>CONNECT · CONSUMABLE REQUESTS</strong>
        </div>
        <div />
        <button onClick={onExit}>
          <Icon name="dashboard" size={17} />
          All applications
        </button>
        <span>{identityEmail}</span>
      </header>
      <div
        className={`ncr-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <aside className={sidebarCollapsed ? "collapsed" : ""}>
          <div className="ncr-sidebar-heading">
            <span>EMPLOYEE PURCHASE PORTAL</span>
            <button
              type="button"
              className="ncr-sidebar-collapse"
              onClick={() =>
                setSidebarCollapsed((current) => {
                  const next = !current;
                  localStorage.setItem(
                    "glassco.workspace.sidebar-collapsed.v1",
                    String(next),
                  );
                  return next;
                })
              }
              aria-label={
                sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
              }
              title={
                sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
              }
            >
              <Icon name="chevron" size={17} />
            </button>
          </div>
          <nav>
            {nav.map(([id, label, icon]) => (
              <button
                className={view === id ? "active" : ""}
                onClick={() => setView(id)}
                key={id}
              >
                <Icon name={icon} size={18} />
                <span className="ncr-nav-text">{label}</span>
                {id === "action" && actionable.length > 0 ? (
                  <b>{actionable.length}</b>
                ) : null}
              </button>
            ))}
          </nav>
          <footer>
            <strong>Controlled purchase workflow</strong>
            <small>Integrated with ITMS identity</small>
          </footer>
        </aside>
        <main>
          <header className="ncr-page-header">
            <div>
              <span>GLASSCO WORKSPACE · NCR</span>
              <h1>{titleByView[view]}</h1>
              <p>
                {view === "new"
                  ? "Create a multi-item request with supporting documents."
                  : "Search, track and review your consumable purchase activity."}
              </p>
            </div>
            {view !== "new" && canRaise && (
              <button
                className="ncr-primary"
                onClick={() => {
                  reset();
                  setView("new");
                }}
              >
                <Icon name="plus" size={17} />
                New request
              </button>
            )}
          </header>
          {(message || store.error) && (
            <div className="ncr-message">
              {message || store.error}
              <button onClick={() => setMessage("")}>×</button>
            </div>
          )}
          {view === "home" && (
            <>
              <section className="ncr-kpis">
                <article>
                  <span>Open requests</span>
                  <strong>
                    {
                      mine.filter(
                        (row) =>
                          ![
                            "Draft",
                            "Closed",
                            "Rejected",
                            "Cancelled",
                          ].includes(row.state),
                      ).length
                    }
                  </strong>
                </article>
                <article>
                  <span>Drafts</span>
                  <strong>
                    {mine.filter((row) => row.state === "Draft").length}
                  </strong>
                </article>
                <article>
                  <span>Action required</span>
                  <strong>{actionable.length}</strong>
                </article>
                <article>
                  <span>Purchase value</span>
                  <strong>{money(purchaseValue)}</strong>
                </article>
              </section>
              <RequestList
                rows={mine
                  .slice()
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .slice(0, 6)}
                onEdit={edit}
              />
            </>
          )}
          {view === "referrals" && (
            <NcrMaterialReferrals
              departmentId={me?.departmentId || ""}
              canRaise={canRaise}
              onCreate={createFromReferral}
            />
          )}
          {view === "new" && (
            <section className="ncr-form-card">
              <div className="ncr-autosave">
                <span>
                  {draftStatus ||
                    "Changes are saved automatically on this device"}
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem(draftKey);
                    reset();
                  }}
                >
                  Discard recovered draft
                </button>
              </div>
              {pendingReferral && (
                <div className="ncr-route-warning">
                  <strong>Linked Facilities requirement</strong>
                  <span>
                    {pendingReferral.facilitiesRequestCode} ·{" "}
                    {pendingReferral.sectionName} ·{" "}
                    {pendingReferral.requirement}
                  </span>
                  <small>
                    Saving this NCR will permanently link both records.
                  </small>
                </div>
              )}
              <div className="ncr-workflow">
                <b>
                  1<span>Draft</span>
                </b>
                <i />
                <b>
                  2<span>Approval</span>
                </b>
                <i />
                <b>
                  3<span>Procurement</span>
                </b>
                <i />
                <b>
                  4<span>Delivery</span>
                </b>
              </div>
              <section className="ncr-identity">
                <header>
                  Requester and approval routing
                  <small>Synced from ITMS Department and User Masters</small>
                </header>
                <label>
                  Requester
                  <input readOnly value={me?.name || identityName} />
                </label>
                <label>
                  Employee ID
                  <input
                    readOnly
                    value={me?.employeeCode || me?.code || "Not linked"}
                  />
                </label>
                <label>
                  Requesting department *
                  <select
                    value={selectedDepartmentId}
                    onChange={(event) => {
                      const next = departments.find(
                        (item) => item.id === event.target.value,
                      );
                      setSelectedDepartmentId(event.target.value);
                      setCostCentre(next?.costCentre || "");
                    }}
                  >
                    <option value="">Select department</option>
                    {departments
                      .filter((item) => item.status === "Active")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code ? `${item.code} · ` : ""}
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Department HOD
                  <input
                    readOnly
                    value={
                      department?.hodName || department?.hod || "HOD not mapped"
                    }
                  />
                </label>
                <label>
                  Approval email
                  <input
                    readOnly
                    value={
                      department?.hodEmail ||
                      department?.approverEmail ||
                      "Approval email not mapped"
                    }
                  />
                </label>
                <label>
                  Requester email
                  <input readOnly value={identityEmail} />
                </label>
              </section>
              {items.some((item) => item.group) &&
                !resolveApprovalRoute().complete && (
                  <div className="ncr-route-warning">
                    No active approval mapping covers one or more selected
                    categories, raisers, or the current INR value. Ask the NCR
                    administrator to update Approval mapping before submitting.
                  </div>
                )}
              {duplicateCandidates.length > 0 && (
                <div className="ncr-duplicate-warning">
                  <strong>Possible duplicate request</strong>
                  <span>
                    {duplicateCandidates
                      .map(
                        (row) =>
                          `${row.code} · ${row.items.map((item) => item.description).join(", ")}`,
                      )
                      .join(" | ")}
                  </span>
                  <small>
                    Review the existing request before submitting. This warning
                    does not block a legitimate repeat purchase.
                  </small>
                </div>
              )}
              {activeBudget && (
                <div
                  className={`ncr-budget-status ${total > Number(budgetRemaining) ? "over" : ""}`}
                >
                  <strong>
                    {activeBudget.costCentre} budget · FY{" "}
                    {activeBudget.financialYear}
                  </strong>
                  <span>
                    Ceiling {money(activeBudget.amount)} · committed{" "}
                    {money(budgetCommitted)} · available{" "}
                    {money(Number(budgetRemaining))}
                  </span>
                  {total > Number(budgetRemaining) && (
                    <small>
                      Request exceeds the available controlled budget and cannot
                      be submitted.
                    </small>
                  )}
                </div>
              )}
              <section className="ncr-fields">
                <label>
                  Purpose of purchase *
                  <select
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                  >
                    <option value="">Select purpose</option>
                    {purposes.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                {purpose === "Other" && (
                  <label>
                    Other purpose *
                    <input
                      value={otherPurpose}
                      onChange={(event) => setOtherPurpose(event.target.value)}
                      placeholder="Describe the purchase purpose"
                    />
                  </label>
                )}
                <label>
                  Required-by date *
                  <input
                    type="date"
                    value={requiredBy}
                    onChange={(event) => setRequiredBy(event.target.value)}
                  />
                </label>
                <label>
                  Priority
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    <option>Normal</option>
                    <option>High</option>
                    <option>Immediate</option>
                  </select>
                </label>
                <label>
                  Cost centre / budget reference
                  <input
                    value={costCentre}
                    onChange={(event) => setCostCentre(event.target.value)}
                    placeholder="Department default or request reference"
                  />
                </label>
                <label>
                  Delivery location *
                  <input
                    value={deliveryLocation}
                    onChange={(event) =>
                      setDeliveryLocation(event.target.value)
                    }
                    placeholder="Office, department or site"
                  />
                </label>
                <label className="wide">
                  Justification *
                  <textarea
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                    placeholder="Explain the need for this purchase"
                  />
                </label>
              </section>
              <section className="ncr-items">
                <header>
                  <strong>Items requested</strong>
                  <span>
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="ncr-item-head">
                  <span>Item group</span>
                  <span>Item / description</span>
                  <span>Specification / brand</span>
                  <span>Qty</span>
                  <span>UoM</span>
                  <span>Unit cost</span>
                  <span>Total</span>
                  <span />
                </div>
                {items.map((item) => (
                  <div className="ncr-item-row" key={item.id}>
                    <select
                      value={item.group}
                      onChange={(event) =>
                        updateLine(item.id, { group: event.target.value })
                      }
                    >
                      <option value="">Select group</option>
                      {activeCategories.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <input
                      list="ncr-history-items"
                      value={item.description}
                      onChange={(event) => {
                        const description = event.target.value;
                        const suggestion = historicalItems.find(
                          (value) =>
                            value.description.toLowerCase() ===
                            description.trim().toLowerCase(),
                        );
                        updateLine(
                          item.id,
                          suggestion
                            ? {
                                description: suggestion.description,
                                group: suggestion.group,
                                specification: suggestion.specification,
                                quantity: suggestion.quantity,
                                uom: suggestion.uom,
                                customUom: suggestion.customUom,
                                unitCost: suggestion.unitCost,
                              }
                            : { description },
                        );
                      }}
                      placeholder="Item name"
                    />
                    <input
                      value={item.specification}
                      onChange={(event) =>
                        updateLine(item.id, {
                          specification: event.target.value,
                        })
                      }
                      placeholder="Specification"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateLine(item.id, {
                          quantity: Number(event.target.value),
                        })
                      }
                    />
                    <div>
                      <select
                        value={item.uom}
                        onChange={(event) =>
                          updateLine(item.id, { uom: event.target.value })
                        }
                      >
                        {units.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                      {item.uom === "Other" && (
                        <input
                          value={item.customUom}
                          onChange={(event) =>
                            updateLine(item.id, {
                              customUom: event.target.value,
                            })
                          }
                          placeholder="Specify"
                        />
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={item.unitCost}
                      onChange={(event) =>
                        updateLine(item.id, {
                          unitCost: Number(event.target.value),
                        })
                      }
                    />
                    <output>{money(item.quantity * item.unitCost)}</output>
                    <button
                      disabled={items.length === 1}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((row) => row.id !== item.id),
                        )
                      }
                      aria-label="Remove item"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <datalist id="ncr-history-items">
                  {historicalItems.slice(0, 100).map((value) => (
                    <option
                      key={value.description.toLowerCase()}
                      value={value.description}
                    >
                      {value.group} · last ₹{value.unitCost} · used {value.uses}{" "}
                      time{value.uses === 1 ? "" : "s"}
                    </option>
                  ))}
                </datalist>
                <button
                  className="ncr-add-line"
                  onClick={() =>
                    setItems((current) => [...current, emptyLine()])
                  }
                >
                  <Icon name="plus" size={16} />
                  Add another item
                </button>
              </section>
              <section className="ncr-form-bottom">
                <label className="ncr-upload">
                  <strong>Attachments</strong>
                  <span>
                    PDF, DOCX, XLSX or images · up to 10 files · 15 MB each
                  </span>
                  <input
                    type="file"
                    multiple
                    onChange={chooseFiles}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                  />
                  <em>
                    {files.length
                      ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                      : "Choose files or drag them here"}
                  </em>
                </label>
                <aside className="ncr-summary">
                  <strong>Request summary</strong>
                  <span>
                    Estimated total <b>{money(total)}</b>
                  </span>
                  <span>
                    Approval route{" "}
                    <b>
                      {resolveApprovalRoute().emails.length
                        ? `${resolveApprovalRoute()
                            .routes.map(
                              (route) =>
                                `${route.category}: ${route.approver?.name || "Unmapped"}`,
                            )
                            .join(" · ")} → Purchase Department`
                        : "Select item categories to resolve approver"}
                    </b>
                  </span>
                </aside>
              </section>
              <footer className="ncr-actions">
                <button
                  onClick={() => {
                    reset();
                    setView("home");
                  }}
                >
                  Cancel
                </button>
                <button onClick={() => save("Draft")}>Save draft</button>
                <button
                  className="ncr-primary"
                  onClick={() => save("Submitted")}
                >
                  Submit request
                </button>
              </footer>
            </section>
          )}
          {[
            "requests",
            "drafts",
            "action",
            "approval",
            "delivery",
            "history",
          ].includes(view) && (
            <>
              <div className="ncr-filters ncr-register-controls">
                <label>
                  Search
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Request number, item, department or status"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option>All</option>
                    {[...new Set(mine.map((row) => row.state))].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Item category
                  <select
                    value={itemFilter}
                    onChange={(event) => setItemFilter(event.target.value)}
                  >
                    <option>All</option>
                    {[
                      ...new Set(
                        mine
                          .flatMap((row) => row.items.map((item) => item.group))
                          .filter(Boolean),
                      ),
                    ]
                      .sort()
                      .map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                  </select>
                </label>
                <label>
                  From
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </label>
                <label>
                  Sort
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option value="updated-desc">Newest activity</option>
                    <option value="updated-asc">Oldest activity</option>
                    <option value="value-desc">Highest value</option>
                    <option value="value-asc">Lowest value</option>
                  </select>
                </label>
                <button
                  className="ncr-clear-filters"
                  onClick={() => {
                    setSearch("");
                    setStatus("All");
                    setItemFilter("All");
                    setFromDate("");
                    setToDate("");
                    setSortBy("updated-desc");
                  }}
                >
                  Clear
                </button>
                <span>
                  {rows.length} result{rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <RequestList rows={rows} onEdit={edit} />
            </>
          )}
          {view === "reports" && (
            <section className="ncr-report">
              <article>
                <span>Total requests</span>
                <strong>{mine.length}</strong>
              </article>
              <article>
                <span>Submitted value</span>
                <strong>{money(purchaseValue)}</strong>
              </article>
              <article>
                <span>Fulfilled</span>
                <strong>
                  {
                    mine.filter((row) =>
                      ["Fulfilled", "Closed"].includes(row.state),
                    ).length
                  }
                </strong>
              </article>
              <article>
                <span>Rejected/cancelled</span>
                <strong>
                  {
                    mine.filter((row) =>
                      ["Rejected", "Cancelled"].includes(row.state),
                    ).length
                  }
                </strong>
              </article>
              <p>Your controlled request history and purchase values.</p>
              <button className="ncr-primary" onClick={downloadMyReport}>
                Download my report
              </button>
            </section>
          )}
          {view === "approvals" && (
            <NcrApprovalRegister
              rows={approvalRows}
              onDecision={(row, state, note) => void decide(row, state, note)}
            />
          )}
          {view === "procurement" && effectivePurchaser && (
            <NcrProcurement
              requests={requests}
              vendors={ncrMasterData.vendors || []}
              identityEmail={identityEmail}
              isAdmin={canManageMappings}
              onAction={(row, action, payload) =>
                void processPurchase(row, action, payload)
              }
            />
          )}
          {false && view === "procurement" && (
            <section className="ncr-operator">
              <header>
                <div>
                  <strong>Approved procurement queue</strong>
                  <small>
                    Approved requests from every department, ready for purchase
                    processing.
                  </small>
                </div>
              </header>
              {requests
                .filter((row) =>
                  [
                    "Approved",
                    "Procurement review",
                    "Purchase order",
                    "Partially fulfilled",
                  ].includes(row.state),
                )
                .map((row) => (
                  <article key={row.id}>
                    <div>
                      <strong>
                        {row.code} · {row.departmentName}
                      </strong>
                      <span>
                        {row.requesterName} · {row.items.length} items ·{" "}
                        {money(row.estimatedTotal)}
                      </span>
                      <small>
                        {row.state} · Required by {row.requiredBy}
                      </small>
                    </div>
                    <b>{row.state}</b>
                  </article>
                ))}
              {!requests.some((row) =>
                [
                  "Approved",
                  "Procurement review",
                  "Purchase order",
                  "Partially fulfilled",
                ].includes(row.state),
              ) && (
                <div className="ncr-empty">
                  <Icon name="service" size={30} />
                  <strong>No approved requests in queue</strong>
                </div>
              )}
            </section>
          )}
          {view === "mappings" && canManageMappings && (
            <NcrApprovalMappings
              users={users}
              groups={mappingGroups}
              categories={activeCategories}
              mappings={approvalMappings}
              approverUserIds={
                ncrMasterData.capabilities.some((item) => item.canApprove)
                  ? eligibleApprovers.map((user) => user.id)
                  : undefined
              }
              onChange={setApprovalMappings}
              onRoleAssignment={(raiserUserIds, approverUserId) =>
                setNcrMasterData((current) => {
                  let capabilities = [...current.capabilities];
                  const grant = (
                    userId: string,
                    key: "canRaise" | "canApprove",
                  ) => {
                    const existing = capabilities.find(
                      (item) => item.userId === userId,
                    );
                    const next = existing
                      ? { ...existing, [key]: true, status: "Active" as const }
                      : {
                          userId,
                          canRaise: key === "canRaise",
                          canApprove: key === "canApprove",
                          canPurchase: false,
                          status: "Active" as const,
                        };
                    capabilities = existing
                      ? capabilities.map((item) =>
                          item.userId === userId ? next : item,
                        )
                      : [...capabilities, next];
                  };
                  raiserUserIds.forEach((userId) => grant(userId, "canRaise"));
                  grant(approverUserId, "canApprove");
                  return { ...current, capabilities };
                })
              }
            />
          )}
          {view === "admin" && canManageMappings && (
            <NcrAdmin
              users={users}
              value={ncrMasterData}
              onChange={setNcrMasterData}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function RequestList({
  rows,
  onEdit,
}: {
  rows: NcrRequest[];
  onEdit: (row: NcrRequest) => void;
}) {
  const [selected, setSelected] = useState<NcrRequest | null>(null);
  return (
    <>
      <section className="ncr-list">
        <header>
          <span>Request</span>
          <span>Items</span>
          <span>Required by</span>
          <span>Value</span>
          <span>Status</span>
          <span>Action</span>
        </header>
        {rows.map((row) => (
          <article key={row.id}>
            <span>
              <strong>{row.code}</strong>
              <small>
                {row.purpose}
                {row.otherPurpose ? ` · ${row.otherPurpose}` : ""}
              </small>
            </span>
            <span>
              {row.items.length} item{row.items.length === 1 ? "" : "s"}
              <small>
                {row.items.map((item) => item.description).join(" · ")}
              </small>
            </span>
            <span>{row.requiredBy || "Not set"}</span>
            <span>{money(row.estimatedTotal)}</span>
            <b>{row.state}</b>
            <button
              onClick={() =>
                ["Draft", "Returned for correction"].includes(row.state)
                  ? onEdit(row)
                  : setSelected(row)
              }
            >
              {["Draft", "Returned for correction"].includes(row.state)
                ? "Continue"
                : "View"}
            </button>
          </article>
        ))}
        {!rows.length && (
          <div className="ncr-empty">
            <Icon name="requests" size={30} />
            <strong>No purchase requests found</strong>
            <span>
              Create a request or change the current search and filters.
            </span>
          </div>
        )}
      </section>
      {selected && (
        <NcrRequestDetail
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
