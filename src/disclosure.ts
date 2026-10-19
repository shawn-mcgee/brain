const running = new WeakMap<
  HTMLDetailsElement,
  { animation: Animation; expanded: boolean }
>();
export function toggleDisclosure(details: HTMLDetailsElement) {
  const summary = details.querySelector("summary");
  if (!summary) return;
  const previous = running.get(details);
  const expanded = !(previous?.expanded ?? details.open);
  const from = details.getBoundingClientRect().height;
  previous?.animation.cancel();
  running.delete(details);
  details.style.height = "";
  details.style.overflow = "";
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof details.animate !== "function"
  ) {
    details.open = expanded;
    return;
  }
  // Keep native details semantics, but leave the content present until a closing
  // animation finishes. Measure real heights so long and changing forms fit.
  details.open = true;
  const to = expanded
    ? details.getBoundingClientRect().height
    : summary.getBoundingClientRect().height +
      details.offsetHeight -
      details.clientHeight;
  details.style.height = `${from}px`;
  details.style.overflow = "hidden";
  const animation = details.animate(
    [{ height: `${from}px` }, { height: `${to}px` }],
    { duration: 220, easing: "cubic-bezier(.2,.7,.3,1)" },
  );
  running.set(details, { animation, expanded });
  animation.onfinish = () => {
    if (running.get(details)?.animation !== animation) return;
    details.open = expanded;
    details.style.height = "";
    details.style.overflow = "";
    running.delete(details);
  };
}
