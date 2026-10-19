import type { Entry } from "./domain.ts";
const themes = {
  money: ["🪙", "💵", "🧾", "💰"],
  chores: ["🧹", "🫧", "🧽", "✨"],
  food: ["🥕", "🍎", "🥦", "🛒"],
  garden: ["🌱", "🍃", "🌼", "🌻"],
  pets: ["🐾", "🦴", "🐟", "💛"],
  exercise: ["👟", "💪", "🏃", "⭐"],
  study: ["📚", "✏️", "📝", "🎓"],
  general: ["⭐", "✨", "🎉", "✅"],
};
export function taskTheme(entry: Entry): keyof typeof themes {
  const text = entry.note.toLowerCase();
  if (
    entry.budgetType ||
    entry.transactionType ||
    /\b(budget|pay|bill|bills|bank|rent|tax|taxes|save|savings|invoice|mortgage|money)\b/.test(
      text,
    )
  )
    return "money";
  if (/\b(garden|plant|plants|water|mow|lawn|yard|flowers)\b/.test(text))
    return "garden";
  if (/\b(dog|cat|pet|pets|vet|litter|puppy|kitten)\b/.test(text))
    return "pets";
  if (
    /\b(clean|cleaning|tidy|wash|laundry|vacuum|sweep|mop|dishes|chores|trash|recycling|dust)\b/.test(
      text,
    )
  )
    return "chores";
  if (
    /\b(groceries|grocery|cook|cooking|dinner|lunch|breakfast|meal|food|bake|shopping)\b/.test(
      text,
    )
  )
    return "food";
  if (/\b(exercise|gym|run|running|walk|workout|yoga|swim|bike)\b/.test(text))
    return "exercise";
  if (
    /\b(homework|study|read|reading|school|learn|exam|class|book)\b/.test(text)
  )
    return "study";
  return "general";
}
export function taskParticles(
  entry: Entry,
  random: () => number = Math.random,
) {
  const choices = themes[taskTheme(entry)];
  return Array.from({ length: 12 }, () => ({
    glyph:
      choices[
        Math.min(choices.length - 1, Math.floor(random() * choices.length))
      ],
    x: (random() - 0.5) * 220,
    y: -50 - random() * 110,
    rotation: (random() - 0.5) * 110,
    delay: random() * 120,
  }));
}
