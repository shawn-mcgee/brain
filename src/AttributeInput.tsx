import {useId,useState} from 'react';
import {attributeSuggestion} from './attribute-suggestion';
export default function AttributeInput({value,options,onChange,label,multiple=false}:{value:string|string[];options:string[];onChange:(value:string)=>void;label:string;multiple?:boolean}) {
  const id=useId(),[text,setText]=useState(Array.isArray(value)?value.join(', '):value);
  const [focused,setFocused]=useState(false),[atEnd,setAtEnd]=useState(true),[scroll,setScroll]=useState(0),[composing,setComposing]=useState(false);
  const suggestion=focused&&atEnd&&!composing?attributeSuggestion(text,options,multiple):'';
  return <div className="attribute-autocomplete">
    <div className="attribute-ghost" aria-hidden="true"><span style={{transform:`translateX(${-scroll}px)`}}><span className="attribute-ghost-prefix">{text}</span>{suggestion.slice(text.length)}</span></div>
    <input aria-label={label} aria-autocomplete="inline" aria-describedby={suggestion?id:undefined} autoComplete="off" value={text}
      onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
      onSelect={event=>setAtEnd(event.currentTarget.selectionStart===text.length&&event.currentTarget.selectionEnd===text.length)}
      onScroll={event=>setScroll(event.currentTarget.scrollLeft)}
      onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)}
      onChange={event=>{setText(event.target.value);onChange(event.target.value)}}
      onKeyDown={event=>{
        if(event.key==='Tab'&&!event.shiftKey&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.nativeEvent.isComposing&&suggestion) {
          event.preventDefault();setText(suggestion);onChange(suggestion);
        }
      }}/>
    <span id={id} className="attribute-suggestion-accessible" role="status">{suggestion?`Suggestion: ${suggestion}. Press Tab to accept.`:''}</span>
  </div>;
}
