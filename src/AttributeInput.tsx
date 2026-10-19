import {useId,useState} from 'react';
export default function AttributeInput({value,options,onChange,label,multiple=false}:{value:string|string[];options:string[];onChange:(value:string)=>void;label:string;multiple?:boolean}) {
  const id=useId(),[text,setText]=useState(Array.isArray(value)?value.join(', '):value);
  const split=text.lastIndexOf(','),prefix=multiple&&split>=0?text.slice(0,split+1)+' ':'';
  const token=multiple?text.slice(split+1).trim():text;
  return <><input aria-label={label} value={text} list={id} onChange={event=>{setText(event.target.value);onChange(event.target.value)}}/><datalist id={id}>{options.filter(option=>option.toLowerCase().includes(token.toLowerCase())).map(option=><option key={option} value={prefix+option}/>)}</datalist></>;
}
