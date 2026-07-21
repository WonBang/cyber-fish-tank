// @ts-nocheck — mechanical port from the single-file build; typing is a follow-up pass
import { S } from "./state";
import { FISH_PALETTES, MIN_FISH, NAMES } from "./palette";
import { SPRITES, JELLY_FRAMES, CRAB_FRAMES, SHARK_SPRITE, SHARK_PAL, MANTIS_SPRITE, MANTIS_PAL, SPECIES_DEF, DEEP_REQ, EGG_ROWS, EGG_PALS, COIN_ROWS, COIN_COLORS } from "./sprites";
import { KOR, VARIED, FEED_DEF, EGG_SHOP, EGG_POOLS, BREED_EGG_ODDS, SELL_PRICE, DEX_BONUS, FRAME_SHOP, DEPTH_SHOP, GRADE_COLORS, TIER_LABELS, GRADE_NAMES } from "./economy";
import { W, BASE_H, BASE_SAND, LAYER_H, MAX_DEPTH, cv, cx, reduced } from "./canvas";
import { rnd, ri, todayStr, fmtWhen } from "./utils";
import { px, drawWater, drawSand, drawPlant, drawRocks, drawSprite, drawEgg, drawFish, drawShark, drawRaid, drawJailBack, drawJailFront, drawCoins, drawChest } from "./draw";
import { dropFood, update } from "./update";

// #widget: the macOS menubar app loads this page with a hash to get the compact layout
if (location.hash === "#widget") document.body.classList.add("compact");

// ---------- palette ----------

// ---------- sprites (facing right, tail = f on left) ----------

// species table: weight + fixed identity for specials
// deep-sea species and the tank depth required to hatch (and house) them

// ---------- world state ----------
export const fishes = [], bubbles = [], flakes = [], coins = [], eggs = [], hearts = [], rings = [];
const LOVE_AT = 3; // meals before a fish trusts you enough to be named
const CROWN_AT = 10; // meals before a fish earns its crown (sells +50%, breeds better eggs)
export const isCrowned = (f) => f.ate >= CROWN_AT;
const CROWN_KEEP = 10 * 60000; // crown fades 10min after the last meal; 3 feeds win it back
S.t = 0, S.spawnedPids = new Set();
S.shark = null, S.sharkTimer = rnd(45000, 90000);
S.night = false;
// S.shark S.raid boss event
S.raid = null, S.raidTimer = rnd(60000, 120000), S.raidDark = 0;
export const RAID_WARN_MS = 13000, BOSS_HP = 15;
export const WOUND_SPOTS = [[8,4],[12,5],[16,3],[10,6],[14,4],[18,5],[7,5],[20,4],[11,3],[15,6],[9,4],[17,4],[13,3],[19,5],[6,4]];
S.breedT = rnd(20000, 40000);
S.driftT = rnd(90000, 180000);
export const CHEST = { x: 146, y: S.SAND_Y - 9, w: 13, h: 9, openT: 0, cooldown: 0 };
// bottom-left jail: three stacked treadmill cells; drag a fish in to lock it up
export const JAIL = { x: 2, w: 25, top: S.SAND_Y - 30, h: 30, right: 27 };
JAIL.slots = [null, null, null]; // one prisoner per treadmill level
const MANTIS = { cool: 0, show: 0, dir: 1 };
const SAND_DWELLERS = ["crab", "starfish"];
const SLOW_GIANTS = ["whale", "beluga", "mola", "bluewhale", "giantsquid"]; // slow drifters, too big for the jail door

function pickSpecies() {
  const total = SPECIES_DEF.reduce((s, d) => s + d.w, 0);
  let roll = Math.random() * total;
  for (const d of SPECIES_DEF) { roll -= d.w; if (roll <= 0) return d; }
  return SPECIES_DEF[0];
}

function makeFish(forceKey) {
  const def = forceKey ? SPECIES_DEF.find(d => d.key === forceKey) : pickSpecies();
  const palIdx = def.pal ? -1 : ri(0, FISH_PALETTES.length - 1);
  const pal = def.pal || FISH_PALETTES[palIdx];
  let pid; do { pid = ri(100, 9999); } while (S.spawnedPids.has(pid));
  S.spawnedPids.add(pid);
  const f = {
    species: def.key, pal, palIdx,
    name: def.name || NAMES[ri(0, NAMES.length - 1)],
    pid,
    x: rnd(20, W - 20),
    y: rnd(16, S.SAND_Y - 24),
    dir: Math.random() < 0.5 ? 1 : -1,
    vx: 0,
    speed: SLOW_GIANTS.includes(def.key) ? rnd(0.105, 0.165) : rnd(0.27, 0.51),
    targetY: 0,
    phase: rnd(0, Math.PI * 2),
    retarget: 0,
    food: null,
    foodCd: 0,
    ate: 0,
    inflated: false,
    puffT: rnd(8000, 20000),
    knock: 0, kvx: 0, kvy: 0,
    tx: rnd(20, W - 20),
    burstT: rnd(0, 2000), thrust: 1, scurry: 0,
    aggro: false, aggroT: 0, aggroY: 0,
    jail: null, dragged: false,
    sat: 0, dietTier: 0, // satiety gates breeding; diet tier caps the egg grade
  };
  if (def.key === "crab") { f.y = S.SAND_Y - 4; f.speed = rnd(0.075, 0.135); }
  if (def.key === "jelly") { f.speed = rnd(0.02, 0.05); }
  if (def.key === "starfish") { f.y = S.SAND_Y - 3; f.speed = rnd(0.008, 0.018); }
  if (def.key === "seahorse") { f.speed = rnd(0.03, 0.06); }
  if (def.key === "sword") { f.speed = rnd(0.45, 0.7); } // fastest fish in the tank
  if (DEEP_REQ[def.key] && S.tankDepth > 0) { f.y = rnd(BASE_SAND + 4, S.SAND_Y - 6); } // born in the abyss
  return f;
}

// sand dither pattern (fixed noise)
export const sandNoise = [];
for (let y = 0; y < S.H - S.SAND_Y; y++) {
  sandNoise.push(Array.from({ length: W }, () => Math.random()));
}
// ---------- plants ----------
export const KELP_DAY = ["#136e3a", "#22b35c", "#3dff8b"];
export const KELP_NIGHT = ["#0b4426", "#14733c", "#25b45f"];
export const BUSH_DAY = ["#0e6b35", "#179447", "#27c46a"];
export const BUSH_NIGHT = ["#093f21", "#0f5c2e", "#177a41"];
export const GLOW_CYCLE = ["#46d8ff", "#ff6b9d", "#3dff8b", "#ffd54a"];

