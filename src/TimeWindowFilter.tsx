import type {TimeWindow} from './time-window';
import {periodKind,periodRange} from './domain';
import {viewTitle} from './view-title';
export default function TimeWindowFilter({value,onChange,label,anchor,today,onMove}:{value:TimeWindow;onChange:(value:TimeWindow)=>void;label:string;anchor:string;today:string;onMove:(direction:number)=>void}) {
  const range=periodRange(value==='All'?'Today':value,anchor);
  return <div className="time-window" role="group" aria-label={`${label} time window`}>
    <select aria-label={`${label} time window`} value={value==='All'?'All':periodKind(value)} onChange={event=>onChange(event.target.value as TimeWindow)}><option value="All">All</option><option value="Today">Day</option><option value="This Week">Week</option><option value="This Month">Month</option></select>
    {value!=='All'&&<><button type="button" className="secondary" aria-label={`Previous ${label} period`} disabled={range.from<='1900-01-01'} onClick={()=>onMove(-1)}>&#8249;</button><button type="button" className="secondary" aria-label={`Next ${label} period`} disabled={range.to>='2200-12-31'} onClick={()=>onMove(1)}>&#8250;</button></>}
    <span className="view-title">{viewTitle(value,anchor,today)}</span>
  </div>;
}
