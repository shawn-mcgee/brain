export default function LocationLinks({where}:{where:string}) {
  if(!where.trim())return null;
  const destination=encodeURIComponent(where.trim());
  return <div className="location-links">
    <a href={`https://www.google.com/maps/search/?api=1&query=${destination}`} target="_blank" rel="noopener noreferrer" aria-label="Open in Maps" title="Open in Maps"><span aria-hidden="true">🗺️</span></a>
    <a href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`} target="_blank" rel="noopener noreferrer" aria-label="Directions from here" title="Directions from here"><span aria-hidden="true">🧭</span></a>
  </div>;
}