function makePlant(type, x, h, front) {
  const p = { type, x, h, front, ph: rnd(0, 6.28) };
  if (type === "grass") {
    p.blades = Array.from({ length: ri(3, 5) }, (_, i) => ({
      dx: i - 2 + ri(0, 1), h: ri(6, 13), ph: rnd(0, 6.28),
    }));
  }
  if (type === "bush") {
    p.pix = [];
    const rx = ri(3, 5), ry = ri(4, 6);
    for (let dy = -ry; dy <= 0; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx / rx) ** 2 + ((dy + ry * 0.2) / ry) ** 2 < 1 && Math.random() > 0.22) {
          p.pix.push([dx, dy - ry, ri(0, 2)]);
        }
      }
    }
    p.ry = ry;
  }
  if (type === "coral") {
    p.pix = []; p.polyps = [];
    const strands = ri(3, 4);
    for (let s = 0; s < strands; s++) {
      let dx = 0, drift = (s - (strands - 1) / 2) * 0.55;
      const len = ri(7, 12);
      for (let i = 0; i < len; i++) {
        dx += drift * 0.35 + rnd(-0.3, 0.3);
        p.pix.push([Math.round(dx), -1 - i, i > len - 3 ? 1 : 0]);
      }
      p.polyps.push([Math.round(dx), -len, rnd(0, 6.28)]);
    }
  }
  if (type === "fiber") {
    const n = ri(3, 5);
    p.strands = Array.from({ length: n }, (_, i) => ({
      spread: (i - (n - 1) / 2) * 0.5,
      len: ri(Math.max(8, h - 8), h),
      ci: ri(0, GLOW_CYCLE.length - 1),
      ph: rnd(0, 6.28),
    }));
  }
  return p;
}

const plants = [
  ["kelp", 46, 38, false], ["grass", 64, 0, false], ["bush", 38, 0, false],
  ["coral", 58, 0, false], ["kelp", 71, 30, false], ["fiber", 112, 26, false],
  ["grass", 124, 0, false], ["kelp", 138, 36, false], ["bush", 168, 0, false],
  ["grass", 182, 0, false],
  ["grass", 104, 0, true], ["fiber", 50, 20, true], ["kelp", 163, 22, true], ["grass", 176, 0, true],
].map(([ty, x, h, fr]) => makePlant(ty, x, h, fr));

// ---------- log ----------
function log(msg) {
  if (!Array.isArray(S.save.log)) S.save.log = [];
  S.save.log.push({ ts: Date.now(), m: String(msg) });
  if (S.save.log.length > 50) S.save.log.splice(0, S.save.log.length - 50);
  persist();
}

// ---------- economy / shop / dex ----------
S.CAP = 30 + 8 * S.tankDepth; // tank capacity (fish + pending eggs), +8 per deep-sea layer
const SAVE_KEY = "cyber-fish-tank-save";
S.save = { gold: 150, frames: [], frame: "", dex: {}, feed: { basic: 30, prime: 0, golden: 0 }, ration: { date: "", basic: 0, prime: 0 } };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (s && typeof s === "object") S.save = Object.assign(S.save, s);
} catch (e) {}
if (!Array.isArray(S.save.frames)) S.save.frames = [];
if (typeof S.save.dex !== "object" || !S.save.dex) S.save.dex = {};
if (typeof S.save.feed !== "object" || !S.save.feed) S.save.feed = { basic: 30, prime: 0, golden: 0 };
if (typeof S.save.ration !== "object" || !S.save.ration) S.save.ration = { date: "", basic: 0, prime: 0 };
if (!Array.isArray(S.save.hatchLog)) S.save.hatchLog = [];
// scrub old english debug-flavor entries from existing saves
if (Array.isArray(S.save.log)) {
  S.save.log = S.save.log.filter((ev) => ev && typeof ev.m === "string" &&
    !/tank driver|pump daemon|processes attached|sudo S.shark|EBUSY|stack overflow|ate flake|exit 0|\[\d+\]/.test(ev.m));
}
S.save.depth = Math.min(MAX_DEPTH, Math.max(0, (S.save.depth) | 0));
S.saveT = 0;
function snapshotTank() {
  S.save.fish = fishes.map(f => ({
    s: f.species, p: f.palIdx, n: f.name, c: f.customName || "",
    a: f.ate, la: f.lastAte || 0, x: Math.round(f.x), y: Math.round(f.y),
    st: Math.round(f.sat), dt: f.dietTier,
  }));
  S.save.eggs = eggs.map(e => ({
    s: e.species, p: e.palIdx == null ? -1 : e.palIdx,
    h: Math.round(e.hatch), x: Math.round(e.x), y: Math.round(e.y),
    g: e.grade == null ? -1 : e.grade,
  }));
}
function persistNow() {
  clearTimeout(S.saveT);
  snapshotTank();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.save)); } catch (e) {}
}
function persist() {
  clearTimeout(S.saveT);
  S.saveT = setTimeout(persistNow, 400);
}
setInterval(persistNow, 5000); // the tank keeps living between saves
addEventListener("pagehide", persistNow);

const goldEl = document.getElementById("goldAmt");
const toastsEl = document.getElementById("toasts");
const shopBody = document.getElementById("shopBody");
const dexBody = document.getElementById("dexBody");
const frameEl = document.getElementById("frame");
const toolbarEl = document.getElementById("toolbar");
const sheetEl = document.getElementById("sheet");
const sheetTitleEl = document.getElementById("sheetTitle");
const popupEl = document.getElementById("fishPopup");
const feedbarEl = document.getElementById("feedbar");
S.feedTier = 0; // which feed the next water click scatters
S.feedArmed = false; // feeding only happens while a feed button is armed

function renderGold() { goldEl.textContent = S.save.gold; }
function addGold(n) { S.save.gold += n; renderGold(); persist(); }

// pixel coin icon for the UI, baked from the in-tank coin sprite
S.coinURL = null;
function coinImg(size) {
  if (!S.coinURL) {
    const c = document.createElement("canvas");
    c.width = COIN_ROWS.length; c.height = COIN_ROWS.length;
    const g = c.getContext("2d");
    for (let r = 0; r < COIN_ROWS.length; r++) {
      for (let col = 0; col < COIN_ROWS.length; col++) {
        const ch = COIN_ROWS[r][col];
        if (ch === ".") continue;
        g.fillStyle = COIN_COLORS[ch];
        g.fillRect(col, r, 1, 1);
      }
    }
    S.coinURL = c.toDataURL();
  }
  const img = document.createElement("img");
  img.src = S.coinURL;
  img.className = "coin-ico";
  img.alt = "골드";
  if (size) img.style.width = img.style.height = size + "px";
  return img;
}

function toast(msg, long) {
  const d = document.createElement("div");
  d.className = "toast" + (long ? " long" : "");
  const parts = String(msg).split("🪙");
  parts.forEach((p, i) => {
    d.append(p);
    if (i < parts.length - 1) d.appendChild(coinImg(11));
  });
  toastsEl.appendChild(d);
  setTimeout(() => d.remove(), long ? 6500 : 3000);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
}


function discover(species, palIdx) {
  const list = S.save.dex[species] || (S.save.dex[species] = []);
  const isNewSpecies = list.length === 0;
  const idx = palIdx == null ? -1 : palIdx;
  if (list.includes(idx)) return;
  list.push(idx);
  if (isNewSpecies) {
    const bonus = DEX_BONUS[species] || 30;
    addGold(bonus);
    toast(`도감 등록: ${KOR[species]} +${bonus}🪙`);
    log(`📖 도감 등록: ${KOR[species]} +${bonus}골드`);
  }
  else if (VARIED.includes(species)) { addGold(5); toast(`새 색상 발견: ${KOR[species]} +5🪙`); }
  persist();
  renderDex();
}
function addFish(f) { fishes.push(f); discover(f.species, f.palIdx); return f; }

