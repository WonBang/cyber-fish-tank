// fish color palettes and name pool — pure data

export const FISH_PALETTES = [
  { b: "#3dff8b", d: "#1fae5c", f: "#17d96b" },  // phosphor green
  { b: "#46d8ff", d: "#1f8fb8", f: "#7ae6ff" },  // cyan
  { b: "#ffb454", d: "#c47816", f: "#ffd27a" },  // amber
  { b: "#ff6b9d", d: "#c23f6e", f: "#ff9dc0" },  // coral pink
  { b: "#b18cff", d: "#7a5cc4", f: "#d0baff" },  // violet
  { b: "#ff5c5c", d: "#b83030", f: "#ffb454" },  // red, amber fin
  { b: "#38e8c8", d: "#1e9e86", f: "#a0ffe8" },  // seafoam
  { b: "#c8f04a", d: "#8aab24", f: "#e8ff9a" },  // lime
  { b: "#ff8c42", d: "#c2591c", f: "#46d8ff" },  // clownfish orange, cyan fin
  { b: "#7aa8ff", d: "#4a6fc2", f: "#ff6b9d" },  // ice blue, pink fin
  { b: "#f06ee6", d: "#b03aa8", f: "#7ae6ff" },  // magenta, cyan fin
  { b: "#e8e8f0", d: "#9a9ab0", f: "#ff5c5c" },  // koi silver, red fin
];

// ---------- shiny (변이) ----------
export const SHINY_RATE = 0.01; // base roll on every spawn path

// hand-tuned shiny palettes for species where hue rotation barely reads
// (near-white or near-black bodies); everything else rotates automatically
const SHINY_OVERRIDES = {
  beluga: { b: "#f6c2d8", d: "#d081a8", f: "#eda4c4" }, // pink beluga
  orca:   { b: "#e8eef4", d: "#3a4656", f: "#c8d4e0" }, // white orca
  zebra:  { b: "#e8eef4", d: "#d99b26", f: "#e8c878" }, // gold-striped danio
  molly:  { b: "#caa22e", d: "#8a6d1a", f: "#e2c464" }, // gold molly
  angler: { b: "#5c3a78", d: "#3c2452", f: "#4a2e64" }, // abyssal violet
  gulper: { b: "#5c2e50", d: "#3a1c34", f: "#744064" },
  icefish: { b: "#ffd9e8", d: "#d898b8", f: "#ffeef6" },
};

function hueShift(hex, deg = 150, satBoost = 0.12) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (h + deg / 360) % 1;
  s = Math.min(1, s + satBoost);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const ch = (t) => {
    t = ((t % 1) + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  const to = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return "#" + to(ch(h + 1 / 3)) + to(ch(h)) + to(ch(h - 1 / 3));
}

const shinyCache = new Map();
export function shinyPal(species, pal) {
  const key = species + ":" + pal.b;
  let p = shinyCache.get(key);
  if (!p) {
    p = SHINY_OVERRIDES[species] || { b: hueShift(pal.b), d: hueShift(pal.d), f: hueShift(pal.f) };
    shinyCache.set(key, p);
  }
  return p;
}

export const MIN_FISH = 7; // minimum non-crab population

export const NAMES = ["node","vim","rustc","gcc","cargo","docker","tmux","zsh","git","deno","curl","grep","nvim","make","ssh","jq"];
