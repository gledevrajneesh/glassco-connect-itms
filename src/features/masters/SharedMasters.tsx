import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocalStore } from "../../lib/localStore";
import DataTable from "../../components/DataTable";
import { changedFields, useMasterAudit } from "../../lib/masterAudit";
import UserAssetProfile from "./UserAssetProfile";
import BulkDataCentre from "./BulkDataCentre";
import { firebaseAuth } from "../../lib/firebase";
import { syncAssignmentFromUserMaster } from "../../lib/centralAccess";
import { useEditLease } from "../../lib/editLease";
import "../../lib/editLease.css";

type Status = "Active" | "Inactive";
type MasterType = "Departments" | "Locations" | "User groups" | "Users";
type BasicRecord = {
  id: string;
  code: string;
  name: string;
  status: Status;
  hodUserId?: string;
  hodName?: string;
  hodEmail?: string;
  costCentre?: string;
};
type UserRecord = BasicRecord & {
  employeeCode: string;
  email: string;
  phone: string;
  departmentId: string;
  locationId: string;
  groupId: string;
};

const tabs: MasterType[] = ["Departments", "Locations", "User groups", "Users"];
const emptyBasic = {
  code: "",
  name: "",
  status: "Active" as Status,
  hodUserId: "",
  hodName: "",
  hodEmail: "",
  costCentre: "",
};
const emptyUser = {
  employeeCode: "",
  name: "",
  email: "",
  phone: "",
  departmentId: "",
  locationId: "",
  groupId: "",
  status: "Active" as Status,
};