// feed tiers: pure buff — no starvation penalty, satiety just gates breeding
function rationLeft(item) {
  if (S.save.ration.date !== todayStr()) { S.save.ration = { date: todayStr(), basic: 0, prime: 0 }; }
  return item.daily - (S.save.ration[item.key] || 0);
}
const BREED_SAT = 60;
// graded gacha eggs: each tier's pool is a superset of the tier below —
// rarer fish just take a bigger share as the grade goes up
// deep-sea species only enter a pool once their layer is open
function availablePool(grade) {
  return (EGG_POOLS[grade] || EGG_POOLS[0]).filter(([k]) => !DEEP_REQ[k] || S.save.depth >= DEEP_REQ[k]);
}
// parent diet (lower of the pair) caps the egg grade; richer feed only raises the odds
function rollEggGrade(diet, crowns) {
  const odds = (BREED_EGG_ODDS[diet] || BREED_EGG_ODDS[0]).slice();
  // crowned parents tilt the roll toward the best grade their diet allows
  // (+10%p per crown; the diet cap itself never moves)
  let top = 0;
  for (let g = 0; g < odds.length; g++) if (odds[g] > 0) top = g;
  const tilt = Math.min(odds[0], 0.1 * (crowns || 0));
  odds[0] -= tilt;
  odds[top] += tilt;
  let roll = Math.random();
  for (let g = 0; g < odds.length; g++) { roll -= odds[g]; if (roll <= 0) return g; }
  return 0;
}
function rollEggSpecies(grade) {
  const pool = availablePool(grade);
  const total = pool.reduce((s, p) => s + p[1], 0);
  let roll = Math.random() * total;
  for (const [key, w] of pool) { roll -= w; if (roll <= 0) return key; }
  return pool[0][0];
}
// first-discovery dex bounty, scaled by rarity (default 30 for commons)

// graded eggs roll their species at hatch time — suspense until it cracks
function dropGradeEgg(grade, x, y, hatch) {
  eggs.push({ x, y, hatch, grade, species: null, pal: null, palIdx: -1 });
}

function buyEgg(item) {
  if (fishes.length + eggs.length >= S.CAP) { toast(`어항이 가득 찼어요 (${S.CAP}마리)`); return; }
  if (S.save.gold < item.price) { toast("골드 부족"); return; }
  addGold(-item.price);
  dropGradeEgg(item.grade, rnd(40, 140), 8, rnd(14000, 24000));
  toast(`${item.label} 구매 — 알이 떨어집니다`);
}

function buyFeed(item) {
  if (item.daily > 0 && rationLeft(item) > 0) {
    // free daily ration, capped per local calendar day — paid once it runs out
    S.save.ration[item.key] = (S.save.ration[item.key] || 0) + 1;
    toast(`${item.label} ×${item.pack} 수령 (오늘 ${rationLeft(item)}회 남음)`);
  } else {
    if (S.save.gold < item.price) { toast("골드 부족"); return; }
    addGold(-item.price);
    toast(`${item.label} ×${item.pack} 구매`);
  }
  S.save.feed[item.key] = (S.save.feed[item.key] || 0) + item.pack;
  persist();
  renderFeedBar();
  renderShop();
}

// deep-sea layers: extend the tank downward, +8 capacity each

function applyDepth() {
  S.tankDepth = S.save.depth;
  S.H = BASE_H + S.tankDepth * LAYER_H;
  S.SAND_Y = BASE_SAND + S.tankDepth * LAYER_H;
  cv.height = S.H;
  S.CAP = 30 + 8 * S.tankDepth;
  // the floor furniture sinks with the sand line
  CHEST.y = S.SAND_Y - 9;
  JAIL.top = S.SAND_Y - 30;
}

function buyDepth(idx) {
  const item = DEPTH_SHOP[idx];
  if (S.save.gold < item.price) { toast("골드 부족"); return; }
  addGold(-item.price);
  S.save.depth = idx + 1;
  applyDepth();
  persist();
  renderShop();
  toast(`${item.label} 개방 — 어항이 깊어졌어요 (최대 ${S.CAP}마리)`);
}

// per-grade drop rates, derived from the same EGG_POOLS the gacha rolls
const oddsOpen = [false, false, false, false]; // survives shop re-renders
function eggOddsRow(grade) {
  const pool = availablePool(grade);
  const total = pool.reduce((s, p) => s + p[1], 0);
  const top = Math.max(...pool.map((p) => p[1]));
  const d = document.createElement("div");
  d.className = "odds";
  const b = document.createElement("button");
  const tbl = document.createElement("div");
  tbl.className = "oddstable";
  for (const [key, w] of [...pool].sort((a, b) => b[1] - a[1])) {
    const row = document.createElement("div");
    row.className = "oddsrow";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = GRADE_COLORS[Math.max(0, tierOf(key))];
    const nm = document.createElement("span");
    nm.className = "onm";
    nm.textContent = KOR[key];
    const bar = document.createElement("span");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = (w / top * 100).toFixed(0) + "%";
    fill.style.background = GRADE_COLORS[Math.max(0, tierOf(key))];
    bar.appendChild(fill);
    const pc = document.createElement("span");
    pc.className = "pc";
    pc.textContent = (w / total * 100).toFixed(1) + "%";
    row.append(dot, nm, bar, pc);
    tbl.appendChild(row);
  }
  const sync = () => {
    b.textContent = oddsOpen[grade] ? "확률 접기 ▲" : "확률 보기 ▼";
    tbl.classList.toggle("hidden", !oddsOpen[grade]);
  };
  b.addEventListener("click", () => { oddsOpen[grade] = !oddsOpen[grade]; sync(); });
  sync();
  d.append(b, tbl);
  return d;
}

function applyFrame(key) {
  S.save.frame = key;
  persist();
  frameEl.className = "frame" + (key ? " skin-" + key : "");
  renderShop();
}

function shopRow(name, price, btnText, onClick, disabled) {
  const d = document.createElement("div");
  d.className = "item";
  const nm = document.createElement("span");
  nm.className = "nm";
  nm.textContent = name;
  const pr = document.createElement("span");
  pr.className = "pr";
  if (price != null && price > 0) {
    pr.append(String(price));
    pr.appendChild(coinImg(10));
  }
  const b = document.createElement("button");
  b.textContent = btnText;
  b.disabled = !!disabled;
  b.addEventListener("click", onClick);
  d.append(nm, pr, b);
  return d;
}

