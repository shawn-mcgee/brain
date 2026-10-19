import { useEffect, useRef, useState } from 'react';
import type { Attachment } from './board-model';
import { isPreviewImage } from './board-model';
import type { Connection } from './storage';
import { downloadFile, getFile, stageFile } from './files';
import ImagePreview from './ImagePreview';
export function AttachmentImage({file,entryId,connection,token,interactive=false}:{file:Attachment;entryId:string;connection:Connection;token?:string;interactive?:boolean}) {
  const [previewOpen,setPreviewOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(()=>!('IntersectionObserver' in window)),[source,setSource]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{if(!ref.current)return;if(!('IntersectionObserver' in window))return;const observer=new IntersectionObserver(items=>{if(items.some(i=>i.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'150px'});observer.observe(ref.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!visible)return;let active=true;getFile(file,entryId,connection,token).then(url=>{if(active)setSource(url)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[visible,file,entryId,connection,token,retry]);
  const picture=<img draggable={false} src={source} alt={file.name} onError={()=>{setSource('');setError('This image could not be displayed.')}}/>;
  return <div className="attachment-image" ref={ref}>{source?interactive?<button type="button" className="image-preview-trigger" aria-label={`Preview ${file.name}`} onClick={()=>setPreviewOpen(true)}>{picture}</button>:picture:error?<div><p role="alert">{error}</p><button type="button" className="secondary" onClick={()=>{setError('');setRetry(n=>n+1)}}>Retry image</button></div>:<span>{visible?'Loading image…':'Image'}</span>}{source&&previewOpen&&<ImagePreview source={source} name={file.name} onClose={()=>setPreviewOpen(false)}/>}</div>;
}
export default function Attachments({value,entryId,connection,token,onChange,onBusyChange}:{value:Attachment[];entryId:string;connection:Connection;token?:string;onChange:(files:Attachment[])=>void;onBusyChange:(busy:boolean)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<string|null>(null);
  const [dragging,setDragging]=useState(false);
  const input=useRef<HTMLInputElement>(null),dragDepth=useRef(0),adding=useRef(false);
  async function add(files:FileList|null){
    if(adding.current||!files?.length)return;
    if(value.length+files.length>20){setError('An item can have up to 20 files.');return;}
    adding.current=true;
    setBusy(true);onBusyChange(true);setError('');
    let next=[...value];
    try{for(const file of Array.from(files)){const metadata=await stageFile(file,entryId);next=[...next,metadata];onChange(next);}}
    catch(e){setError(e instanceof Error?e.message:'Could not attach file.');}
    finally{adding.current=false;setBusy(false);onBusyChange(false);}
  }
  return <div className="attachments-editor">
    <div className={`attachment-drop-zone${dragging&&!busy?' is-dragging':''}`} aria-busy={busy}
      onDragEnter={event=>{event.preventDefault();event.stopPropagation();if(event.dataTransfer.types.includes('Files')){dragDepth.current++;setDragging(true);}}}
      onDragOver={event=>{event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=busy?'none':'copy';}}
      onDragLeave={event=>{event.preventDefault();event.stopPropagation();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}}
      onDrop={event=>{event.preventDefault();event.stopPropagation();dragDepth.current=0;setDragging(false);void add(event.dataTransfer.files);}}>
      <button type="button" className="attachment-drop-button" disabled={busy} onClick={()=>input.current?.click()}>
        {busy?'Saving files…':dragging?'Drop files here':'Drop files here or click to browse'}
      </button>
      <input ref={input} aria-label="Attach files" type="file" multiple hidden disabled={busy} onChange={event=>{void add(event.target.files);event.target.value='';}}/>
    </div>
    <p className="hint">Up to 20 files, 2 MB each. File contents load only when needed.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    {busy&&<p role="status">Saving files on this device…</p>}
    {value.map(file=><div className="attachment-file" key={file.id}>
      <div className="attachment-file-heading"><strong>📎 {file.name}</strong><span>{Math.ceil(file.size/1024)} KB</span></div>
      <div className="attachment-file-actions">{isPreviewImage(file)&&<button className="secondary" type="button" onClick={()=>setPreview(preview===file.id?null:file.id)}>{preview===file.id?'Hide image':'View image'}</button>}
      <button type="button" className="secondary" onClick={()=>downloadFile(file,entryId,connection,token).catch(e=>setError(e.message))}>Download</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>onChange(value.filter(f=>f.id!==file.id))}>Remove file</button></div>
      {preview===file.id&&<AttachmentImage file={file} entryId={entryId} connection={connection} token={token}/>}
    </div>)}
  </div>;
}
