import {daysBetween,parseDate,periodRange,periodKind} from './domain.ts';
import type {Period} from './domain.ts';
export function viewTitle(period:Period|'All',anchor:string,today:string):string {
  if(period==='All')return 'All thoughts';
  const kind=periodKind(period),range=periodRange(kind,anchor),now=periodRange(kind,today);
  const day=(date:string)=>parseDate(date).toLocaleDateString('en-US',{month:'long',day:'numeric',...(date.slice(0,4)!==today.slice(0,4)?{year:'numeric' as const}:{})});
  const suffix=(n:number,unit:string)=>` (${Math.abs(n)} ${unit}${Math.abs(n)===1?'':'s'} ${n<0?'Ago':'From Now'})`;
  if(kind==='Today'){const diff=daysBetween(today,anchor);return diff===0?`Today, ${day(anchor)}`:diff===-1?`Yesterday, ${day(anchor)}`:diff===1?`Tomorrow, ${day(anchor)}`:day(anchor)+suffix(diff,'Day');}
  if(kind==='This Week'){const diff=daysBetween(now.from,range.from)/7;return `${diff===0?'This ':diff===-1?'Last ':diff===1?'Next ':''}Week of ${day(range.from)}${Math.abs(diff)>1?suffix(diff,'Week'):''}`;}
  const a=parseDate(range.from),b=parseDate(now.from),diff=(a.getFullYear()-b.getFullYear())*12+a.getMonth()-b.getMonth();
  const month=a.toLocaleDateString('en-US',{month:'long',...(a.getFullYear()!==b.getFullYear()?{year:'numeric' as const}:{})});
  return `${diff===0?'This ':diff===-1?'Last ':diff===1?'Next ':''}Month of ${month}${Math.abs(diff)>1?suffix(diff,'Month'):''}`;
}