// scroll only the shop body — scrollIntoView would also scroll .frame while
// the sheet is mid-slide (still translated offscreen), shoving the whole tank
function scrollShopTo(id) {
  const el = document.getElementById(id);
  if (el) shopBody.scrollTop = el.offsetTop - shopBody.offsetTop;
}
function renderShop() {
  shopBody.innerHTML = "";
  // anchor-chip nav across the four sections
  const SECTS = [["sect-egg", "🥚 알"], ["sect-feed", "🍞 사료"], ["sect-depth", "🌊 확장"], ["sect-skin", "🖼️ 스킨"]];
  const nav = document.createElement("div");
  nav.className = "sheetnav";
  for (const [id, label] of SECTS) {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", () => scrollShopTo(id));
    nav.appendChild(b);
  }
  shopBody.appendChild(nav);
  const sect = (title, id) => {
    const s = document.createElement("div");
    s.className = "sect";
    s.id = id;
    s.textContent = title;
    shopBody.appendChild(s);
  };
  sect("🥚 물고기 알", "sect-egg");
  for (const it of EGG_SHOP) {
    shopBody.appendChild(shopRow(it.label, it.price, "구매", () => buyEgg(it)));
    shopBody.appendChild(eggOddsRow(it.grade));
  }
  sect("🍞 사료", "sect-feed");
  for (const it of FEED_DEF) {
    const left = it.daily > 0 ? rationLeft(it) : 0;
    if (left > 0) {
      shopBody.appendChild(shopRow(
        `${it.label} ×${it.pack} (무료 ${left}/${it.daily})`, null, "받기", () => buyFeed(it)));
    } else {
      shopBody.appendChild(shopRow(`${it.label} ×${it.pack}`, it.price, "구매", () => buyFeed(it)));
    }
  }
  sect("🌊 어항 확장", "sect-depth");
  DEPTH_SHOP.forEach((it, i) => {
    const owned = S.save.depth > i;
    const locked = i > S.save.depth; // must open layer 1 before layer 2
    shopBody.appendChild(shopRow(
      `${it.label} (+8마리)`, owned ? null : it.price,
      owned ? "개방됨" : locked ? "잠김" : "구매",
      () => buyDepth(i), owned || locked));
  });
  sect("🖼️ 어항 테두리", "sect-skin");
  for (const it of FRAME_SHOP) {
    const owned = it.price === 0 || S.save.frames.includes(it.key);
    const active = S.save.frame === it.key;
    shopBody.appendChild(shopRow(it.label, owned ? null : it.price,
      active ? "적용중" : owned ? "적용" : "구매",
      () => {
        if (!owned) {
          if (S.save.gold < it.price) { toast("골드 부족"); return; }
          addGold(-it.price);
          S.save.frames.push(it.key);
          toast(`${it.label} 잠금 해제!`);
        }
        applyFrame(it.key);
      }, active));
  }
}

function dexSprite(key) {
  if (key === "jelly") return JELLY_FRAMES[0];
  if (key === "crab") return CRAB_FRAMES[0];
  if (key === "golden") return SPRITES.guppy;
  return SPRITES[key];
}

// a species' rarity tier = the lowest egg pool it appears in
const tierOf = (key) => EGG_POOLS.findIndex(p => p.some(([k]) => k === key));

function renderDex() {
  dexBody.innerHTML = "";
  const foundTotal = SPECIES_DEF.filter(d => (S.save.dex[d.key] || []).length > 0).length;
  const sum = document.createElement("div");
  sum.className = "sect";
  sum.textContent = `🔍 발견 ${foundTotal}/${SPECIES_DEF.length}`;
  dexBody.appendChild(sum);
  for (let tier = 0; tier < 4; tier++) {
    const species = SPECIES_DEF.filter(d => tierOf(d.key) === tier);
    if (!species.length) continue;
    const head = document.createElement("div");
    head.className = "sect";
    head.textContent = `${TIER_LABELS[tier]} (${species.filter(d => (S.save.dex[d.key] || []).length > 0).length}/${species.length})`;
    dexBody.appendChild(head);
    dexBody.appendChild(dexGrid(species));
  }
}

function dexGrid(defs) {
  const grid = document.createElement("div");
  grid.className = "dexgrid";
  for (const d of defs) {
    const found = (S.save.dex[d.key] || []).length > 0;
    const cell = document.createElement("div");
    cell.className = "dexcell" + (found ? "" : " undisc");
    const rows = dexSprite(d.key);
    const s = 3;
    const mc = document.createElement("canvas");
    mc.width = rows[0].length * s;
    mc.height = rows.length * s;
    const mcx = mc.getContext("2d");
    const firstIdx = (S.save.dex[d.key] || []).find(i => i >= 0);
    const pal = d.pal || FISH_PALETTES[firstIdx == null ? 0 : firstIdx];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (ch === ".") continue;
        mcx.fillStyle = !found ? "#1c2942" :
          ch === "b" ? pal.b : ch === "f" ? pal.f : ch === "d" ? pal.d :
          ch === "e" ? "#0a0e14" : "#e8f2fa";
        mcx.fillRect(c * s, r * s, s, s);
      }
    }
    const nm = document.createElement("div");
    nm.className = "dnm";
    nm.textContent = found ? KOR[d.key] : "???";
    const sub = document.createElement("div");
    sub.className = "dnm";
    sub.style.color = "#7fa3c8";
    sub.textContent = found
      ? (VARIED.includes(d.key)
        ? `색 ${(S.save.dex[d.key] || []).filter(i => i >= 0).length}/${FISH_PALETTES.length}`
        : "발견")
      : "미발견";
    cell.append(mc, nm, sub);
    if (found) {
      const pr = document.createElement("div");
      pr.className = "dnm dprice";
      pr.append(`판매 ${SELL_PRICE[d.key] || 40}`, coinImg(9));
      cell.appendChild(pr);
    }
    grid.appendChild(cell);
  }
  return grid;
}

// ---------- hatch history ----------
function recordHatch(egg, species) {
  const g = egg.grade == null ? -1 : egg.grade;
  S.save.hatchLog.unshift({ g, s: species, ts: Date.now() });
  if (S.save.hatchLog.length > 60) S.save.hatchLog.length = 60; // keep the last 60
  persist();
  toast(`${g >= 0 ? GRADE_NAMES[g] : "알"} 부화 → ${KOR[species]}!`);
}

function eggIcon(grade, size) {
  const pal = EGG_PALS[grade] || EGG_PALS[0];
  const c = document.createElement("canvas");
  c.className = "eggico";
  const s = size || 2;
  c.width = 5 * s; c.height = EGG_ROWS.length * s;
  const g = c.getContext("2d");
  for (let r = 0; r < EGG_ROWS.length; r++) {
    for (let col = 0; col < 5; col++) {
      const ch = EGG_ROWS[r][col];
      if (ch === ".") continue;
      g.fillStyle = pal[ch];
      g.fillRect(col * s, r * s, s, s);
    }
  }
  return c;
}

function renderLog() {
  logBody.innerHTML = "";
  if (Array.isArray(S.save.log) && S.save.log.length) {
    const es = document.createElement("div");
    es.className = "sect";
    es.textContent = "📋 이벤트 기록";
    logBody.appendChild(es);
    for (const ev of S.save.log.slice(-20).reverse()) {
      const d = document.createElement("div");
      d.className = "odds evrow";
      const msg = document.createElement("span");
      msg.textContent = ev.m;
      const when = document.createElement("span");
      when.className = "evwhen";
      when.textContent = ev.ts ? fmtWhen(ev.ts) : "";
      d.append(msg, when);
      logBody.appendChild(d);
    }
  }
  const s = document.createElement("div");
  s.className = "sect";
  s.textContent = `🐣 부화 기록 (최근 ${Math.min(S.save.hatchLog.length, 60)}건)`;
  logBody.appendChild(s);
  if (!S.save.hatchLog.length) {
    const d = document.createElement("div");
    d.className = "odds";
    d.textContent = "아직 부화한 알이 없어요";
    logBody.appendChild(d);
    return;
  }
  for (const h of S.save.hatchLog) {
    const row = document.createElement("div");
    row.className = "item";
    row.appendChild(eggIcon(h.g, 2));
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = `${h.g >= 0 ? GRADE_NAMES[h.g] : "알"} → ${KOR[h.s] || h.s}`;
    const when = document.createElement("span");
    when.className = "pr";
    when.textContent = fmtWhen(h.ts);
    row.append(nm, when);
    logBody.appendChild(row);
  }
}

