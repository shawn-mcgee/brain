import { periodRange } from './domain.ts';
import type { BoardItem } from './board-model.ts';
export function calendarWindow(item:BoardItem,today:string) {
  const period=item.calendarPeriod||'month';
  const anchor=item.calendarDynamic!==false?today:item.calendarDate||today;
  return {period,anchor,...periodRange(period==='day'?'Today':period==='week'?'This Week':'This Month',anchor)};
}
