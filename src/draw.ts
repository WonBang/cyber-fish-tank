// @ts-nocheck — mechanical port from the single-file build; typing is a follow-up pass
import { S } from "./state";
import { W, BASE_SAND, LAYER_H, cx, reduced } from "./canvas";
import { rnd } from "./utils";
import { SPRITES, JELLY_FRAMES, CRAB_FRAMES, SHARK_SPRITE, SHARK_PAL, EGG_ROWS, EGG_PALS, COIN_ROWS, COIN_COLORS } from "./sprites";
import { sandNoise, KELP_DAY, KELP_NIGHT, BUSH_DAY, BUSH_NIGHT, GLOW_CYCLE, isCrowned, RAID_WARN_MS, BOSS_HP, WOUND_SPOTS, JAIL, coins, CHEST } from "./game";

// ---------- drawing ----------
function px(x, y, c) { cx.fillStyle = c; cx.fillRect(x | 0, y | 0, 1, 1); }

const WATER_BANDS = ["#10233c", "#0d1d33", "#0a172a", "#081222", "#060d1a"];
const NIGHT_BANDS = ["#0a1228", "#08101f", "#060b18", "#040812", "#03050c"];
function drawWater() {
  const bands = S.night ? NIGHT_BANDS : WATER_BANDS;
  const bandH = S.SAND_Y / bands.length;
  for (let i = 0; i < bands.length; i++) {
    cx.fillStyle = bands[i];
    cx.fillRect(0, i * bandH | 0, W, Math.ceil(bandH) + 1);
  }
  // dither band seams
  cx.fillStyle = S.night ? "rgba(140,160,255,0.04)" : "rgba(70,216,255,0.05)";
  for (let i = 1; i < bands.length; i++) {
    const y = (i * bandH) | 0;
    for (let x = (i % 2); x < W; x += 2) cx.fillRect(x, y, 1, 1);
  }
  // surface shimmer
  cx.fillStyle = S.night ? "#12213d" : "#1e3d63";
  for (let x = 0; x < W; x += 2) {
    const o = Math.sin(S.t * 0.03 + x * 0.4) > 0.2 ? 0 : 1;
    cx.fillRect(x, o, 2, 1);
  }
  // deep-sea layers: darker the further below the original floor line
  if (S.SAND_Y > BASE_SAND) {
    for (let i = 0; i < S.tankDepth; i++) {
      cx.fillStyle = `rgba(2,8,18,${0.24 + i * 0.18})`;
      cx.fillRect(0, BASE_SAND + i * LAYER_H, W, LAYER_H);
    }
    // abyss plankton glimmer, day and S.night
    cx.fillStyle = "rgba(120,255,190,0.5)";
    const deep = S.SAND_Y - BASE_SAND;
    for (let i = 0; i < 5 * S.tankDepth; i++) {
      const gx = (i * 47 + Math.floor(S.t * 0.005) * (i + 2)) % W;
      const gy = BASE_SAND + 4 + (i * 29) % (deep - 8);
      if (Math.floor(S.t * 0.003 + i) % 3 === 0) cx.fillRect(gx, gy, 1, 1);
    }
  }
  if (S.night) {
    // single moonbeam
    cx.fillStyle = "rgba(180,200,255,0.05)";
    const rx = 96 + Math.sin(S.t * 0.002) * 10;
    cx.fillRect(rx | 0, 2, 10, Math.min(S.SAND_Y, BASE_SAND) - 2);
    // plankton glow specks
    cx.fillStyle = "rgba(120,255,190,0.5)";
    for (let i = 0; i < 8; i++) {
      const gx = (i * 53 + Math.floor(S.t * 0.006) * (i + 3)) % W;
      const gy = 10 + (i * 37) % (S.SAND_Y - 24);
      if (Math.floor(S.t * 0.004 + i) % 3 === 0) cx.fillRect(gx, gy, 1, 1);
    }
  } else {
    // light rays
    cx.fillStyle = "rgba(120,210,255,0.045)";
    for (let i = 0; i < 3; i++) {
      const rx = 30 + i * 58 + Math.sin(S.t * 0.004 + i * 2) * 6;
      cx.fillRect(rx | 0, 2, 7, Math.min(S.SAND_Y, BASE_SAND) - 2); // sunlight doesn't reach the abyss
    }
  }
}