// selling happens from the fish popup — the popup click is the confirmation
function sellFish(f) {
  if (f.species !== "crab" && nonCrabCount() <= MIN_FISH) { toast("어항 최소 인원 — 더 팔 수 없어요"); return; }
  // crowned veterans fetch a premium — feeding them was an investment
  const price = Math.round((SELL_PRICE[f.species] || 40) * (isCrowned(f) ? 1.5 : 1));
  dropFood(f);
  fishes.splice(fishes.indexOf(f), 1);
  addGold(price);
  toast(`${f.customName || KOR[f.species]} 판매 +${price}🪙`);
  log(`${f.customName || KOR[f.species]} 판매 +${price}골드`);
  for (let k = 0; k < 4; k++) {
    coins.push({ x: f.x + rnd(-4, 4), y: f.y + rnd(-3, 3), vy: -rnd(0.1, 0.3), life: rnd(500, 900), ghost: true });
  }
  for (let k = 0; k < 6; k++) {
    bubbles.push({ x: f.x + rnd(-3, 3), y: f.y + rnd(-3, 3), r: 1, ph: rnd(0, 6) });
  }
}

// ---------- toolbar (hover-reveal) + side sheet ----------
const logBody = document.getElementById("logBody");
S.sheetOpen = null;
S.tbTimer = 0;
function toolbarPinned() {
  return S.sheetOpen || S.popupFish || toolbarEl.matches(":hover");
}
function resetTbTimer() {
  clearTimeout(S.tbTimer);
  S.tbTimer = setTimeout(() => {
    if (toolbarPinned()) { resetTbTimer(); return; }
    toolbarEl.classList.remove("show");
  }, 2500);
}
function showToolbar() {
  toolbarEl.classList.add("show");
  resetTbTimer();
}
frameEl.addEventListener("mousemove", showToolbar);

const SHEET_TITLES = { shop: "🏪 상점", dex: "📖 도감", log: "📜 기록" };
function openSheet(which) {
  S.sheetOpen = which;
  sheetEl.classList.add("open");
  sheetTitleEl.textContent = SHEET_TITLES[which];
  shopBody.classList.toggle("hidden", which !== "shop");
  dexBody.classList.toggle("hidden", which !== "dex");
  logBody.classList.toggle("hidden", which !== "log");
  ({ shop: renderShop, dex: renderDex, log: renderLog })[which]();
  closeFishPopup();
  showToolbar();
}
function closeSheet() {
  S.sheetOpen = null;
  sheetEl.classList.remove("open");
}
document.querySelectorAll(".menubtns [data-sheet]").forEach((b) =>
  b.addEventListener("click", () => openSheet(b.dataset.sheet)));
document.getElementById("sheetClose").addEventListener("click", closeSheet);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (S.popupFish) { closeFishPopup(); return; }
  if (S.sheetOpen) closeSheet();
});
cv.addEventListener("mousedown", () => { if (S.sheetOpen) closeSheet(); });

// ---------- actions ----------
function renderFeedBar() {
  feedbarEl.innerHTML = "";
  const lab = document.createElement("span");
  lab.className = "feedlab";
  lab.textContent = "🍞 먹이";
  lab.title = "물을 클릭하면 선택한 사료를 뿌립니다";
  feedbarEl.appendChild(lab);
  FEED_DEF.forEach((fd, i) => {
    const b = document.createElement("button");
    b.className = S.feedArmed && i === S.feedTier ? "on" : "";
    b.title = `${fd.label} — 물 클릭으로 급여 (남은 ${S.save.feed[fd.key] || 0}알)`;
    const dot = document.createElement("span");
    dot.className = "fdot";
    dot.style.background = fd.col[0];
    b.append(dot, fd.label.replace(" 사료", ""), " ");
    const cnt = document.createElement("span");
    cnt.className = "cnt";
    cnt.textContent = `${S.save.feed[fd.key] || 0}`;
    b.appendChild(cnt);
    b.addEventListener("click", () => {
      if ((S.save.feed[fd.key] || 0) <= 0) {
        // out of stock: deep-link to the feed section of the shop
        openSheet("shop");
        scrollShopTo("sect-feed");
        return;
      }
      if (S.feedArmed && S.feedTier === i) {
        S.feedArmed = false; // second press disarms back to select mode
      } else {
        S.feedTier = i;
        S.feedArmed = true;
        toast("물을 클릭하면 먹이를 줘요 — 버튼을 다시 누르면 해제");
      }
      renderFeedBar();
    });
    feedbarEl.appendChild(b);
  });
  wrap.classList.toggle("feeding", S.feedArmed);
}

function feed(px) {
  const fd = FEED_DEF[S.feedTier];
  const stock = S.save.feed[fd.key] || 0;
  if (stock <= 0) { toast(`${fd.label}가 없어요 — 상점에서 구매하세요`); return; }
  const n = Math.min(stock, ri(3, 5));
  S.save.feed[fd.key] = stock - n;
  persist();
  renderFeedBar();
  const inJail = px !== undefined && px < JAIL.right + 3;
  for (let i = 0; i < n; i++) {
    const fx = inJail
      ? Math.max(JAIL.x + 3, Math.min(JAIL.right - 3, px + rnd(-4, 4))) // meal drop for the inmates
      : Math.max(JAIL.right + 6, (px ?? rnd(30, W - 30)) + rnd(-8, 8));
    flakes.push({
      x: fx, y: rnd(2, 8),
      vy: rnd(0.38, 0.48), life: 1400,
      claims: 0, maxClaims: ri(1, 2), grounded: false, tier: S.feedTier,
    });
  }
}
function nonCrabCount() { return fishes.filter(f => f.species !== "crab").length; }

function summonShark() {
  if (S.shark) return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  S.shark = { x: dir === 1 ? -30 : W + 30, y: rnd(30, 70), dir };
  log("🦈 거대 상어 출현 — 물고기들이 흩어져요");
}

// ---------- S.raid ----------
function startRaid() {
  closeFishPopup();
  S.raid = { phase: "warn", timer: RAID_WARN_MS, boss: null, rallyCd: 0, retreat: 0 };
}

// click command: synchronized all-out charge
function rallyStrike(mx, my) {
  const b = S.raid.boss;
  S.raid.rallyCd = 4000;
  rings.push({ x: mx, y: my, r: 2, life: 600, col: "#46d8ff" });
  const braves = fishes.filter(f =>
    !SAND_DWELLERS.includes(f.species) && f.species !== "jelly" && f.knock <= 0 && !f.jail && !f.dragged);
  for (const f of braves) {
    f.aggro = true;
    f.aggroT = rnd(1400, 2200);
    f.aggroY = rnd(-7, 7);
    f.dir = f.x < b.x ? 1 : -1;
    f.thrust = 2.4;
    f.burstT = rnd(300, 700);
  }
  if (braves.filter(f => Math.hypot(f.x - b.x, f.y - b.y) < 55).length >= 3) bossHit(2);
}

// click command: early mantis punch at extended range
function mantisSortie() {
  const b = S.raid.boss;
  if (b.mcd <= 0 && Math.abs(b.x - (CHEST.x + 6)) < 36 && b.y > 40) {
    MANTIS.dir = b.x >= CHEST.x + 6 ? 1 : -1;
    MANTIS.show = 1100;
    CHEST.openT = Math.max(CHEST.openT, 1100);
    b.kvx = MANTIS.dir * 2.2;
    b.ty = Math.max(24, b.y - 18);
    b.mcd = 4200;
    bossHit(3);
  } else {
    CHEST.openT = Math.max(CHEST.openT, 300); // lid rattles: on cooldown or out of reach
  }
}

