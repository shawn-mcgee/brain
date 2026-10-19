import { changeWindowScope, windowParts, windowValue } from "./time-window";
import type { TimeWindow, WindowScope, WindowUnit } from "./time-window";
export default function TimeWindowFilter({
  value,
  onChange,
  label,
}: {
  value: TimeWindow;
  onChange: (value: TimeWindow) => void;
  label: string;
}) {
  const { scope, unit } = windowParts(value);
  const singleDay = unit === "day";
  return (
    <div
      className="time-window"
      role="group"
      aria-label={`${label} time window`}
    >
      <span>View</span>
      <select
        aria-label={`${label} time window`}
        value={singleDay ? value : scope}
        onChange={(event) => {
          const selected = event.target.value;
          if (["Today", "Yesterday", "Tomorrow"].includes(selected))
            onChange(selected as TimeWindow);
          else onChange(changeWindowScope(value, selected as WindowScope));
        }}
      >
        <option value="everything">everything</option>
        <option value="this">this</option>
        <option value="last">last</option>
        <option value="next">next</option>
        {singleDay && (
          <>
            <option value="Today">today</option>
            <option value="Yesterday">yesterday</option>
            <option value="Tomorrow">tomorrow</option>
          </>
        )}
      </select>
      {unit && !singleDay && (
        <select
          aria-label={`${label} time unit`}
          value={unit}
          onChange={(event) =>
            onChange(windowValue(scope, event.target.value as WindowUnit))
          }
        >
          <option value="day">day</option>
          <option value="week">week</option>
          <option value="month">month</option>
        </select>
      )}
    </div>
  );
}
