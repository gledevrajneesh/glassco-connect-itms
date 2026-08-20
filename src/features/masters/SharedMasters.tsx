import { useMemo, useState, type FormEvent } from 'react'
import { useLocalStore } from '../../lib/localStore'

type Status = 'Active' | 'Inactive'
type MasterType = 'Departments' | 'Locations' | 'User groups' | 'Users'
type BasicRecord = { id: string; code: string; name: string; status: Status }
type UserRecord = BasicRecord & { employeeCode: string; email: string; phone: string; departmentId: string; locationId: string; groupId: string }

const tabs: MasterType[] = ['Departments', 'Locations', 'User groups', 'Users']
const emptyBasic = { code: '', name: '', status: 'Active' as Status }
const emptyUser = { employeeCode: '', name: '', email: '', phone: '', departmentId: '', locationId: '', groupId: '', status: 'Active' as Status }

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export default function SharedMasters() {
  const [activeTab, setActiveTab] = useState<MasterType>('Departments')
  const [formOpen, setFormOpen] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [departments, setDepartments] = useLocalStore<BasicRecord[]>('itms.departments.v1', [])
  const [locations, setLocations] = useLocalStore<BasicRecord[]>('itms.locations.v1', [])
  const [groups, setGroups] = useLocalStore<BasicRecord[]>('itms.user-groups.v1', [])
  const [users, setUsers] = useLocalStore<UserRecord[]>('itms.users.v1', [])
  const [basicForm, setBasicForm] = useState(emptyBasic)
  const [userForm, setUserForm] = useState(emptyUser)
  const [message, setMessage] = useState('')

  const currentBasic = activeTab === 'Departments' ? departments : activeTab === 'Locations' ? locations : groups
  const filteredUsers = useMemo(() => departmentFilter === 'all' ? users : users.filter((user) => user.departmentId === departmentFilter), [departmentFilter, users])

  function closeForm() {
    setFormOpen(false)
    setBasicForm(emptyBasic)
    setUserForm(emptyUser)
  }

  function saveBasic(event: FormEvent) {
    event.preventDefault()
    const record: BasicRecord = { id: makeId(activeTab.toLowerCase().replace(' ', '-')), ...basicForm, code: basicForm.code.trim().toUpperCase(), name: basicForm.name.trim() }
    const setter = activeTab === 'Departments' ? setDepartments : activeTab === 'Locations' ? setLocations : setGroups
    setter((records) => [...records, record])
    setMessage(`${activeTab.slice(0, -1)} ${record.code} created.`)
    closeForm()
  }

  function saveUser(event: FormEvent) {
    event.preventDefault()
    const record: UserRecord = { id: makeId('user'), code: userForm.employeeCode.trim().toUpperCase(), ...userForm, employeeCode: userForm.employeeCode.trim().toUpperCase(), name: userForm.name.trim(), email: userForm.email.trim().toLowerCase() }
    setUsers((records) => [...records, record])
    setMessage(`User ${record.employeeCode} created.`)
    closeForm()
  }

  function toggleStatus(id: string) {
    if (activeTab === 'Users') {
      setUsers((records) => records.map((record) => record.id === id ? { ...record, status: record.status === 'Active' ? 'Inactive' : 'Active' } : record))
      return
    }
    const setter = activeTab === 'Departments' ? setDepartments : activeTab === 'Locations' ? setLocations : setGroups
    setter((records) => records.map((record) => record.id === id ? { ...record, status: record.status === 'Active' ? 'Inactive' : 'Active' } : record))
  }

  const total = activeTab === 'Users' ? filteredUsers.length : currentBasic.length
  const active = activeTab === 'Users' ? filteredUsers.filter((record) => record.status === 'Active').length : currentBasic.filter((record) => record.status === 'Active').length

  return (
    <>
      <section className="page-heading">
        <div><span className="eyebrow">GCCP-ITMS-BUILD-01</span><h1>Shared Organisation Masters</h1><p>Govern the people and organisation references used by every ITMS workflow.</p></div>
        <span className="phase">LOCALHOST DATA</span>
      </section>

      <section className="master-panel">
        <div className="master-toolbar">
          <div className="master-tabs" role="tablist" aria-label="Master type">
            {tabs.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'selected' : ''} key={tab} onClick={() => { setActiveTab(tab); setMessage(''); closeForm() }}>{tab}</button>)}
          </div>
          <button type="button" className="primary-action" onClick={() => setFormOpen(!formOpen)}>＋ Add {activeTab === 'Users' ? 'user' : activeTab.slice(0, -1).toLowerCase()}</button>
        </div>

        {formOpen && activeTab !== 'Users' && <form className="master-form" onSubmit={saveBasic}>
          <label>Code<input required maxLength={20} value={basicForm.code} onChange={(event) => setBasicForm({ ...basicForm, code: event.target.value })} placeholder={activeTab === 'Departments' ? 'e.g. IT' : 'Enter unique code'} /></label>
          <label>Name<input required maxLength={100} value={basicForm.name} onChange={(event) => setBasicForm({ ...basicForm, name: event.target.value })} placeholder={`Enter ${activeTab.slice(0, -1).toLowerCase()} name`} /></label>
          <label>Status<select value={basicForm.status} onChange={(event) => setBasicForm({ ...basicForm, status: event.target.value as Status })}><option>Active</option><option>Inactive</option></select></label>
          <div className="form-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit" className="primary-action">Save record</button></div>
        </form>}

        {formOpen && activeTab === 'Users' && <form className="master-form user-form" onSubmit={saveUser}>
          <label>Employee code<input required maxLength={30} value={userForm.employeeCode} onChange={(event) => setUserForm({ ...userForm, employeeCode: event.target.value })} placeholder="Employee code" /></label>
          <label>Full name<input required maxLength={100} value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} placeholder="Employee name" /></label>
          <label>Department<select required value={userForm.departmentId} onChange={(event) => setUserForm({ ...userForm, departmentId: event.target.value })}><option value="">Select department</option>{departments.filter((item) => item.status === 'Active').map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label>Location<select required value={userForm.locationId} onChange={(event) => setUserForm({ ...userForm, locationId: event.target.value })}><option value="">Select location</option>{locations.filter((item) => item.status === 'Active').map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label>User group<select required value={userForm.groupId} onChange={(event) => setUserForm({ ...userForm, groupId: event.target.value })}><option value="">Select group</option>{groups.filter((item) => item.status === 'Active').map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label>Company email<input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} placeholder="name@glasscolabs.com" /></label>
          <label>Contact number<input required type="tel" maxLength={20} value={userForm.phone} onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })} placeholder="Contact number" /></label>
          <label>Status<select value={userForm.status} onChange={(event) => setUserForm({ ...userForm, status: event.target.value as Status })}><option>Active</option><option>Inactive</option></select></label>
          <div className="form-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit" className="primary-action">Save user</button></div>
        </form>}

        {message && <div className="success-message" role="status">✓ {message}</div>}

        <div className="master-summary"><div><span>Total records</span><strong>{total}</strong></div><div><span>Active</span><strong>{active}</strong></div><div><span>Inactive</span><strong>{total - active}</strong></div></div>

        {activeTab === 'Users' && <div className="filter-row"><label>Department filter<select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label></div>}

        <div className="records" aria-live="polite">
          {activeTab !== 'Users' && currentBasic.map((record) => <article className="record" key={record.id}><div><strong>{record.code} · {record.name}</strong><span>Controlled {activeTab.slice(0, -1).toLowerCase()} master record</span></div><div className="record-actions"><span className={`status ${record.status.toLowerCase()}`}>{record.status}</span><button type="button" onClick={() => toggleStatus(record.id)}>{record.status === 'Active' ? 'Deactivate' : 'Reactivate'}</button></div></article>)}
          {activeTab === 'Users' && filteredUsers.map((record) => <article className="record user-record" key={record.id}><div><strong>{record.employeeCode} · {record.name}</strong><span>{departments.find((item) => item.id === record.departmentId)?.name ?? 'Department unavailable'} · {record.email} · {record.phone}</span></div><div className="record-actions"><span className={`status ${record.status.toLowerCase()}`}>{record.status}</span><button type="button" onClick={() => toggleStatus(record.id)}>{record.status === 'Active' ? 'Deactivate' : 'Reactivate'}</button></div></article>)}
          {total === 0 && <div className="empty-state"><span>◫</span><strong>No {activeTab.toLowerCase()} recorded</strong><p>Add the first governed record to begin building the organisation master.</p></div>}
        </div>
      </section>
    </>
  )
}
