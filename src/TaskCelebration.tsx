import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { taskParticles } from "./personality";
export type Celebration = {
  id: string;
  entryId: string;
  date?: string;
  x: number;
  y: number;
  particles: ReturnType<typeof taskParticles>;
};
export default function TaskCelebration({
  celebration,
  onFinish,
}: {
  celebration: Celebration;
  onFinish: () => void;
}) {
  const finish = useRef(onFinish);
  finish.current = onFinish;
  useEffect(() => {
    const timer = window.setTimeout(() => finish.current(), 1400);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className="particle-burst"
      style={{ left: celebration.x, top: celebration.y }}
    >
      <span className="completion-stamp">✅</span>
      <span className="completion-label">Done!</span>
      {celebration.particles.map((particle, index) => (
        <span
          key={index}
          className="task-particle"
          style={
            {
              "--particle-x": `${particle.x}px`,
              "--particle-y": `${particle.y}px`,
              "--particle-rotation": `${particle.rotation}deg`,
              animationDelay: `${particle.delay}ms`,
            } as CSSProperties
          }
        >
          {particle.glyph}
        </span>
      ))}
    </div>
  );
}
