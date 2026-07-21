// @ts-nocheck — mechanical port from the single-file build; typing is a follow-up pass
export function rnd(a, b) { return a + Math.random() * (b - a); }
export function ri(a, b) { return Math.floor(rnd(a, b + 1)); }

export function todayStr() { return new Date().toLocaleDateString("en-CA"); }

export function fmtWhen(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
