import type {Entry} from './domain.ts';

export function sameValue(a:unknown,b:unknown):boolean {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>sameValue(value,b[index]));
  const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);
  return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&sameValue(left[key],right[key]));
}
export function sameEntryContent(a:Entry,b:Entry):boolean {
  const {updatedAt:oldTime,...left}=a,{updatedAt:newTime,...right}=b;
  void oldTime;void newTime;
  return sameValue(left,right);
}
// Editor merges can change array order and timestamps without changing any data.
// Preserve existing order and references so those saves don't dirty the workspace.
export function actualEntryChanges(current:Entry[],incoming:Entry[]):Entry[]{
  const next=new Map(incoming.map(entry=>[entry.id,entry])),before=new Map(current.map(entry=>[entry.id,entry]));
  const result=current.filter(entry=>next.has(entry.id)).map(entry=>{
    const candidate=next.get(entry.id)!;return sameEntryContent(entry,candidate)?entry:candidate;
  });
  result.push(...incoming.filter(entry=>!before.has(entry.id)));
  return result.length===current.length&&result.every((entry,index)=>entry===current[index])?current:result;
}
