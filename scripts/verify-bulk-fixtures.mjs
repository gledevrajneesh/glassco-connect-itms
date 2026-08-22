import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseCsv(text){const output=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(char===','&&!quoted){row.push(cell);cell=''}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>value.trim()))output.push(row);row=[];cell=''}else cell+=char}row.push(cell);if(row.some(value=>value.trim()))output.push(row);return output}
function fixture(name){return parseCsv(readFileSync(resolve('test-fixtures/bulk',name),'utf8'))}
function records(matrix){const [headers,...rows]=matrix;return rows.map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]??''])))}

const users=records(fixture('users-valid.csv'))
assert.equal(users.length,2)
assert.ok(users.every(user=>/^\S+@glasscolabs\.com$/.test(user.email)))
assert.ok(users.every(user=>user.department_code&&user.location_code&&user.user_group_code))

const assets=records(fixture('assets-valid.csv'))
assert.equal(assets.length,2)
assert.ok(assets.every(asset=>Number.isFinite(Number(asset.cost))&&Number(asset.cost)>=0))
assert.equal(new Set(assets.map(asset=>asset.serial_number)).size,assets.length)

const invalid=records(fixture('assets-invalid.csv'))
assert.ok(invalid.some(asset=>!Number.isFinite(Number(asset.cost))))
assert.ok(new Set(invalid.map(asset=>asset.serial_number)).size<invalid.length)
assert.ok(invalid.some(asset=>asset.location_code==='UNKNOWN'))
console.log('Bulk CSV fixtures verified: valid users/assets accepted; malformed cost, duplicate serial and unmapped location detected.')
