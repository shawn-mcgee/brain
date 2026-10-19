export default function Curiosity({attribute=false}:{attribute?:boolean}) {
  return (
    <span className="curious-cue" aria-hidden="true">
      {attribute?<><span className="attribute-asleep">🙈 💤</span><span className="attribute-awake">🐵 👀</span></>:<><span className="curious-eyes">✏️</span><span className="curious-question">❓</span></>}
    </span>
  );
}