function bossHit(dmg) {
  const b = S.raid.boss;
  b.hp -= dmg;
  for (let k = 0; k < 4 + dmg * 2; k++) {
    bubbles.push({ x: b.x + rnd(-9, 9), y: b.y + rnd(-6, 6), r: Math.random() < 0.5 ? 1 : 2, ph: rnd(0, 6) });
  }
  if (b.hp <= 0) raidWin();
}

function endPass(b) {
  b.passes++;
  b.ty = rnd(30, 66);
  if (b.passes >= 6) raidFail();
}

function raidWin() {
  const b = S.raid.boss;
  S.raid.phase = "flee";
  b.dir = b.x < W / 2 ? -1 : 1;
  // coin rain
  for (let k = 0; k < 16; k++) {
    coins.push({ x: rnd(12, W - 12), y: rnd(-14, 0), vy: rnd(0.05, 0.2), life: rnd(1600, 2800) });
  }
  // one bounty egg drifts down — 35% legendary
  dropGradeEgg(Math.random() < 0.35 ? 2 : 0, rnd(40, 150), 26, rnd(20000, 32000));
  addGold(50); // S.raid victory bounty
  log("🦈 레이드 승리 — 보상 알과 +50골드");
  // the whole tank celebrates
  for (const f of fishes) {
    hearts.push({ x: f.x, y: f.y - 5, life: rnd(900, 1600) });
    f.ate++;
    f.lastAte = Date.now();
  }
}

function raidFail() {
  const b = S.raid.boss;
  let victim = null, bd = 1e9;
  for (const f of fishes) {
    if (SAND_DWELLERS.includes(f.species) || f.species === "jelly" || f.inflated || f.jail || f.dragged) continue;
    const d = Math.hypot(f.x - b.x, f.y - b.y);
    if (d < bd) { bd = d; victim = f; }
  }
  if (victim) {
    log(`🦈 레이드 실패 — ${victim.customName || KOR[victim.species]}을(를) 잃었어요`);
    dropFood(victim);
    fishes.splice(fishes.indexOf(victim), 1);
    for (let k = 0; k < 10; k++) {
      bubbles.push({ x: victim.x + rnd(-4, 4), y: victim.y + rnd(-3, 3), r: Math.random() < 0.5 ? 1 : 2, ph: rnd(0, 6) });
    }
    if (nonCrabCount() < MIN_FISH) {
      setTimeout(() => {
        if (nonCrabCount() >= MIN_FISH) return;
        let nf; do { nf = makeFish(); } while (nf.species === "crab");
        addFish(nf);
      }, 8000);
    }
  }
  S.raid.phase = "flee";
  b.dir = b.x < W / 2 ? -1 : 1;
}

function updateBoss(dt) {
  const b = S.raid.boss;
  b.hitCd -= dt; b.mcd -= dt; b.jcd -= dt; b.scd -= dt; b.bitCd -= dt;
  if (b.stun > 0) {
    b.stun -= dt;
  } else {
    const slow = 0.6 + (b.hp / BOSS_HP) * 0.4; // wounded boss swims slower
    b.x += (b.dir * 0.5 * slow + b.kvx) * dt * 0.06;
    b.kvx *= 1 - 0.002 * dt;
    b.y += ((b.ty - b.y) * 0.0005 + Math.sin(S.t * 0.004) * 0.01) * dt * 0.6;
    b.y = Math.max(22, Math.min(S.SAND_Y - 26, b.y));
  }
  if (b.x < 16 && b.dir === -1) { b.x = 16; b.dir = 1; endPass(b); }
  if (b.x > W - 16 && b.dir === 1) { b.x = W - 16; b.dir = -1; endPass(b); }
  if (!S.raid || S.raid.phase !== "fight") return;

  // bite: shoves a fish aside (stun + ragdoll, no kill mid-fight)
  if (b.bitCd <= 0) {
    const mx = b.x + b.dir * 14;
    for (const f of fishes) {
      if (SAND_DWELLERS.includes(f.species) || f.knock > 0 || f.jail || f.dragged) continue;
      if (Math.abs(f.x - mx) < 9 && Math.abs(f.y - b.y) < 8) {
        f.knock = 2600;
        f.kvx = (f.x >= b.x ? 1 : -1) * rnd(1.6, 2.4);
        f.kvy = rnd(-1.6, -0.6);
        dropFood(f);
        b.bitCd = 1800;
        break;
      }
    }
  }
  // inflated puffer = spike trap
  if (b.hitCd <= 0) {
    for (const f of fishes) {
      if (f.species !== "puffer" || !f.inflated) continue;
      if (Math.abs(f.x - b.x) < 16 && Math.abs(f.y - b.y) < 10) {
        bossHit(2);
        if (!S.raid || S.raid.phase !== "fight") return;
        b.dir *= -1;
        b.kvx = (b.x < f.x ? -1 : 1) * 1.6;
        b.hitCd = 1400;
        break;
      }
    }
  }
  // jelly sting paralyzes
  if (b.jcd <= 0) {
    for (const f of fishes) {
      if (f.species !== "jelly") continue;
      if (Math.abs(f.x - b.x) < 10 && Math.abs(f.y - b.y) < 8) { b.stun = 1000; b.jcd = 5000; break; }
    }
  }
  // mantis turret guards its chest
  if (b.mcd <= 0 && Math.abs(b.x - (CHEST.x + 6)) < 24 && b.y > 52) {
    MANTIS.dir = b.x >= CHEST.x + 6 ? 1 : -1;
    MANTIS.show = 1100;
    CHEST.openT = Math.max(CHEST.openT, 1100);
    b.kvx = MANTIS.dir * 2.2;
    b.ty = Math.max(24, b.y - 18);
    b.mcd = 4200;
    bossHit(3);
    if (!S.raid || S.raid.phase !== "fight") return;
  }
  // school ram: brave cluster charges together
  if (b.scd <= 0) {
    const braves = fishes.filter(f =>
      !SAND_DWELLERS.includes(f.species) && f.species !== "jelly" && f.knock <= 0 &&
      !f.jail && !f.dragged && Math.hypot(f.x - b.x, f.y - b.y) < 42);
    if (braves.length >= 4) {
      for (const f of braves) {
        f.dir = f.x < b.x ? 1 : -1;
        f.thrust = 2.2;
        f.burstT = rnd(400, 900);
      }
      bossHit(1);
    }
    b.scd = 2600;
  }
}
function applyNightByClock() {
  const h = new Date().getHours();
  S.night = h >= 19 || h < 7;
}
applyNightByClock();
setInterval(applyNightByClock, 60000);
function openChest() {
  if (CHEST.cooldown > 0) { return; }
  CHEST.openT = 3000;
  CHEST.cooldown = 12000;
  const loot = ri(3, 9);
  for (let i = 0; i < loot; i++) {
    coins.push({ x: CHEST.x + 6 + rnd(-3, 3), y: CHEST.y, vy: -rnd(0.15, 0.35), life: rnd(600, 1100) });
  }
  for (let i = 0; i < 5; i++) bubbles.push({ x: CHEST.x + 6 + rnd(-4, 4), y: CHEST.y, r: 1, ph: rnd(0, 6) });
  toast(`보물상자 +${loot}🪙`);
  log(`보물상자에서 ${loot}골드 획득`);
}

