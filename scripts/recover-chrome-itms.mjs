import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const [source, output] = process.argv.slice(2)
if (!source) throw new Error('Pass the Chrome Local Storage LevelDB log path.')
const raw = readFileSync(source)
const logicalRecords = []
let fragments = []
for (let block = 0; block < raw.length; block += 32768) {
  const limit = Math.min(block + 32768, raw.length)
  let offset = block
  while (offset + 7 <= limit) {
    const length = raw[offset + 4] | (raw[offset + 5] << 8)
    const type = raw[offset + 6]
    if (!length && !type) break
    const end = offset + 7 + length
    if (end > limit) break
    const payload = raw.subarray(offset + 7, end)
    if (type === 1) logicalRecords.push(payload)
    else if (type === 2) fragments = [payload]
    else if (type === 3) fragments.push(payload)
    else if (type === 4) { fragments.push(payload); logicalRecords.push(Buffer.concat(fragments)); fragments = [] }
    offset = end
  }
}
const data = Buffer.concat(logicalRecords)
const keys = ['itms.departments.v1','itms.locations.v1','itms.user-groups.v1','itms.users.v1']
const recovered = {}

function parseArrayAt(start) {
  let depth = 0, quoted = false, escaped = false
  for (let index = start; index < data.length; index += 1) {
    const byte = data[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (byte === 0x5c) escaped = true
      else if (byte === 0x22) quoted = false
      continue
    }
    if (byte === 0x22) quoted = true
    else if (byte === 0x5b) depth += 1
    else if (byte === 0x5d && --depth === 0) {
      try { return JSON.parse(data.subarray(start, index + 1).toString('utf8')) } catch (error) {
        if (process.env.RECOVERY_DEBUG === '1') console.error(`Candidate ${start}-${index}: ${error.message}`)
        return null
      }
    }
  }
  return null
}

for (const key of keys) {
  let cursor = 0
  const candidates = []
  while ((cursor = data.indexOf(key, cursor)) !== -1) {
    const start = data.indexOf(0x5b, cursor + key.length)
    const records = start === -1 ? null : parseArrayAt(start)
    if (Array.isArray(records)) candidates.push(records)
    cursor += Buffer.byteLength(key)
  }
  recovered[key] = candidates.sort((a,b)=>b.length-a.length)[0] || []
}

const summary = Object.fromEntries(Object.entries(recovered).map(([key,records])=>[key,records.length]))
console.log(JSON.stringify(summary, null, 2))
if (output) {
  writeFileSync(output, JSON.stringify({recoveredAt:new Date().toISOString(),source,recovered}, null, 2))
  const quote = (value='') => `"${String(value).replaceAll('"','""')}"`
  const departments = recovered['itms.departments.v1']
  const users = recovered['itms.users.v1']
  const departmentCodes = new Map(departments.map((record)=>[record.id,record.code]))
  const locationCodes = new Map([['demo-location-AMB-HO','AMB-HO'],['demo-location-AMB-WH','AMB-WH'],['demo-location-DEL-OFC','DEL-OFC'],['demo-location-MUM-OFC','MUM-OFC'],['demo-location-REMOTE','REMOTE']])
  const groupCodes = new Map([['demo-group-EMP','EMP'],['demo-group-MGR','MGR'],['demo-group-IT-AM','IT-AM'],['demo-group-IT-HOD','IT-HOD'],['demo-group-AUD','AUD']])
  writeFileSync(join(dirname(output),'recovered-departments.csv'),['code,name,status',...departments.map((r)=>[r.code,r.name,r.status].map(quote).join(','))].join('\r\n'))
  writeFileSync(join(dirname(output),'recovered-users.csv'),['employee_code,name,email,phone,department_code,location_code,user_group_code,status',...users.map((r)=>[r.employeeCode,r.name,r.email,r.phone,departmentCodes.get(r.departmentId)||'',locationCodes.get(r.locationId)||'',groupCodes.get(r.groupId)||'',r.status].map(quote).join(','))].join('\r\n'))
}
