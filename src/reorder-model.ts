export function moveItem<T>(items:readonly T[],from:number,to:number):T[] {
  const result=[...items];
  if(from<0||from>=items.length||to<0||to>=items.length||from===to)return result;
  result.splice(to,0,result.splice(from,1)[0]);
  return result;
}

// Keep saved ordering when combining a reorder with edits from another browser.
export function mergedOrder(base:string[],local:string[],remote:string[],ids:string[]):string[] {
  const changed=(order:string[])=>{
    const surviving=new Set(order);
    return JSON.stringify(order.filter(id=>base.includes(id)))!==JSON.stringify(base.filter(id=>surviving.has(id)));
  };
  const preferred=changed(local)?local:changed(remote)?remote:JSON.stringify(local)!==JSON.stringify(base)?local:remote;
  const present=new Set(ids);
  return [...new Set([...preferred,...local,...remote,...ids])].filter(id=>present.has(id));
}
