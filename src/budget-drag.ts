import type {BudgetMove} from './budget-order';

export type BudgetSlot={id:string;top:number;height:number};

export function budgetDrop(slots:BudgetSlot[],y:number):{target:string;after:boolean}|null {
  if(!slots.length)return null;
  const target=slots.find(slot=>y<slot.top+slot.height)||slots[slots.length-1];
  return {target:target.id,after:y>target.top+target.height/2};
}

// Preview with transforms while the native drag keeps its original DOM nodes.
export function budgetDragOffsets(slots:BudgetSlot[],move:BudgetMove):Map<string,number> {
  const ordered=[...slots],from=ordered.findIndex(slot=>slot.id===move.source);
  if(from<0||move.source===move.target||!ordered.some(slot=>slot.id===move.target))return new Map();
  const [source]=ordered.splice(from,1);
  ordered.splice(ordered.findIndex(slot=>slot.id===move.target)+(move.after?1:0),0,source);
  const gaps=slots.slice(1).map((slot,index)=>slot.top-slots[index].top-slots[index].height);
  let top=slots[0].top;
  return new Map(ordered.map((slot,index)=>{
    const offset=top-slot.top;
    top+=slot.height+(gaps[index]||0);
    return [slot.id,offset];
  }));
}