function drawSand() {
  for (let y = S.SAND_Y; y < S.H; y++) {
    for (let x = 0; x < W; x++) {
      const n = sandNoise[y - S.SAND_Y][x];
      px(x, y, n < 0.12 ? "#3a4d63" : n < 0.55 ? "#233246" : "#1b2839");
    }
  }
}

const SWAY = () => (reduced ? 0.3 : 1);

function drawKelp(p) {
  const shades = S.night ? KELP_NIGHT : KELP_DAY;
  for (let i = 0; i < p.h; i++) {
    const y = S.SAND_Y - 1 - i;
    const fr = i / p.h;
    const off = Math.round(Math.sin(S.t * 0.016 + p.ph + i * 0.2) * SWAY() * fr * 3);
    const col = fr > 0.78 ? shades[2] : fr > 0.42 ? shades[1] : shades[0];
    px(p.x + off, y, col);
    // alternating leaves
    if (i % 4 === 2 && i < p.h - 2) {
      const side = (i % 8 < 4) ? 1 : -1;
      px(p.x + off + side, y, col);
      px(p.x + off + side * 2, y, fr > 0.5 ? shades[1] : shades[0]);
      px(p.x + off + side * 2, y - 1, shades[0]);
    }
  }
  // luminous tip
  const tipOff = Math.round(Math.sin(S.t * 0.016 + p.ph + p.h * 0.2) * SWAY() * 3);
  px(p.x + tipOff, S.SAND_Y - p.h, S.night ? "#3dff8b" : "#8dffc0");
}

function drawGrass(p) {
  const shades = S.night ? KELP_NIGHT : KELP_DAY;
  for (const b of p.blades) {
    for (let i = 0; i < b.h; i++) {
      const y = S.SAND_Y - 1 - i;
      const off = Math.round(Math.sin(S.t * 0.024 + b.ph + i * 0.3) * SWAY() * (i / b.h) * 2.2);
      px(p.x + b.dx + off, y, i > b.h - 3 ? shades[2] : i > b.h / 2 ? shades[1] : shades[0]);
    }
  }
}

function drawBush(p) {
  const shades = S.night ? BUSH_NIGHT : BUSH_DAY;
  const off = Math.round(Math.sin(S.t * 0.012 + p.ph) * SWAY());
  for (const [dx, dy, ci] of p.pix) {
    const topHalf = dy < -p.ry;
    px(p.x + dx + (topHalf ? off : 0), S.SAND_Y - 1 + dy + p.ry, shades[ci]);
  }
}

function drawCoral(p) {
  const body = S.night ? "#8a3352" : "#c2436f";
  const tip = S.night ? "#c2436f" : "#ff6b9d";
  for (const [dx, dy, ci] of p.pix) px(p.x + dx, S.SAND_Y - 1 + dy, ci ? tip : body);
  for (const [dx, dy, ph] of p.polyps) {
    const on = Math.sin(S.t * 0.004 + ph) > 0.4;
    px(p.x + dx, S.SAND_Y - 1 + dy, on ? "#ffd6e6" : tip);
  }
}

function drawFiber(p) {
  const stem = S.night ? "#26364e" : "#1c2a3f";
  for (const s of p.strands) {
    let sx = p.x;
    for (let i = 0; i < s.len; i++) {
      const y = S.SAND_Y - 1 - i;
      const curve = s.spread * (i / s.len) * 4;
      const off = Math.sin(S.t * 0.014 + s.ph + i * 0.15) * SWAY() * (i / s.len) * 1.5;
      sx = p.x + Math.round(curve + off);
      px(sx, y, stem);
    }
    // glowing tip: pulses, brighter at S.night
    const gy = S.SAND_Y - 1 - s.len;
    const col = GLOW_CYCLE[(s.ci + Math.floor(S.t * 0.0008)) % GLOW_CYCLE.length];
    const pulse = Math.sin(S.t * 0.006 + s.ph) * 0.5 + 0.5;
    px(sx, gy, col);
    cx.globalAlpha = (S.night ? 0.5 : 0.25) * pulse;
    cx.fillStyle = col;
    cx.fillRect(sx - 1, gy, 1, 1); cx.fillRect(sx + 1, gy, 1, 1);
    cx.fillRect(sx, gy - 1, 1, 1); cx.fillRect(sx, gy + 1, 1, 1);
    cx.globalAlpha = 1;
  }
}