const demoDepartments: BasicRecord[] = [
  ["IT", "Information Technology"],
  ["FIN", "Finance"],
  ["HR", "Human Resources"],
  ["SALES", "Sales"],
  ["SERVICE", "Service"],
].map(([code, name]) => ({
  id: `demo-dept-${code}`,
  code,
  name,
  status: "Active",
}));
const demoLocations: BasicRecord[] = [
  ["AMB-HO", "Ambala Head Office"],
  ["AMB-WH", "Ambala Warehouse"],
  ["DEL-OFC", "Delhi Office"],
  ["MUM-OFC", "Mumbai Office"],
  ["REMOTE", "Remote / Field"],
].map(([code, name]) => ({
  id: `demo-location-${code}`,
  code,
  name,
  status: "Active",
}));
const demoGroups: BasicRecord[] = [
  ["EMP", "Employees"],
  ["MGR", "Managers"],
  ["IT-AM", "IT Asset Managers"],
  ["IT-HOD", "IT Head"],
  ["AUD", "Auditors"],
].map(([code, name]) => ({
  id: `demo-group-${code}`,
  code,
  name,
  status: "Active",
}));
const demoUsers: UserRecord[] = [
  [
    "EMP-1001",
    "Aarav Sharma",
    "aarav.sharma@example.test",
    "9000000001",
    "IT",
    "AMB-HO",
    "IT-AM",
  ],
  [
    "EMP-1002",
    "Meera Gupta",
    "meera.gupta@example.test",
    "9000000002",
    "FIN",
    "AMB-HO",
    "EMP",
  ],
  [
    "EMP-1003",
    "Rohan Verma",
    "rohan.verma@example.test",
    "9000000003",
    "HR",
    "AMB-HO",
    "MGR",
  ],
  [
    "EMP-1004",
    "Nisha Kapoor",
    "nisha.kapoor@example.test",
    "9000000004",
    "SALES",
    "DEL-OFC",
    "EMP",
  ],
  [
    "EMP-1005",
    "Vikram Singh",
    "vikram.singh@example.test",
    "9000000005",
    "SERVICE",
    "REMOTE",
    "EMP",
  ],
].map(([employeeCode, name, email, phone, department, location, group]) => ({
  id: `demo-user-${employeeCode}`,
  code: employeeCode,
  employeeCode,
  name,
  email,
  phone,
  departmentId: `demo-dept-${department}`,
  locationId: `demo-location-${location}`,
  groupId: `demo-group-${group}`,
  status: "Active",
}));

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function SharedMasters() {
  const [activeTab, setActiveTab] = useState<MasterType>("Departments");
  const [formOpen, setFormOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [recordSearch, setRecordSearch] = useState("");
  const [departments, setDepartments] = useLocalStore<BasicRecord[]>(
    "itms.departments.v1",
    [],
  );
  const [locations, setLocations] = useLocalStore<BasicRecord[]>(
    "itms.locations.v1",
    [],
  );
  const [groups, setGroups] = useLocalStore<BasicRecord[]>(
    "itms.user-groups.v1",
    [],
  );
  const [users, setUsers] = useLocalStore<UserRecord[]>("itms.users.v1", []);
  const [basicForm, setBasicForm] = useState(emptyBasic);
  const [userForm, setUserForm] = useState(emptyUser);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [profileUserId, setProfileUserId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const audit = useMasterAudit();
  const editLease = useEditLease("itms", activeTab, editingId, firebaseAuth?.currentUser?.email || "Current ITMS user");

  const currentBasic =
    activeTab === "Departments"
      ? departments
      : activeTab === "Locations"
        ? locations
        : groups;
  const filteredBasic = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();
    return query
      ? currentBasic.filter((record) =>
          `${record.code} ${record.name} ${record.status}`
            .toLowerCase()
            .includes(query),
        )
      : currentBasic;
  }, [currentBasic, recordSearch]);
  const filteredUsers = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();
    return users.filter(
      (user) =>
        (departmentFilter === "all" ||
          user.departmentId === departmentFilter) &&
        (!query ||
          `${user.employeeCode} ${user.name} ${user.email} ${user.phone} ${departments.find((department) => department.id === user.departmentId)?.name ?? ""} ${locations.find((location) => location.id === user.locationId)?.name ?? ""} ${groups.find((group) => group.id === user.groupId)?.name ?? ""}`
            .toLowerCase()
            .includes(query)),
    );
  }, [departmentFilter, departments, groups, locations, recordSearch, users]);

  useEffect(() => {
    setDepartments((current) => [
      ...current,
      ...demoDepartments.filter(
        (seed) => !current.some((item) => item.code === seed.code),
      ),
    ]);
    setLocations((current) => [
      ...current,
      ...demoLocations.filter(
        (seed) => !current.some((item) => item.code === seed.code),
      ),
    ]);
    setGroups((current) => [
      ...current,
      ...demoGroups.filter(
        (seed) => !current.some((item) => item.code === seed.code),
      ),
    ]);
    setUsers((current) => [
      ...current,
      ...demoUsers.filter(
        (seed) =>
          !current.some((item) => item.employeeCode === seed.employeeCode),
      ),
    ]);
  }, [setDepartments, setGroups, setLocations, setUsers]);

  function closeForm() {
    setFormOpen(false);
    setEditingId("");
    setBasicForm(emptyBasic);
    setUserForm(emptyUser);
  }

  function saveBasic(event: FormEvent) {
    event.preventDefault();
    if (editingId && !editLease.canSave) { setMessage(editLease.notice || "This record is still being locked for editing. Please wait or refresh."); return; }
    const hodUser =
      activeTab === "Departments"
        ? users.find((user) => user.id === basicForm.hodUserId)
        : undefined;
    const record: BasicRecord = {
      id: makeId(activeTab.toLowerCase().replace(" ", "-")),
      ...basicForm,
      code: basicForm.code.trim().toUpperCase(),
      name: basicForm.name.trim(),
      ...(activeTab === "Departments"
        ? {
            hodName: hodUser?.name || "",
            hodEmail: hodUser?.email?.toLowerCase() || "",
            costCentre: basicForm.costCentre.trim(),
          }
        : {
            hodUserId: undefined,
            hodName: undefined,
            hodEmail: undefined,
            costCentre: undefined,
          }),
    };
    const setter =
      activeTab === "Departments"
        ? setDepartments
        : activeTab === "Locations"
          ? setLocations
          : setGroups;
    if (editingId) {
      const before = currentBasic.find((item) => item.id === editingId);
      const updated = { ...record, id: editingId };
      setter((records) =>
        records.map((item) => (item.id === editingId ? updated : item)),
      );
      if (before)
        audit.record({
          module: activeTab,
          recordId: editingId,
          recordCode: updated.code,
          action: "Updated",
          changedFields: changedFields(before, updated),
        });
      setMessage(`${activeTab.slice(0, -1)} ${updated.code} updated.`);
    } else {
      setter((records) => [...records, record]);
      audit.record({
        module: activeTab,
        recordId: record.id,
        recordCode: record.code,
        action: "Created",
        changedFields: "Initial record",
      });
      setMessage(`${activeTab.slice(0, -1)} ${record.code} created.`);
    }
    closeForm();
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (editingId && !editLease.canSave) { setMessage(editLease.notice || "This record is still being locked for editing. Please wait or refresh."); return; }
    const record: UserRecord = {
      id: makeId("user"),
      code: userForm.employeeCode.trim().toUpperCase(),
      ...userForm,
      employeeCode: userForm.employeeCode.trim().toUpperCase(),
      name: userForm.name.trim(),
      email: userForm.email.trim().toLowerCase(),
    };
    if (editingId) {
      const before = users.find((item) => item.id === editingId);
      const updated = { ...record, id: editingId };
      setUsers((records) =>
        records.map((item) => (item.id === editingId ? updated : item)),
      );
      await syncAssignmentFromUserMaster(
        updated,
        firebaseAuth?.currentUser?.email || "User Master administrator",
        before?.email,
      ).catch(() => undefined);
      if (before)
        audit.record({
          module: "Users",
          recordId: editingId,
          recordCode: updated.employeeCode,
          action: "Updated",
          changedFields: changedFields(before, updated),
        });
      setMessage(`User ${updated.employeeCode} updated.`);
    } else {
      setUsers((records) => [...records, record]);
      audit.record({
        module: "Users",
        recordId: record.id,
        recordCode: record.employeeCode,
        action: "Created",
        changedFields: "Initial record",
      });
      setMessage(`User ${record.employeeCode} created.`);
    }
    closeForm();
  }

  async function toggleStatus(id: string) {
    if (activeTab === "Users") {
      const before = users.find((item) => item.id === id);
      const updated = before
        ? {
            ...before,
            status: (before.status === "Active"
              ? "Inactive"
              : "Active") as Status,
          }
        : null;
      setUsers((records) =>
        records.map((record) =>
          record.id === id && updated ? updated : record,
        ),
      );
      if (updated)
        await syncAssignmentFromUserMaster(
          updated,
          firebaseAuth?.currentUser?.email || "User Master administrator",
        ).catch(() => undefined);
      if (before)
        audit.record({
          module: "Users",
          recordId: id,
          recordCode: before.code,
          action: "Status changed",
          changedFields: `status: ${before.status} → ${before.status === "Active" ? "Inactive" : "Active"}`,
        });
      return;
    }
    const setter =
      activeTab === "Departments"
        ? setDepartments
        : activeTab === "Locations"
          ? setLocations
          : setGroups;
    setter((records) =>
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              status: record.status === "Active" ? "Inactive" : "Active",
            }
          : record,
      ),
    );
    const before = currentBasic.find((item) => item.id === id);
    if (before)
      audit.record({
        module: activeTab,
        recordId: id,
        recordCode: before.code,
        action: "Status changed",
        changedFields: `status: ${before.status} → ${before.status === "Active" ? "Inactive" : "Active"}`,
      });
  }

  function editBasic(record: BasicRecord) {
    setEditingId(record.id);
    setBasicForm({
      code: record.code,
      name: record.name,
      status: record.status,
      hodUserId: record.hodUserId || "",
      hodName: record.hodName || "",
      hodEmail: record.hodEmail || "",
      costCentre: record.costCentre || "",
    });
    setFormOpen(true);
    setShowHistory(false);
  }
  function editUser(record: UserRecord) {
    setEditingId(record.id);
    setUserForm({
      employeeCode: record.employeeCode,
      name: record.name,
      email: record.email,
      phone: record.phone,
      departmentId: record.departmentId,
      locationId: record.locationId,
      groupId: record.groupId,
      status: record.status,
    });
    setFormOpen(true);
    setShowHistory(false);
  }

  const visibleRecords = activeTab === "Users" ? filteredUsers : filteredBasic;
  const total = visibleRecords.length;
  const active = visibleRecords.filter(
    (record) => record.status === "Active",
  ).length;
  const profileUser = users.find((record) => record.id === profileUserId);
  if (profileUser)
    return (
      <UserAssetProfile
        user={profileUser}
        onClose={() => setProfileUserId("")}
      />
    );
  if (bulkOpen) return <BulkDataCentre onClose={() => setBulkOpen(false)} />;

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">GCCP-ITMS-BUILD-01</span>
          <h1>Shared Organisation Masters</h1>
          <p>
            Govern the people and organisation references used by every ITMS
            workflow.
          </p>
        </div>
        <span className="phase">SHARED CLOUD DATA</span>
      </section>

      <section className="master-panel">
        <div className="master-toolbar">
          <div className="master-tabs" role="tablist" aria-label="Master type">
            {tabs.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "selected" : ""}
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setRecordSearch("");
                  setMessage("");
                  closeForm();
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setBulkOpen(true)}
            >
              Bulk data
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setShowHistory(!showHistory);
                closeForm();
              }}
            >
              Edit history
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setShowHistory(false);
                setFormOpen(!formOpen);
              }}
            >
              ＋ Add{" "}
              {activeTab === "Users"
                ? "user"
                : activeTab.slice(0, -1).toLowerCase()}
            </button>
          </div>
        </div>

        <div className="master-search-bar">
          <label>
            Search {activeTab.toLowerCase()}
            <input
              value={recordSearch}
              onChange={(event) => setRecordSearch(event.target.value)}
              placeholder={
                activeTab === "Users"
                  ? "Employee name, ID, email, contact, department or group"
                  : "Code, name or status"
              }
            />
          </label>
          <span>
            {total} match{total === 1 ? "" : "es"}
          </span>
        </div>

        {formOpen && activeTab !== "Users" && (
          <form className="master-form" onSubmit={saveBasic}>
            <label>
              Code
              <input
                required
                maxLength={20}
                value={basicForm.code}
                onChange={(event) =>
                  setBasicForm({ ...basicForm, code: event.target.value })
                }
                placeholder={
                  activeTab === "Departments" ? "e.g. IT" : "Enter unique code"
                }
              />
            </label>
            <label>
              Name
              <input
                required
                maxLength={100}
                value={basicForm.name}
                onChange={(event) =>
                  setBasicForm({ ...basicForm, name: event.target.value })
                }
                placeholder={`Enter ${activeTab.slice(0, -1).toLowerCase()} name`}
              />
            </label>
            {activeTab === "Departments" && (
              <>
                <label>
                  Department HOD
                  <select
                    required
                    value={basicForm.hodUserId}
                    onChange={(event) =>
                      setBasicForm({
                        ...basicForm,
                        hodUserId: event.target.value,
                      })
                    }
                  >
                    <option value="">Select HOD from User Master</option>
                    {users
                      .filter((user) => user.status === "Active")
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.employeeCode} · {user.name} · {user.email}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Cost centre / budget reference
                  <input
                    value={basicForm.costCentre}
                    onChange={(event) =>
                      setBasicForm({
                        ...basicForm,
                        costCentre: event.target.value,
                      })
                    }
                    placeholder="Optional department default"
                  />
                </label>
              </>
            )}
            <label>
              Status
              <select
                value={basicForm.status}
                onChange={(event) =>
                  setBasicForm({
                    ...basicForm,
                    status: event.target.value as Status,
                  })
                }
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="primary-action" disabled={Boolean(editingId && !editLease.canSave)}>
                Save record
              </button>
            </div>
          </form>
        )}

        {formOpen && activeTab === "Users" && (
          <form className="master-form user-form" onSubmit={saveUser}>
            <label>
              Employee code
              <input
                required
                maxLength={30}
                value={userForm.employeeCode}
                onChange={(event) =>
                  setUserForm({ ...userForm, employeeCode: event.target.value })
                }
                placeholder="Employee code"
              />
            </label>
            <label>
              Full name
              <input
                required
                maxLength={100}
                value={userForm.name}
                onChange={(event) =>
                  setUserForm({ ...userForm, name: event.target.value })
                }
                placeholder="Employee name"
              />
            </label>
            <label>
              Department
              <select
                required
                value={userForm.departmentId}
                onChange={(event) =>
                  setUserForm({ ...userForm, departmentId: event.target.value })
                }
              >
                <option value="">Select department</option>
                {departments
                  .filter((item) => item.status === "Active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Location
              <select
                required
                value={userForm.locationId}
                onChange={(event) =>
                  setUserForm({ ...userForm, locationId: event.target.value })
                }
              >
                <option value="">Select location</option>
                {locations
                  .filter((item) => item.status === "Active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              User group
              <select
                required
                value={userForm.groupId}
                onChange={(event) =>
                  setUserForm({ ...userForm, groupId: event.target.value })
                }
              >
                <option value="">Select group</option>
                {groups
                  .filter((item) => item.status === "Active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Company email
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm({ ...userForm, email: event.target.value })
                }
                placeholder="name@glasscolabs.com"
              />
            </label>
            <label>
              Contact number
              <input
                required
                type="tel"
                maxLength={20}
                value={userForm.phone}
                onChange={(event) =>
                  setUserForm({ ...userForm, phone: event.target.value })
                }
                placeholder="Contact number"
              />
            </label>
            <label>
              Status
              <select
                value={userForm.status}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    status: event.target.value as Status,
                  })
                }
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="primary-action" disabled={Boolean(editingId && !editLease.canSave)}>
                Save user
              </button>
            </div>
          </form>
        )}

        {message && (
          <div className="success-message" role="status">
            ✓ {message}
          </div>
        )}
        {formOpen && editingId && (
          <div className={`edit-lease-banner ${editLease.locked || editLease.notice ? "locked" : ""}`} role="status">
            {editLease.checking ? "Checking record lock..." : editLease.locked || editLease.notice ? editLease.notice || `${editLease.lease?.ownerName || "Another user"} is editing this record.` : `Editing lock held by you until ${editLease.lease?.expiresAt?.toDate?.().toLocaleTimeString("en-IN") || "your save or exit"}.`}
          </div>
        )}

        <div className="master-summary">
          <div>
            <span>Total records</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>Active</span>
            <strong>{active}</strong>
          </div>
          <div>
            <span>Inactive</span>
            <strong>{total - active}</strong>
          </div>
        </div>

        {activeTab === "Users" && (
          <div className="filter-row">
            <label>
              Department filter
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                <option value="all">All departments</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div aria-live="polite">
          {activeTab !== "Users" ? (
            <DataTable
              rows={filteredBasic}
              rowKey={(record) => record.id}
              columns={[
                {
                  key: "code",
                  label: "Code",
                  sticky: true,
                  width: "140px",
                  render: (record) => <strong>{record.code}</strong>,
                },
                {
                  key: "name",
                  label: "Name",
                  width: "260px",
                  render: (record) => record.name,
                },
                ...(activeTab === "Departments"
                  ? [
                      {
                        key: "hod",
                        label: "HOD / approver",
                        width: "260px",
                        render: (record: BasicRecord) =>
                          record.hodEmail ? (
                            <>
                              <strong>{record.hodName}</strong>
                              <br />
                              <small>{record.hodEmail}</small>
                            </>
                          ) : (
                            "Not mapped"
                          ),
                      },
                      {
                        key: "costCentre",
                        label: "Cost centre",
                        width: "160px",
                        render: (record: BasicRecord) =>
                          record.costCentre || "—",
                      },
                    ]
                  : []),
                {
                  key: "context",
                  label: "Record type",
                  width: "230px",
                  render: () =>
                    `Controlled ${activeTab.slice(0, -1).toLowerCase()} master`,
                },
                {
                  key: "status",
                  label: "Status",
                  width: "120px",
                  render: (record) => (
                    <span className={`status ${record.status.toLowerCase()}`}>
                      {record.status}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  width: "210px",
                  render: (record) => (
                    <div className="table-actions">
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => editBasic(record)}
                      >
                        Edit
                      </button>
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => toggleStatus(record.id)}
                      >
                        {record.status === "Active" ? "Remove" : "Restore"}
                      </button>
                    </div>
                  ),
                },
              ]}
              empty={
                <div className="empty-state">
                  <span>◫</span>
                  <strong>No {activeTab.toLowerCase()} recorded</strong>
                  <p>
                    Add the first governed record to begin building the
                    organisation master.
                  </p>
                </div>
              }
            />
          ) : (
            <DataTable
              rows={filteredUsers}
              rowKey={(record) => record.id}
              columns={[
                {
                  key: "employee",
                  label: "Employee",
                  sticky: true,
                  width: "220px",
                  render: (record) => (
                    <button
                      type="button"
                      className="asset-link"
                      onClick={() => setProfileUserId(record.id)}
                    >
                      <strong>{record.employeeCode}</strong>
                      <small>{record.name}</small>
                    </button>
                  ),
                },
                {
                  key: "department",
                  label: "Department",
                  width: "190px",
                  render: (record) =>
                    departments.find((item) => item.id === record.departmentId)
                      ?.name ?? "Unavailable",
                },
                {
                  key: "location",
                  label: "Location",
                  width: "180px",
                  render: (record) =>
                    locations.find((item) => item.id === record.locationId)
                      ?.name ?? "Unavailable",
                },
                {
                  key: "group",
                  label: "User group",
                  width: "170px",
                  render: (record) =>
                    groups.find((item) => item.id === record.groupId)?.name ??
                    "Unavailable",
                },
                {
                  key: "email",
                  label: "Email",
                  width: "230px",
                  render: (record) => record.email,
                },
                {
                  key: "phone",
                  label: "Contact",
                  width: "150px",
                  render: (record) => record.phone,
                },
                {
                  key: "status",
                  label: "Status",
                  width: "110px",
                  render: (record) => (
                    <span className={`status ${record.status.toLowerCase()}`}>
                      {record.status}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  width: "210px",
                  render: (record) => (
                    <div className="table-actions">
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => editUser(record)}
                      >
                        Edit
                      </button>
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => toggleStatus(record.id)}
                      >
                        {record.status === "Active" ? "Remove" : "Restore"}
                      </button>
                    </div>
                  ),
                },
              ]}
              empty={
                <div className="empty-state">
                  <span>◫</span>
                  <strong>No users recorded</strong>
                  <p>Add the first governed user record.</p>
                </div>
              }
            />
          )}
        </div>
        {showHistory && (
          <DataTable
            rows={[...audit.events]
              .filter((event) => event.module === activeTab)
              .reverse()}
            rowKey={(event) => event.id}
            columns={[
              {
                key: "time",
                label: "Timestamp",
                sticky: true,
                width: "190px",
                render: (event) =>
                  new Date(event.timestamp).toLocaleString("en-IN"),
              },
              {
                key: "record",
                label: "Record",
                width: "160px",
                render: (event) => event.recordCode,
              },
              {
                key: "action",
                label: "Action",
                width: "130px",
                render: (event) => event.action,
              },
              {
                key: "fields",
                label: "Changed fields",
                width: "360px",
                render: (event) => event.changedFields,
              },
              {
                key: "actor",
                label: "Changed by",
                width: "220px",
                render: (event) => event.actor,
              },
            ]}
            empty={
              <div className="empty-state">
                <span>◷</span>
                <strong>No edit history</strong>
                <p>Future changes to this master will be recorded here.</p>
              </div>
            }
          />
        )}
      </section>
    </>
  );
}
