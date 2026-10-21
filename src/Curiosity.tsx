export default function Curiosity({attribute=false}:{attribute?:boolean}) {
  return (
    <span className="curious-cue" aria-hidden="true">
      {attribute?<><span className="attribute-asleep">{'\u{1F441}\uFE0F'}</span><span className="attribute-awake">{'\u{1F648}'}</span></>:<span className="curious-eyes">✏️</span>}
      <span className="curious-question">❓</span>
    </span>
  );
}
