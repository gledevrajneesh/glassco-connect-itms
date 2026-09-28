export type SpecificationField = { id:string; typeId:string; name:string; key:string; fieldType:'Text'|'Number'|'Select'|'Yes / no'; options:string[]; unit?:string; required:boolean; filterable:boolean; status:'Active'|'Inactive'; standard?:boolean; showWhen?:{key:string;equals:string} }
export type SpecificationChange = { id:string; assetId:string; key:string; previousValue:string; nextValue:string; changedAt:string; changedBy:string; source:'Registration'|'Edit'|'Import'|'Clone' }
export type SpareCompatibility = { id:string; spareTypeId:string; compatibleTypeIds:string[]; compatibleModelIds:string[]; note?:string; updatedAt:string }
export type AssetTypeLike = { id:string; code:string; name:string }
export type ModelSpecificationDefaults = { modelId:string; values:Record<string,string>; updatedAt:string }

const field=(typeId:string,key:string,name:string,options:string[]=[],required=false,filterable=true):SpecificationField=>({id:`standard-${typeId}-${key}`,typeId,name,key,fieldType:options.length?'Select':'Text',options,required,filterable,status:'Active',standard:true})
export function standardSpecifications(type:AssetTypeLike):SpecificationField[]{
 const value=`${type.code} ${type.name}`.toLowerCase()
 if(/laptop|desktop|cpu|all.?in.?one/.test(value))return [field(type.id,'cpu','Processor / CPU'),field(type.id,'ram','RAM',['4 GB','8 GB','16 GB','32 GB','64 GB'],true),field(type.id,'storage','Storage / HDD / SSD',['256 GB SSD','512 GB SSD','1 TB SSD','2 TB SSD'],true),field(type.id,'operatingSystem','Operating system'),field(type.id,'screen','Screen size')]
 if(/switch|network|router|firewall/.test(value))return [field(type.id,'portCount','Port count',['8','16','24','48'],true),field(type.id,'poe','PoE support',['Yes','No']),{...field(type.id,'poeWattage','PoE wattage',['30 W','60 W','90 W']),showWhen:{key:'poe',equals:'Yes'}},field(type.id,'uplink','Uplink type',['1G','10G','SFP','SFP+']),field(type.id,'managed','Managed',['Managed','Unmanaged'],true),field(type.id,'lanSpeed','LAN speed',['1 Gbps','2.5 Gbps','10 Gbps'])]
 if(/printer/.test(value))return [field(type.id,'printTechnology','Print technology',['Laser','Inkjet','Thermal'],true),field(type.id,'colour','Colour capability',['Colour','Monochrome'],true),field(type.id,'function','Function type',['Single function','All-in-one']),field(type.id,'connectivity','Connectivity',['USB','LAN','Wi-Fi','LAN + Wi-Fi']),field(type.id,'duplex','Duplex printing',['Yes','No'])]
 if(/monitor|display/.test(value))return [field(type.id,'screenSize','Screen size'),field(type.id,'resolution','Resolution',['Full HD','QHD','4K']),field(type.id,'panel','Panel type',['IPS','VA','TN','OLED']),field(type.id,'ports','Ports')]
 if(/mobile|phone/.test(value))return [field(type.id,'ram','RAM'),field(type.id,'storage','Storage'),field(type.id,'imei','IMEI',[],true),field(type.id,'sim','SIM type',['Single SIM','Dual SIM','eSIM'])]
 if(/spare|part|ram|storage|cartridge/.test(value))return [field(type.id,'partNumber','Part number',[],true),field(type.id,'compatibility','Compatible model / category',[],true),field(type.id,'specification','Specification')]
 return [field(type.id,'specification','Specification',[],false),field(type.id,'compatibility','Compatibility / notes')]
}
export function specificationsFor(type:AssetTypeLike|undefined, custom:SpecificationField[]){if(!type)return[];const standard=standardSpecifications(type);const customForType=custom.filter(item=>item.typeId===type.id&&item.status==='Active');return [...standard,...customForType.filter(item=>!standard.some(base=>base.key===item.key))]}
export function visibleSpecifications(fields:SpecificationField[], values:Record<string,string>){return fields.filter(field=>!field.showWhen||values[field.showWhen.key]===field.showWhen.equals)}
export function specificationColumns(fields:SpecificationField[]){return fields.map(field=>`spec_${field.key}`)}