// ---------- naming (affection) ----------
const wrap = document.querySelector(".tankwrap");
S.nameInput = null;
function openNameInput(f) {
  if (S.nameInput) S.nameInput.remove();
  const inp = document.createElement("input");
  inp.className = "name-input";
  inp.maxLength = 12;
  inp.value = f.customName || "";
  inp.placeholder = "이름 지어주기";
  const r = cv.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  inp.style.left = (f.x / W * r.width + (r.left - wr.left)) + "px";
  inp.style.top = (f.y / S.H * r.height + (r.top - wr.top) - 10) + "px";
  wrap.appendChild(inp);
  S.nameInput = inp;
  inp.focus();
  let done = false;
  const close = (commit) => {
    if (done) return;
    done = true;
    if (commit && inp.value.trim()) {
      f.customName = inp.value.trim();
      hearts.push({ x: f.x, y: f.y - 6, life: 1400 });
    }
    inp.remove();
    if (S.nameInput === inp) S.nameInput = null;
  };
  inp.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") close(true);
    if (ev.key === "Escape") close(false);
  });
  inp.addEventListener("blur", () => close(true));
}

const nameTags = new Map();
function updateNameTags() {
  const r = cv.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  const seen = new Set();
  for (const f of fishes) {
    if (!f.customName) continue;
    seen.add(f);
    let tag = nameTags.get(f);
    if (!tag) {
      const el = document.createElement("div");
      el.className = "name-tag";
      wrap.appendChild(el);
      tag = { el, x: f.x, y: f.y };
      nameTags.set(f, tag);
    }
    // drift lazily after the fish, like text floating in water
    tag.x += (f.x - tag.x) * 0.06;
    tag.y += (f.y - tag.y) * 0.06;
    tag.el.textContent = f.customName;
    tag.el.style.left = (tag.x / W * r.width + (r.left - wr.left)) + "px";
    tag.el.style.top = (tag.y / S.H * r.height + (r.top - wr.top) - 8) + "px";
  }
  for (const [f, tag] of nameTags) {
    if (!seen.has(f)) { tag.el.remove(); nameTags.delete(f); }
  }
}

// ---------- drag & jail ----------
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { mx: (e.clientX - r.left) / r.width * W, my: (e.clientY - r.top) / r.height * S.H };
}

function imprison(f) {
  if (SLOW_GIANTS.includes(f.species)) return false; // doesn't fit through the door
  const slot = JAIL.slots.findIndex(s => s === null);
  if (slot === -1) return false; // jail full
  JAIL.slots[slot] = f;
  f.jail = { slot, total: 0, sentence: 0 };
  f.jail.total = f.jail.sentence = rnd(60000, 120000);
  f.knock = 0;
  dropFood(f);
  return true;
}

S.dragFish = null, S.dragMoved = 0, S.suppressClick = false;
cv.addEventListener("mousedown", (e) => {
  const { mx, my } = toLogical(e);
  let best = null, bd = 8;
  for (const f of fishes) {
    if (f.jail) continue;
    const d = Math.hypot(f.x - mx, f.y - my);
    if (d < bd) { bd = d; best = f; }
  }
  if (best) {
    S.dragFish = best;
    best.dragged = true;
    best.knock = 0;
    S.dragMoved = 0;
    dropFood(best);
  }
});
cv.addEventListener("mousemove", (e) => {
  if (!S.dragFish) return;
  const { mx, my } = toLogical(e);
  S.dragMoved += Math.abs(mx - S.dragFish.x) + Math.abs(my - S.dragFish.y);
  S.dragFish.x = Math.max(4, Math.min(W - 4, mx));
  S.dragFish.y = Math.max(6, Math.min(S.SAND_Y - 3, my));
});
function endDrag(e) {
  if (!S.dragFish) return;
  const f = S.dragFish;
  S.dragFish = null;
  f.dragged = false;
  if (S.dragMoved > 5) S.suppressClick = true;
  const inJail = f.x < JAIL.right + 3 && f.y > JAIL.top - 4;
  if (inJail && imprison(f)) {
    for (let k = 0; k < 4; k++) bubbles.push({ x: f.x, y: f.y, r: 1, ph: rnd(0, 6) });
    return;
  }
  // released (or jail full/whale): little splash, swims off
  f.knock = 500;
  f.kvx = rnd(-0.6, 0.6) + (inJail ? 1.2 : 0); // bounced off a full jail
  f.kvy = rnd(-0.4, 0.2);
  for (let k = 0; k < 3; k++) bubbles.push({ x: f.x, y: f.y, r: 1, ph: rnd(0, 6) });
}
cv.addEventListener("mouseup", endDrag);
cv.addEventListener("mouseleave", endDrag);

// ---------- fish context popup ----------
S.popupFish = null;
S.swallowNextClick = false;
function closeFishPopup() {
  S.popupFish = null;
  popupEl.classList.add("hidden");
}
function popupSprite(f) {
  const rows = dexSprite(f.species);
  const s = 2;
  const mc = document.createElement("canvas");
  mc.width = rows[0].length * s;
  mc.height = rows.length * s;
  const g = mc.getContext("2d");
  const pal = f.pal || FISH_PALETTES[f.palIdx || 0] || FISH_PALETTES[0];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === ".") continue;
      g.fillStyle = ch === "b" ? pal.b : ch === "f" ? pal.f : ch === "d" ? pal.d :
        ch === "e" ? "#0a0e14" : "#e8f2fa";
      g.fillRect(c * s, r * s, s, s);
    }
  }
  return mc;
}
function openFishPopup(f) {
  S.popupFish = f;
  popupEl.innerHTML = "";
  const head = document.createElement("div");
  head.className = "phead";
  head.append(popupSprite(f), `${f.customName || KOR[f.species]}${isCrowned(f) ? " 👑" : ""}`);
  const sat = document.createElement("div");
  sat.className = "prow";
  sat.append(document.createTextNode("포만감"), document.createTextNode(`${Math.round(f.sat)}/100`));
  const bar = document.createElement("div");
  bar.className = "pbar";
  const fill = document.createElement("i");
  fill.style.width = Math.max(0, Math.min(100, Math.round(f.sat))) + "%";
  bar.appendChild(fill);
  const crown = document.createElement("div");
  crown.className = "prow";
  crown.append(document.createTextNode("왕관"),
    document.createTextNode(isCrowned(f) ? "👑 달성" : `${f.ate}/${CROWN_AT}`));
  const btns = document.createElement("div");
  btns.className = "pbtns";
  const price = Math.round((SELL_PRICE[f.species] || 40) * (isCrowned(f) ? 1.5 : 1));
  const sellB = document.createElement("button");
  sellB.append(`판매 +${price}`, coinImg(9));
  sellB.addEventListener("click", () => { closeFishPopup(); sellFish(f); });
  const nameB = document.createElement("button");
  nameB.textContent = "이름";
  if (f.ate >= LOVE_AT && !f.customName) nameB.classList.add("pulse");
  nameB.addEventListener("click", () => { closeFishPopup(); openNameInput(f); });
  const jailB = document.createElement("button");
  jailB.textContent = "감옥";
  if (SLOW_GIANTS.includes(f.species)) { jailB.disabled = true; jailB.title = "감옥 문보다 커요"; }
  jailB.addEventListener("click", () => {
    closeFishPopup();
    if (imprison(f)) {
      for (let k = 0; k < 4; k++) bubbles.push({ x: f.x, y: f.y, r: 1, ph: rnd(0, 6) });
    } else {
      toast("감옥이 가득 찼어요");
    }
  });
  btns.append(sellB, nameB, jailB);
  popupEl.append(head, sat, bar, crown, btns);
  popupEl.classList.remove("hidden");
  // anchor once near the fish (no tracking), clamped inside the tank; flip below when cramped
  const r = cv.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  const fx = f.x / W * r.width + (r.left - wr.left);
  const fy = f.y / S.H * r.height + (r.top - wr.top);
  let left = fx - popupEl.offsetWidth / 2;
  let top = fy - popupEl.offsetHeight - 10;
  if (top < 4) top = fy + 12;
  left = Math.max(4, Math.min(wr.width - popupEl.offsetWidth - 4, left));
  top = Math.max(4, Math.min(wr.height - popupEl.offsetHeight - 4, top));
  popupEl.style.left = left + "px";
  popupEl.style.top = top + "px";
}
// outside click closes the popup; that same click must not feed
document.addEventListener("mousedown", (e) => {
  if (!S.popupFish) return;
  if (popupEl.contains(e.target)) return;
  closeFishPopup();
  if (e.target === cv) S.swallowNextClick = true;
});
// fish gone (sold / eaten / S.raid casualty): drop the card
setInterval(() => { if (S.popupFish && !fishes.includes(S.popupFish)) closeFishPopup(); }, 500);

