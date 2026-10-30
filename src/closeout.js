// Month close-out: a closed month is the engine's `locked` (completed) month, plus an optional lesson.
export const NOTE_MAX = 1000;
/** A month has ended once the first day of the following month has arrived. */
export const monthEnded = (year, index, today = new Date()) => today.getFullYear() * 12 + today.getMonth() > year * 12 + index;
/** Ended, still-open months in order, as {year, month}. */
export function pendingMonths(state, today = new Date()) {
  const out = [];
  for (const y of state.years) y.months.forEach((m, month) => { if (!m.locked && monthEnded(y.year, month, today)) out.push({ year: y.year, month }); });
  return out;
}
export function closeMonth(state, year, index, note = '', today = new Date()) {
  const row = state.years.find(y => y.year === year)?.months[index];
  if (!row) throw new Error('That month is not in your plan.');
  if (!monthEnded(year, index, today)) throw new Error('You can close this month after it ends.');
  if (row.locked) throw new Error('This month is already closed.');
  const text = String(note || '').trim();
  if (text.length > NOTE_MAX) throw new Error(`Keep the note under ${NOTE_MAX} characters.`);
  row.locked = true;
  state.lessons ??= [];
  if (text) state.lessons.push({ id: crypto.randomUUID(), year, month: index, at: today.toISOString(), note: text });
}
/** Newest first. */
export const sortedLessons = state => (state.lessons || []).map((l, i) => ({ ...l, i })).sort((a, b) => b.at.localeCompare(a.at) || b.i - a.i);
