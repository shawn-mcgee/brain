import {useRef,useState} from 'react';

export default function InlineText({value,onCommit,label,placeholder='Add text…',className='',multiline=false,required=false,maxLength=10000}:{value:string;onCommit:(value:string)=>void;label:string;placeholder?:string;className?:string;multiline?:boolean;required?:boolean;maxLength?:number}){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value);
  const finished=useRef(false);
  function finish(cancel=false){
    if(finished.current)return;finished.current=true;
    const next=draft.trim();
    if(!cancel&&(!required||next)&&next!==value)onCommit(next);
    setEditing(false);
  }
  const properties={autoFocus:true,'aria-label':label,value:draft,maxLength,className:`board-inline-input ${className}`,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setDraft(event.target.value),onBlur:()=>finish(),onKeyDown:(event:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    if(event.nativeEvent.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true);}
    else if(event.key==='Enter'&&(!multiline||event.ctrlKey||event.metaKey)){event.preventDefault();finish();}
  }};
  return editing?multiline?<textarea {...properties} rows={Math.max(2,Math.min(8,draft.split('\n').length))}/>:<input {...properties} onFocus={event=>event.target.select()}/>:<button type="button" className={`board-inline-text ${className}${!value?' is-placeholder':''}`} aria-label={label} title="Click to edit" onClick={()=>{finished.current=false;setDraft(value);setEditing(true);}}>{value||placeholder}</button>;
}