cv.addEventListener("click", (e) => {
  if (S.suppressClick) { S.suppressClick = false; return; }
  if (S.swallowNextClick) { S.swallowNextClick = false; return; }
  const r = cv.getBoundingClientRect();
  const mx = (e.clientX - r.left) / r.width * W;
  const my = (e.clientY - r.top) / r.height * S.H;
  // during a S.raid fight, clicks are battle commands
  if (S.raid && S.raid.phase === "fight") {
    const b = S.raid.boss;
    if (mx >= CHEST.x - 2 && mx <= CHEST.x + CHEST.w + 2 && my >= CHEST.y - 3 && my <= CHEST.y + CHEST.h + 2) {
      mantisSortie();
      return;
    }
    if (Math.hypot(mx - b.x, my - b.y) < 60) {
      if (S.raid.rallyCd <= 0) rallyStrike(mx, my);
      return;
    }
    S.raid.retreat = 2000; // far click: scatter, dodge the next bite
    rings.push({ x: mx, y: my, r: 2, life: 600, col: "#e8f2fa" });
    return;
  }
  if (mx >= CHEST.x - 2 && mx <= CHEST.x + CHEST.w + 2 && my >= CHEST.y - 3 && my <= CHEST.y + CHEST.h + 2) {
    openChest();
    return;
  }
  // clicking a fish opens its context card; clicking water feeds
  let best = null, bd = 7;
  for (const f of fishes) {
    if (f.jail || f.dragged) continue;
    const d = Math.hypot(f.x - mx, f.y - my);
    if (d < bd) { bd = d; best = f; }
  }
  if (best) { openFishPopup(best); return; }
  // water clicks feed only while a feed button is armed; otherwise it's select mode
  if (S.feedArmed) feed(mx);
});

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
S.lastT = performance.now();

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

// ---------- boot ----------
document.getElementById("goldChip").prepend(coinImg(13));
renderGold();
renderShop();
renderDex();
renderFeedBar();
showToolbar(); // visible once on load so newcomers learn it exists
// crowns fade when a senior fish goes unfed too long
setInterval(() => {
  const now = Date.now();
  for (const f of fishes) {
    if (!isCrowned(f)) continue;
    if (now - (f.lastAte || now) > CROWN_KEEP) {
      f.ate = CROWN_AT - 3;
      f.lastAte = now;
      toast(`${f.customName || KOR[f.species]} 왕관이 빛을 잃었어요 — 먹이 3번이면 되찾아요`);
      log(`${f.customName || KOR[f.species]} 왕관 소멸`);
    }
  }
}, 5000);
// reopen daily rations if the tank is left running past local midnight
S.shopDate = todayStr();
setInterval(() => {
  if (todayStr() !== S.shopDate) { S.shopDate = todayStr(); renderShop(); }
}, 60000);
if (S.save.frame && (S.save.frames.includes(S.save.frame) || S.save.frame === "")) applyFrame(S.save.frame);
// restore the saved tank; fall back to a fresh one
S.restored = false;
if (Array.isArray(S.save.fish) && S.save.fish.length) {
  for (const sf of S.save.fish) {
    if (fishes.length >= S.CAP) break;
    if (!SPECIES_DEF.some(d => d.key === sf.s)) continue;
    const f = makeFish(sf.s);
    if (sf.p >= 0 && FISH_PALETTES[sf.p]) { f.palIdx = sf.p; f.pal = FISH_PALETTES[sf.p]; }
    if (sf.n) f.name = sf.n;
    if (sf.c) f.customName = sf.c;
    f.ate = sf.a || 0;
    f.lastAte = sf.la || Date.now(); // legacy saves get a fresh grace window
    f.sat = Math.max(0, Math.min(100, sf.st || 0));
    f.dietTier = FEED_DEF[sf.dt] ? sf.dt : 0;
    if (typeof sf.x === "number") f.x = Math.max(4, Math.min(W - 4, sf.x));
    if (typeof sf.y === "number" && !SAND_DWELLERS.includes(sf.s)) {
      f.y = Math.max(10, Math.min(S.SAND_Y - 8, sf.y));
    }
    addFish(f);
    S.restored = true;
  }
  for (const se of S.save.eggs || []) {
    if (fishes.length + eggs.length >= S.CAP) break;
    const x = typeof se.x === "number" ? se.x : rnd(40, 140);
    const y = typeof se.y === "number" ? se.y : 8;
    const hatch = Math.max(3000, se.h || 15000);
    if (se.g != null && se.g >= 0 && EGG_POOLS[se.g]) {
      dropGradeEgg(se.g, x, y, hatch);
      continue;
    }
    // legacy species-fixed egg from an old S.save
    const def = SPECIES_DEF.find(d => d.key === se.s);
    if (!def) continue;
    const pal = se.p >= 0 && FISH_PALETTES[se.p] ? FISH_PALETTES[se.p] : (def.pal || FISH_PALETTES[0]);
    eggs.push({ x, y, hatch, species: se.s, pal, palIdx: se.p });
  }
}
if (!S.restored) {
  addFish(makeFish("crab"));   // ferris always ships
  addFish(makeFish("jelly"));
  addFish(makeFish("puffer"));
  while (nonCrabCount() < MIN_FISH + 1) {
    let nf; do { nf = makeFish(); } while (nf.species === "crab");
    addFish(nf);
  }
  // first-run guide: introduce the core loop one toast at a time
  [
    "🖱️ 마우스를 움직이면 아래에 메뉴가 나타나요",
    "🍞 먹이 버튼을 누른 뒤 물을 클릭하면 먹이를 줘요",
    "🐟 물고기를 클릭하면 정보 카드가 열려요 — 이름짓기·판매·감옥",
    "📦 보물상자를 클릭하면 골드가 나와요",
  ].forEach((m, i) => setTimeout(() => toast(m, true), 1500 + i * 3500));
}
persistNow();
requestAnimationFrame(loop);


export { MANTIS, SAND_DWELLERS, SLOW_GIANTS, startRaid, updateBoss, summonShark, nonCrabCount, makeFish, addFish, rollEggGrade, dropGradeEgg, BREED_SAT, rollEggSpecies, recordHatch, LOVE_AT, CROWN_AT, log, toast, addGold };
