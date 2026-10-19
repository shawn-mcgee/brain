export function attributeSuggestion(text:string,options:string[],multiple=false):string {
  const start=multiple?text.lastIndexOf(',')+1:0;
  const token=text.slice(start).trimStart();
  if(!token)return '';
  const used=multiple?text.slice(0,start).split(',').map(value=>value.trim().toLowerCase()):[];
  const match=options.find(option=>option.toLowerCase().startsWith(token.toLowerCase())&&!used.includes(option.toLowerCase()));
  // Exact matches are already accepted; preserve the user's spelling and spacing.
  return match&&match.length>token.length?text+match.slice(token.length):'';
}
