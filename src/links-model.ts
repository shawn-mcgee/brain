// Only web URLs may be rendered as anchors. Keep this check in sync with Code.gs.
export function isHttpLink(value:unknown):value is string {
  return typeof value==='string'&&/^https?:\/\/(?:\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::\d{1,5})?(?:[/?#][^\s\\]*)?$/i.test(value);
}
export function validateLinks(links:unknown):string {
  return !Array.isArray(links)||links.length>20||links.some(link=>!isHttpLink(link)||link.length>2000)
    ?'Use up to 20 valid HTTP or HTTPS links (2,000 characters each).':'';
}
export function youtubeEmbedUrl(value:string):string|null {
  if(!isHttpLink(value))return null;
  let url:URL;
  try{url=new URL(value);}catch{return null;}
  if(url.port)return null;
  const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
  let id:string|null=null;
  if(['youtu.be','www.youtu.be'].includes(host)&&parts.length===1)id=parts[0];
  if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
    if(url.pathname==='/watch')id=url.searchParams.get('v');
    else if(['embed','shorts','live'].includes(parts[0])&&parts.length===2)id=parts[1];
  }
  if(!id||!/^[-\w]{11}$/.test(id))return null;
  const embed=new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  const start=url.searchParams.get('start')||url.searchParams.get('t')||new URLSearchParams(url.hash.slice(1)).get('t')||'';
  const duration=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(start);
  const seconds=/^\d+$/.test(start)?Number(start):duration?Number(duration[1]||0)*3600+Number(duration[2]||0)*60+Number(duration[3]||0):0;
  if(Number.isSafeInteger(seconds)&&seconds>0)embed.searchParams.set('start',String(seconds));
  return embed.href;
}
