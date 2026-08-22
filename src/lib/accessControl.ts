export const moduleNames = ['Dashboard','Operations Centre','Shared Masters','Asset Inventory','Allocation & Custody','Maintenance & Inspection','Assurance & Controls','Asset Retirement & Circularity','Reports & Analytics','Access & Roles'] as const
export type ModuleName = typeof moduleNames[number]
export type RoleId = 'administrator'|'asset-manager'|'it-head'|'auditor'|'department-manager'|'standard-user'
export type ActionPermission = 'manage.masters'|'manage.inventory'|'manage.maintenance'|'request.custody'|'approve.asset-manager'|'approve.it-head'|'manage.retirement'|'view.audit'
export type RoleDefinition = { id:RoleId; name:string; description:string; modules:ModuleName[]; actions:ActionPermission[] }
export const roles:RoleDefinition[] = [
  {id:'administrator',name:'Administrator',description:'Full platform administration, role assignment and operational access.',modules:[...moduleNames],actions:['manage.masters','manage.inventory','manage.maintenance','request.custody','approve.asset-manager','approve.it-head','manage.retirement','view.audit']},
  {id:'asset-manager',name:'IT Asset Manager',description:'Runs inventory, custody, maintenance and first-stage asset approvals.',modules:['Dashboard','Operations Centre','Shared Masters','Asset Inventory','Allocation & Custody','Maintenance & Inspection','Assurance & Controls','Asset Retirement & Circularity','Reports & Analytics'],actions:['manage.masters','manage.inventory','manage.maintenance','request.custody','approve.asset-manager','manage.retirement']},
  {id:'it-head',name:'IT Head',description:'Final approval authority with management and reporting visibility.',modules:['Dashboard','Operations Centre','Asset Inventory','Allocation & Custody','Maintenance & Inspection','Assurance & Controls','Asset Retirement & Circularity','Reports & Analytics'],actions:['manage.inventory','manage.maintenance','request.custody','approve.it-head','manage.retirement','view.audit']},
  {id:'auditor',name:'Auditor',description:'Read-only access to controlled records, reports, declarations and trails.',modules:['Dashboard','Operations Centre','Shared Masters','Asset Inventory','Allocation & Custody','Maintenance & Inspection','Assurance & Controls','Asset Retirement & Circularity','Reports & Analytics'],actions:['view.audit']},
  {id:'department-manager',name:'Department Manager',description:'Limited custody visibility and initiation for departmental requirements.',modules:['Dashboard','Allocation & Custody','Reports & Analytics'],actions:['request.custody']},
  {id:'standard-user',name:'Standard User',description:'No ITMS operational access; personal assets will be exposed through the Support Desk profile.',modules:[],actions:[]},
]
export const roleById=(id:RoleId)=>roles.find(role=>role.id===id)??roles[0]
export const canOpen=(role:RoleId,module:ModuleName)=>roleById(role).modules.includes(module)
export const canDo=(role:RoleId,action:ActionPermission)=>roleById(role).actions.includes(action)
