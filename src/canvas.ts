// @ts-nocheck — mechanical port from the single-file build; typing is a follow-up pass
import { S } from "./state";

// deep-sea expansion: each purchased layer extends the tank downward
export const W = 192, BASE_H = 120, BASE_SAND = 108, LAYER_H = 15, MAX_DEPTH = 2;
S.tankDepth = 0;
try {
  const s0 = JSON.parse(localStorage.getItem("cyber-fish-tank-save"));
  S.tankDepth = Math.min(MAX_DEPTH, Math.max(0, (s0 && s0.depth) | 0));
} catch (e) {}
S.H = BASE_H + S.tankDepth * LAYER_H, S.SAND_Y = BASE_SAND + S.tankDepth * LAYER_H;
export const cv = document.getElementById("tank");
cv.height = S.H;
export const cx = cv.getContext("2d");
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
