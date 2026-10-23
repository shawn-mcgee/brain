import ReorderableItems from './ReorderableItems';
import {useEffect,useId,useState} from 'react';
import type {ReactNode} from 'react';
import {isHttpLink,validateLinks,youtubeEmbedUrl} from './links-model';

function CopyLink({link,index}:{link:string;index:number}) {
  const [status,setStatus]=useState<'idle'|'copied'|'error'>('idle');
  useEffect(()=>{
    if(status==='idle')return;
    const timeout=setTimeout(()=>setStatus('idle'),2000);
    return()=>clearTimeout(timeout);
  },[status]);
  const message=status==='copied'?'Link copied':status==='error'?'Could not copy link. Try again.':`Copy link ${index+1}`;
  return <>
    <button type="button" className="secondary link-copy-button" aria-label={message} title={message} disabled={!isHttpLink(link)} onClick={async event=>{
      event.stopPropagation();
      try{await navigator.clipboard.writeText(link);setStatus('copied');}
      catch{setStatus('error');}
    }}><span aria-hidden="true">{status==='copied'?'\u2705':status==='error'?'\u2757':'\u{1F4CB}'}</span></button>
    <span className="screen-reader-only" role="status">{status==='idle'?'':message}</span>
  </>;
}

function LinkItem({link,index,row}:{link:string;index:number;row:(toggle:ReactNode,copy:ReactNode)=>ReactNode}) {
  const embed=youtubeEmbedUrl(link);
  const [shownEmbed,setShownEmbed]=useState<string|null>(null);
  const expanded=!!embed&&shownEmbed===embed;
  const contentId=useId();
  const toggle=embed?<button type="button" className="secondary link-embed-toggle" aria-expanded={expanded} aria-controls={contentId} aria-label={`${expanded?'Hide':'Show'} video ${index+1}`} title={expanded?'Hide video':'Show video'} onClick={()=>setShownEmbed(expanded?null:embed)}>
    <span aria-hidden="true">{expanded?'\u{1F648}':'\u{1F441}\uFE0F'}</span>
  </button>:null;
  return <div className="thought-link">
    <div className="link-line">{row(toggle,<CopyLink link={link} index={index}/>)}</div>
    {embed&&<div id={contentId} hidden={!expanded}>
      {expanded&&<iframe src={embed} title={`YouTube video ${index+1}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>}
    </div>}
  </div>;
}

export default function ThoughtLinks({links,onChange,disabled=false}:{links:string[];onChange?:(links:string[])=>void;disabled?:boolean}) {
  const valid=links.filter(isHttpLink);
  if(!valid.length)return null;
  const items=valid.map((link,index)=>({link,id:`${link}:${valid.slice(0,index).filter(value=>value===link).length}`}));
  return <div className="thought-links" aria-label="Thought links">
    <ReorderableItems items={items} itemKey={item=>item.id} label={(_item,index)=>`link ${index+1}`} disabled={disabled} onChange={onChange?items=>onChange(items.map(item=>item.link)):undefined}>{(item,index,grip)=>
      <LinkItem link={item.link} index={index} row={(toggle,copy)=><>
          {grip}{copy}{toggle}<a className="thought-link-open" href={item.link} target="_blank" rel="noopener noreferrer" title={`${item.link} (opens in a new tab)`}>
            <span className="thought-link-copy"><span>{item.link}</span><small>Opens in a new tab</small></span>
            <span className="thought-link-launch curious-cue" aria-hidden="true"><span className="curious-eyes">{'\u2197\uFE0F'}</span><span className="curious-question">{'\u2754'}</span></span>
          </a>
      </>}/>
    }</ReorderableItems>
  </div>;
}
export function LinksEditor({value,onChange}:{value:string[];onChange:(links:string[])=>void}) {
  const [text,setText]=useState(''),[error,setError]=useState('');
  const [ids,setIds]=useState(()=>value.map(()=>crypto.randomUUID()));
  const items=value.map((link,index)=>({link,id:ids[index]}));
  function update(next:typeof items){setIds(next.map(item=>item.id));onChange(next.map(item=>item.link));}
  function add(){
    const link=text.trim();
    if(!link||value.length>=20)return;
    const issue=validateLinks([link]);
    if(issue){setError('Enter a valid HTTP or HTTPS link.');return;}
    update([{link,id:crypto.randomUUID()},...items]);setText('');setError('');
  }
  return <div className="links-editor">
    <div className="link-add">
      <input type="url" aria-label="New link" placeholder="https://example.com" maxLength={2000} value={text} disabled={value.length>=20} onChange={event=>{setText(event.target.value);setError('');}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();add();}}}/>
      <button type="button" className="secondary" disabled={!text.trim()||value.length>=20} onClick={add}>Add link</button>
    </div>
    <p className="hint">Up to 20 web links. Expand a YouTube link to watch its video.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    <ReorderableItems items={items} itemKey={item=>item.id} label={(_item,index)=>`link ${index+1}`} onChange={update}>{({link,id},index,grip)=><LinkItem link={link} index={index} row={(toggle,copy)=><>
        {grip}{copy}{toggle}
        <input type="url" required maxLength={2000} aria-label={`Link ${index+1}`} value={link} onChange={event=>update(items.map(item=>item.id===id?{...item,link:event.target.value}:item))} onBlur={()=>{const trimmed=link.trim();if(trimmed!==link)update(items.map(item=>item.id===id?{...item,link:trimmed}:item));}}/>
    </>}/>}</ReorderableItems>

  </div>;
}
