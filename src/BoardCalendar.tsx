import { useEffect, useMemo, useState } from 'react';
import { addDays, dateKey, occurrences, parseDate, shiftPeriod } from './domain';
import type { Entry } from './domain';
import { calendarWindow } from './calendar-model';
import type { BoardItem } from './board-model';

const shortDate=(date:string)=>parseDate(date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});

export default function BoardCalendar({item,entries,onUpdate,onEdit}:{item:BoardItem;entries:Entry[];onUpdate:(patch:Partial<BoardItem>)=>void;onEdit:(entry:Entry)=>void}) {
  const [today,setToday]=useState(()=>dateKey(new Date()));
  useEffect(()=>{const refresh=()=>setToday(dateKey(new Date()));const timer=window.setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[]);
  const range=useMemo(()=>calendarWindow(item,today),[item,today]);
  const [picked,setPicked]=useState<string|null>(null);
  const selected=picked&&picked>=range.from&&picked<=range.to?picked:range.anchor;
  const {from,to}=range;
  const events=useMemo(()=>entries.filter(entry=>!entry.transactionType).flatMap(entry=>occurrences(entry,from,to)),[entries,from,to]);
  const agenda=events.filter(event=>event.start<=selected&&event.end>=selected);
  const start=range.period==='month'?addDays(range.from,-parseDate(range.from).getDay()):range.from;
  const count=range.period==='month'?42:7;
  const navigate=(direction:number)=>{
    const date=shiftPeriod(range.period==='day'?'Today':range.period==='week'?'This Week':'This Month',range.anchor,direction);
    if(date<'1900-01-01'||date>'2200-12-31')return;
    setPicked(null);onUpdate({calendarDate:date,calendarDynamic:false});
  };
  return <div className="board-calendar">
    <div className="board-calendar-options">
      <select aria-label="Calendar period" value={range.period} onChange={event=>{setPicked(null);onUpdate({calendarPeriod:event.target.value as 'day'|'week'|'month'})}}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select>
      <select aria-label="Calendar follows today" value={item.calendarDynamic===false?'fixed':'current'} onChange={event=>{setPicked(null);onUpdate({calendarDynamic:event.target.value==='current',calendarDate:range.anchor})}}><option value="current">Current</option><option value="fixed">Fixed date</option></select>
      {item.calendarDynamic===false&&<input aria-label="Calendar date" type="date" min="1900-01-01" max="2200-12-31" value={range.anchor} onChange={event=>{if(event.target.value&&event.target.validity.valid){setPicked(null);onUpdate({calendarDate:event.target.value})}}}/>}
    </div>
    <div className="board-calendar-title"><button type="button" aria-label="Previous period" disabled={range.from<='1900-01-01'} onClick={()=>navigate(-1)}>‹</button><strong>{range.period==='month'?parseDate(range.from).toLocaleDateString(undefined,{month:'long',year:'numeric'}):range.period==='week'?`${shortDate(range.from)} – ${shortDate(range.to)}`:shortDate(range.anchor)}</strong><button type="button" aria-label="Next period" disabled={range.to>='2200-12-31'} onClick={()=>navigate(1)}>›</button></div>
    {range.period!=='day'&&<div className={`board-calendar-grid ${range.period}`}>
      {['S','M','T','W','T','F','S'].map((day,index)=><span key={index}>{day}</span>)}
      {Array.from({length:count},(_,index)=>{const date=addDays(start,index),inRange=date>=range.from&&date<=range.to,items=events.filter(event=>event.start<=date&&event.end>=date);return <button key={date} type="button" disabled={!inRange} aria-label={`${shortDate(date)}: ${items.length} thoughts`} aria-pressed={selected===date} className={`${!inRange?'outside':''} ${date===today?'is-today':''}`} onClick={()=>setPicked(date)}>{parseDate(date).getDate()}{items.length>0&&<small aria-hidden="true">●</small>}</button>})}
    </div>}
    <div className="board-day-items"><strong>{shortDate(selected)}</strong>{agenda.length?agenda.map(event=><div key={event.key} className={`board-agenda-entry ${event.entry.color?`item-colored board-${event.entry.color}`:''}`}><div className="board-agenda-text"><small>{event.entry.beginsAt||event.entry.endsAt||'All day'}</small>{event.entry.name}</div><button type="button" className="board-agenda-edit" title="Edit thought" aria-label={`Edit ${event.entry.name}`} onClick={()=>onEdit(event.entry)}><span aria-hidden="true">{'\u270F\uFE0F'}</span></button></div>):<p>No thoughts.</p>}</div>
  </div>;
}
