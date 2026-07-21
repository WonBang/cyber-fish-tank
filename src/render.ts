// @ts-nocheck — mechanical port from the single-file build; typing is a follow-up pass
import { S } from "./state";
import { W, cx } from "./canvas";
import { FEED_DEF } from "./economy";
import { MANTIS_SPRITE, MANTIS_PAL } from "./sprites";
import { px, drawWater, drawSand, drawPlant, drawRocks, drawSprite, drawEgg, drawFish, drawShark, drawRaid, drawJailBack, drawJailFront, drawCoins, drawChest } from "./draw";
import { update } from "./update";
import { plants, MANTIS, CHEST, eggs, flakes, fishes, hearts, bubbles, rings, updateNameTags } from "./game";

// ---------- render ----------
function render() {
  drawWater();
  for (const p of plants) if (!p.front) drawPlant(p);
  drawRocks();
  drawSand();
  drawJailBack();
  drawChest();
  if (MANTIS.show > 0) {
    drawSprite(MANTIS_SPRITE, CHEST.x + 6 + MANTIS.dir * 4, CHEST.y - 5, MANTIS.dir, MANTIS_PAL, {});
  }
  for (const e of eggs) drawEgg(e);
  for (const fl of flakes) {
    const col = FEED_DEF[fl.tier || 0].col;
    px(fl.x, fl.y, Math.floor(S.t * 0.002 + fl.x) % 2 ? col[1] : col[0]);
  }
  drawCoins();
  for (const f of fishes) drawFish(f);
  drawShark();
  for (const h of hearts) {
    const c = h.life > 400 ? "#ff6b9d" : "#c23f6e";
    const hx = Math.round(h.x), hy = Math.round(h.y);
    px(hx - 1, hy - 1, c); px(hx + 1, hy - 1, c);
    px(hx - 1, hy, c); px(hx, hy, c); px(hx + 1, hy, c);
    px(hx, hy + 1, c);
  }
  cx.fillStyle = "rgba(190,230,255,0.8)";
  for (const b of bubbles) {
    if (b.r === 1) { cx.fillRect(b.x | 0, b.y | 0, 1, 1); }
    else {
      cx.fillRect((b.x | 0), (b.y | 0) - 1, 1, 1); cx.fillRect((b.x | 0), (b.y | 0) + 1, 1, 1);
      cx.fillRect((b.x | 0) - 1, b.y | 0, 1, 1); cx.fillRect((b.x | 0) + 1, b.y | 0, 1, 1);
    }
  }
  for (const p of plants) if (p.front) drawPlant(p);
  drawJailFront();
  // S.raid gloom settles over the whole tank, boss stays vivid on top
  if (S.raidDark > 0.01) {
    cx.fillStyle = `rgba(3, 9, 20, ${(S.raidDark * 0.42).toFixed(3)})`;
    cx.fillRect(0, 0, W, S.H);
  }
  drawRaid();
  for (const rg of rings) {
    cx.globalAlpha = Math.max(0, rg.life / 600) * 0.8;
    cx.fillStyle = rg.col;
    for (let a = 0; a < 20; a++) {
      const ang = a / 20 * Math.PI * 2;
      cx.fillRect(Math.round(rg.x + Math.cos(ang) * rg.r), Math.round(rg.y + Math.sin(ang) * rg.r), 1, 1);
    }
    cx.globalAlpha = 1;
  }
}

// ---------- loop ----------
function loop(now) {
  const rawDt = Math.min(50, Math.max(0, now - S.lastT));
  // global pace: simulation runs at 45% speed for a calm, ornamental feel
  const dt = rawDt * 0.45;
  S.lastT = now;
  update(dt);
  render();
  updateNameTags();
  requestAnimationFrame(loop);
}

export { loop };
