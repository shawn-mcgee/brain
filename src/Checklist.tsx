import ReorderableItems from './ReorderableItems';
import {useState} from 'react';
import type {Entry} from './domain';
import {assertCanComplete,checklistDate,listItemDone,reconcileList,setListItemDone} from './checklist-model';
import {isDone} from './domain';
import InlineText from './InlineText';

export default function Checklist({entry,entries,date,onChange,editable=false,disabled=false,inline=false}:{entry:Entry;entries:Entry[];date?:string;onChange:(entry:Entry)=>void;editable?:boolean;disabled?:boolean;inline?:boolean}){
  const [text,setText]=useState(''),[error,setError]=useState('');
  function commit(next:Entry){
    try{if(next.task&&isDone(next,date||next.beginsOn||next.endsOn)&&!isDone(entry,date||entry.beginsOn||entry.endsOn))assertCanComplete(next,entries,date);setError('');onChange(next);}catch(cause){setError(cause instanceof Error?cause.message:'Could not update list.');}
  }
  function add(){if(!text.trim()||entry.list.length>=200)return;commit(reconcileList({...entry,list:[...entry.list,{id:crypto.randomUUID(),text:text.trim(),completed:false,completedDates:entry.repeat?entry.completedDates.filter(day=>day!==checklistDate(entry,date)):[]}]}));setText('');}
  return <div className="item-checklist" role="group" aria-label={`${entry.name||'Thought'} list`}>
    <ReorderableItems items={entry.list} itemKey={line=>line.id} label={line=>line.text} disabled={disabled} onChange={list=>commit({...entry,list})}>{(line,_index,grip)=><div className="checklist-line">
      {grip}
      <input type="checkbox" aria-label={line.text} checked={listItemDone(entry,line,date)} disabled={disabled} onChange={event=>commit(setListItemDone(entry,line.id,event.target.checked,date))}/>
      {editable?inline?<InlineText label="Edit list line" value={line.text} maxLength={1000} required className={listItemDone(entry,line,date)?'is-complete':''} onCommit={text=>onChange({...entry,list:entry.list.map(item=>item.id===line.id?{...item,text}:item)})}/>:<input aria-label="List line text" value={line.text} maxLength={1000} onChange={event=>onChange({...entry,list:entry.list.map(item=>item.id===line.id?{...item,text:event.target.value}:item)})}/>:<span className={listItemDone(entry,line,date)?'is-complete':''}>{line.text}</span>}
      {editable&&<button type="button" aria-label={`Remove ${line.text}`} onClick={()=>commit(reconcileList({...entry,list:entry.list.filter(item=>item.id!==line.id)}))}>✖️</button>}
    </div>}</ReorderableItems>
    {editable&&<div className="checklist-add"><input aria-label="New list line" placeholder="Add a list line" maxLength={1000} value={text} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();add();}}}/><button type="button" disabled={!text.trim()||entry.list.length>=200} onClick={add}>Add</button></div>}
    {error&&<p role="alert" className="error">{error}</p>}
  </div>;
}