const PLANT_DRAW = { kelp: drawKelp, grass: drawGrass, bush: drawBush, coral: drawCoral, fiber: drawFiber };
function drawPlant(p) { PLANT_DRAW[p.type](p); }

function drawRocks() {
  const mounds = [[90, 7, "#3a4556"], [98, 5, "#2b3444"], [83, 4, "#46536a"]];
  for (const [mx, r, col] of mounds) {
    for (let hgt = 0; hgt <= r; hgt++) {
      const hw = Math.round(Math.sqrt(r * r - hgt * hgt) * 0.95);
      cx.fillStyle = col;
      cx.fillRect(mx - hw, S.SAND_Y - 1 - hgt, hw * 2 + 1, 1);
    }
  }
  // moss
  px(87, S.SAND_Y - 8, "#2fbf68"); px(90, S.SAND_Y - 9, "#17d96b"); px(93, S.SAND_Y - 8, "#22b35c");
  px(97, S.SAND_Y - 6, "#2fbf68"); px(100, S.SAND_Y - 5, "#22b35c"); px(82, S.SAND_Y - 5, "#17d96b");
}

function drawSprite(rows, cxr, cyr, dir, pal, opts) {
  const h = rows.length, w = rows[0].length;
  const ox = Math.round(cxr - w / 2), oy = Math.round(cyr - h / 2);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let ch = rows[r][c];
      if (ch === ".") continue;
      if (ch === "f" && opts && opts.squish && c < 1) continue;
      const drawC = dir === 1 ? c : w - 1 - c;
      let col;
      if (ch === "b") col = r === 0 || r === h - 1 ? pal.d : pal.b;
      else if (ch === "f") col = pal.f;
      else if (ch === "d") col = pal.d;
      else if (ch === "e") col = "#0a0e14";
      else if (ch === "w") col = "#e8f2fa";
      else if (ch === "c") col = "#46d8ff";
      px(ox + drawC, oy + r, col);
    }
  }
  return { ox, oy, w, h };
}

// classic oval egg: highlight top-left, shaded bottom-right, grade-tinted
function drawEgg(e) {
  const pal = EGG_PALS[e.grade] || EGG_PALS[0];
  // hatching soon: rock side to side, then a crack appears
  const wobble = e.hatch < 4000 ? Math.round(Math.sin(S.t * 0.03)) : 0;
  const ox = Math.round(e.x) - 2 + wobble;
  const oy = Math.round(e.y) + 2 - EGG_ROWS.length + 1; // bottom rests where the 2x2 egg used to
  for (let r = 0; r < EGG_ROWS.length; r++) {
    for (let c = 0; c < 5; c++) {
      const ch = EGG_ROWS[r][c];
      if (ch !== ".") px(ox + c, oy + r, pal[ch]);
    }
  }
  if (e.hatch < 2500) {
    const crack = "#7a6242";
    px(ox + 1, oy + 3, crack); px(ox + 2, oy + 2, crack); px(ox + 3, oy + 3, crack);
  }
  // legendary and mythic eggs sparkle
  if (e.grade >= 2 && Math.floor(S.t * 0.004) % 3 === 0) {
    px(e.x + rnd(-3, 4), e.y + rnd(-3, 3), e.grade === 3 ? "#efe0ff" : "#fff6c9");
  }
}

