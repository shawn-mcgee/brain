import { MAX_FILE_SIZE } from './board-model';
import type { Attachment } from './board-model';
import type { Entry } from './domain';
import { fileRequest } from './storage';
import type { Connection } from './storage';
type FileRecord = { key:string; dataUrl:string; uploadedTo:string; entryId:string; metadata:Attachment };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const open=indexedDB.open('brain-attachments-v1',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('files',{keyPath:'key'});
    open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(new Error('Attachment storage is unavailable in this browser.'));
  });
}
async function record(key:string,value?:FileRecord):Promise<FileRecord|undefined> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('files',value?'readwrite':'readonly'),store=tx.objectStore('files');
    const req=value?store.put(value):store.get(key);
    tx.oncomplete=()=>{db.close();resolve(value||req.result)};
    tx.onerror=()=>{db.close();reject(new Error('Could not save attachment locally. Browser storage may be full.'))};
    tx.onabort=tx.onerror;
  });
}
export async function stageFile(file:File,entryId:string):Promise<Attachment> {
  if(file.size>MAX_FILE_SIZE)throw new Error(`${file.name} exceeds the 2 MB file limit.`);
  const metadata:Attachment={id:crypto.randomUUID(),name:file.name,type:file.type||'application/octet-stream',size:file.size,createdAt:new Date().toISOString()};
  const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error(`Could not read ${file.name}.`));reader.readAsDataURL(new Blob([file],{type:metadata.type}));});
  await record(`local:${metadata.id}`,{key:`local:${metadata.id}`,dataUrl,uploadedTo:'',entryId,metadata});
  return metadata;
}
export async function uploadPendingFiles(entries:Entry[],connection:Connection,token:string) {
  for(const entry of entries)for(const metadata of entry.attachments||[]){
    const local=await record(`local:${metadata.id}`);
    if(!local||local.uploadedTo===connection.url)continue;
    await fileRequest(connection,token,'file.put',{entryId:local.entryId,metadata,dataUrl:local.dataUrl});
    await record(local.key,{...local,uploadedTo:connection.url});
  }
}
const pendingReads=new Map<string,Promise<string>>();
export function getFile(metadata:Attachment,entryId:string,connection:Connection,token?:string):Promise<string> {
  const key=`${connection.url}:${metadata.id}`;
  const existing=pendingReads.get(key);if(existing)return existing;
  const load=(async()=>{
    const local=await record(`local:${metadata.id}`);if(local)return local.dataUrl;
    const cached=await record(key);if(cached)return cached.dataUrl;
    if(!token)throw new Error('Sign in to load this attachment.');
    const response=await fileRequest(connection,token,'file.get',{id:metadata.id,entryId});
    if(typeof response.dataUrl!=='string'||!response.dataUrl.startsWith(`data:${metadata.type};base64,`))throw new Error('Invalid attachment response.');
    await record(key,{key,dataUrl:response.dataUrl,uploadedTo:connection.url,entryId,metadata});
    return response.dataUrl;
  })();
  pendingReads.set(key,load);load.finally(()=>pendingReads.delete(key)).catch(()=>{});
  return load;
}
export async function downloadFile(metadata:Attachment,entryId:string,connection:Connection,token?:string) {
  const dataUrl=await getFile(metadata,entryId,connection,token);
  const encoded=dataUrl.slice(dataUrl.indexOf(',')+1),binary=atob(encoded),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:metadata.type}));
  const link=document.createElement('a');link.href=url;link.download=metadata.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