function drawFish(f) {
  // ~0.5s tail beat, phase-shifted per fish so the school doesn't flap in sync
  const fastFrame = Math.floor(S.t * (reduced ? 0.0015 : 0.003) + f.phase) % 2;
  const slowFrame = Math.floor(S.t * (reduced ? 0.0008 : 0.0015) + f.phase) % 2;
  let rows, opts = { squish: fastFrame === 1 };
  if (f.species === "jelly") { rows = JELLY_FRAMES[slowFrame]; opts = {}; }
  else if (f.species === "crab") { rows = CRAB_FRAMES[fastFrame]; opts = {}; }
  else if (f.species === "starfish") { rows = SPRITES.starfish; opts = {}; }
  else if (f.species === "seahorse") { rows = SPRITES.seahorse; }
  else if (f.species === "puffer" && f.inflated) { rows = SPRITES.pufferBig; opts = {}; }
  else if (f.species === "golden") { rows = SPRITES.guppy; }
  else { rows = SPRITES[f.species]; }
  const box = drawSprite(rows, f.x, f.y, f.dir, f.pal, opts);
  // senior fish crown
  if (isCrowned(f)) {
    cx.fillStyle = "#ffd54a";
    const hx = Math.round(f.x) + (f.dir === 1 ? 2 : -2);
    cx.fillRect(hx - 1, box.oy - 2, 3, 1);
    px(hx - 1, box.oy - 3, "#ffd54a"); px(hx + 1, box.oy - 3, "#ffd54a");
  }
  // golden sudo sparkle
  if (f.species === "golden" && Math.floor(S.t * 0.004) % 3 === 0) {
    px(f.x + rnd(-7, 7), f.y + rnd(-5, 5), Math.random() < 0.5 ? "#fff6c9" : "#ffd54a");
  }
  // anglerfish lure pulses in the dark
  if (f.species === "angler" && Math.floor(S.t * 0.005) % 2 === 0) {
    px(f.x - (f.dir === 1 ? 1 : 0), box.oy - 1, "#bff0ff");
  }
}

function drawShark() {
  if (!S.shark) return;
  drawSprite(SHARK_SPRITE, S.shark.x, S.shark.y, S.shark.dir, SHARK_PAL, {});
}

function drawRaid() {
  if (!S.raid) return;
  if (S.raid.phase === "warn") {
    // distant fin silhouette glides past in the gloom
    const p = 1 - S.raid.timer / RAID_WARN_MS;
    const sx = -30 + p * (W + 60);
    cx.globalAlpha = 0.18;
    drawSprite(SHARK_SPRITE, sx, 17, 1, { b: "#0b1830", d: "#081226", f: "#081226" }, {});
    cx.globalAlpha = 1;
    return;
  }
  const b = S.raid.boss;
  const rows = SHARK_SPRITE, h = rows.length, w = rows[0].length, s = 2;
  const ox = Math.round(b.x - w), oy = Math.round(b.y - h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      if (ch === ".") continue;
      const dc = b.dir === 1 ? c : w - 1 - c;
      cx.fillStyle =
        ch === "b" ? "#4a5f74" :
        ch === "d" ? "#32424f" :
        ch === "w" ? "#e8f2fa" :
        (S.raidDark > 0.5 ? "#ff3b3b" : "#0a0e14"); // eye burns red in the dark
      cx.fillRect(ox + dc * s, oy + r * s, s, s);
    }
  }
  // wounds accumulate as the tank fights back
  cx.fillStyle = "#ff5c5c";
  for (let k = 0; k < BOSS_HP - b.hp && k < WOUND_SPOTS.length; k++) {
    const dc = b.dir === 1 ? WOUND_SPOTS[k][0] : w - 1 - WOUND_SPOTS[k][0];
    cx.fillRect(ox + dc * s, oy + WOUND_SPOTS[k][1] * s, s, s);
  }
}

function drawJailBack() {
  // cell interior shading
  cx.fillStyle = "rgba(8, 13, 24, 0.5)";
  cx.fillRect(JAIL.x, JAIL.top, JAIL.w, JAIL.h);
  for (let s = 0; s < 3; s++) {
    const fy = S.SAND_Y - 1 - s * 10; // this level's floor
    if (s > 0) { cx.fillStyle = "#2a3547"; cx.fillRect(JAIL.x + 1, fy + 1, JAIL.w - 2, 1); }
    // treadmill: rollers, animated belt, console post with a running light
    const bx = 6, bw = 14;
    const shift = Math.floor(S.t * 0.02) % 4;
    for (let i = 0; i < bw; i++) {
      cx.fillStyle = ((i + shift) % 4 < 2) ? "#4a5668" : "#2f3b4e"; // belt runs opposite the fish (leftward)
      cx.fillRect(bx + i, fy - 1, 1, 1);
    }
    cx.fillStyle = "#141b29"; cx.fillRect(bx, fy, bw, 1);
    px(bx - 1, fy - 1, "#5a6a82"); px(bx + bw, fy - 1, "#5a6a82");
    cx.fillStyle = "#3a4556"; cx.fillRect(bx + bw + 2, fy - 5, 1, 5);
    px(bx + bw + 2, fy - 6, Math.floor(S.t * 0.01 + s) % 2 ? "#3dff8b" : "#14532d");
    // sentence progress above an occupied treadmill
    const pf = JAIL.slots[s];
    if (pf && pf.jail) {
      const frac = Math.max(0, Math.min(1, 1 - pf.jail.sentence / pf.jail.total));
      cx.fillStyle = "#1c2433"; cx.fillRect(bx + 2, fy - 9, 10, 1);
      cx.fillStyle = "#3dff8b"; cx.fillRect(bx + 2, fy - 9, Math.round(10 * frac), 1);
    }
  }
}

function drawJailFront() {
  // roof and right-side frame
  cx.fillStyle = "#3a4556";
  cx.fillRect(JAIL.x, JAIL.top - 1, JAIL.w + 1, 1);
  cx.fillRect(JAIL.right, JAIL.top - 1, 1, JAIL.h + 1);
  // vertical bars over the cell
  cx.fillStyle = "#46536a";
  for (let bx = JAIL.x + 2; bx < JAIL.right; bx += 4) {
    cx.fillRect(bx, JAIL.top, 1, JAIL.h);
  }
}

// pixel gold coin: round, black outline, warm gold face, S mark, top-left shine
const COIN_H = COIN_ROWS.length, COIN_C = (COIN_H - 1) / 2;
function drawCoins() {
  for (const c of coins) {
    const phc = Math.floor(S.t * 0.005 + c.x * 0.7) % 4;
    const scale = phc === 0 ? 1 : phc === 2 ? 0.35 : 0.7; // spins as it falls
    for (let r = 0; r < COIN_H; r++) {
      for (let col = 0; col < COIN_H; col++) {
        const ch = COIN_ROWS[r][col];
        if (ch === ".") continue;
        px(c.x + Math.round((col - COIN_C) * scale), c.y + r - COIN_C, COIN_COLORS[ch]);
      }
    }
  }
}

function drawChest() {
  const X = CHEST.x, Y = CHEST.y, open = CHEST.openT > 0;
  // base
  cx.fillStyle = "#6b4a2a"; cx.fillRect(X, Y + 3, 13, 6);
  cx.fillStyle = "#4a3018"; cx.fillRect(X, Y + 8, 13, 1); cx.fillRect(X + 6, Y + 3, 1, 6);
  cx.fillStyle = "#8a6236"; cx.fillRect(X, Y + 3, 13, 1);
  // lid
  if (open) {
    cx.fillStyle = "#6b4a2a"; cx.fillRect(X - 1, Y - 3, 13, 2);
    cx.fillStyle = "#8a6236"; cx.fillRect(X - 1, Y - 4, 13, 1);
    // glow from inside
    cx.fillStyle = Math.floor(S.t * 0.003) % 2 ? "#ffd54a" : "#ffe89a";
    cx.fillRect(X + 2, Y + 2, 9, 1);
  } else {
    cx.fillStyle = "#6b4a2a"; cx.fillRect(X, Y, 13, 3);
    cx.fillStyle = "#8a6236"; cx.fillRect(X, Y, 13, 1);
    cx.fillStyle = "#c79a1e"; cx.fillRect(X + 5, Y + 2, 3, 3); // lock
    px(X + 6, Y + 3, "#4a3018");
  }
}

export { px, drawWater, drawSand, drawPlant, drawRocks, drawSprite, drawEgg, drawFish, drawShark, drawRaid, drawJailBack, drawJailFront, drawCoins, drawChest };
