// @ts-nocheck — mechanical port from the single-file build; typing is a follow-up pass
import { S } from "./state";
import { FISH_PALETTES, MIN_FISH, NAMES } from "./palette";
import { SPRITES, JELLY_FRAMES, CRAB_FRAMES, SHARK_SPRITE, SHARK_PAL, MANTIS_SPRITE, MANTIS_PAL, SPECIES_DEF, DEEP_REQ, EGG_ROWS, EGG_PALS, COIN_ROWS, COIN_COLORS } from "./sprites";
import { KOR, VARIED, FEED_DEF, EGG_SHOP, EGG_POOLS, BREED_EGG_ODDS, SELL_PRICE, DEX_BONUS, FRAME_SHOP, DEPTH_SHOP, GRADE_COLORS, TIER_LABELS, GRADE_NAMES } from "./economy";
import { W, BASE_H, BASE_SAND, LAYER_H, MAX_DEPTH, cv, cx, reduced } from "./canvas";
import { rnd, ri, todayStr, fmtWhen } from "./utils";
import { px, drawWater, drawSand, drawPlant, drawRocks, drawSprite, drawEgg, drawFish, drawShark, drawRaid, drawJailBack, drawJailFront, drawCoins, drawChest } from "./draw";

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

// ---------- update ----------
function dropFood(f) {
  if (f.food && f.food.life > 0) f.food.claims--;
  f.food = null;
}

// pick the nearest unclaimed flake within range (grounded ones included —
// a fish beats the crab to fresh crumbs; anything left still fades or feeds ferris)
function claimFlake(f, range) {
  let bd = range, pick = null;
  for (const fl of flakes) {
    if (fl.life <= 0 || fl.claims >= fl.maxClaims) continue;
    if (fl.x < JAIL.right + 5) continue; // jail meals belong to the inmates — the wall blocks outsiders
    // grounded crumbs count as closer than they are, so floor cleanup wins ties
    const d = Math.hypot(fl.x - f.x, fl.y - f.y) * (fl.grounded ? 0.6 : 1);
    if (d < bd) { bd = d; pick = fl; }
  }
  if (pick) {
    f.food = pick;
    pick.claims++;
    f.chaseT = 0;
    // lunge: instant burst of speed toward the flake
    f.thrust = 2.6;
    f.burstT = rnd(250, 450);
  }
  return pick;
}

function eat(f, fl) {
  fl.life = 0;
  f.ate++;
  f.lastAte = Date.now();
  f.sat = Math.min(100, f.sat + FEED_DEF[fl.tier || 0].sat);
  f.dietTier = fl.tier || 0;
  if (f.ate >= LOVE_AT) hearts.push({ x: f.x, y: f.y - 5, life: 1100 });
  if (f.ate === CROWN_AT) {
    log(`${f.customName || KOR[f.species]} 왕관 획득 👑`);
    toast(`${f.customName || KOR[f.species]} 왕관 획득 👑 — 판매 +50%, 번식 강화`);
  }
  f.food = null;
  f.retarget = 0;
  // still more food in the water? chain straight to the next bite
  if (!f.jail && !SAND_DWELLERS.includes(f.species) && f.species !== "jelly") claimFlake(f, 150);
}

function update(dt) {
  S.t += dt;
  const nightMul = S.night ? 0.5 : 1;

  // S.raid state machine
  if (!S.raid) {
    S.raidTimer -= dt;
    if (S.raidTimer <= 0 && fishes.length >= 8 && !S.shark) startRaid();
  } else if (S.raid.phase === "warn") {
    S.raid.timer -= dt;
    if (S.raid.timer <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      S.raid.boss = {
        x: dir === 1 ? -30 : W + 30, y: 45, ty: rnd(32, 64), dir,
        hp: BOSS_HP, passes: 0, stun: 0, kvx: 0,
        hitCd: 0, mcd: 2000, jcd: 0, scd: 2500, bitCd: 1000,
      };
      S.raid.phase = "fight";
    }
  } else if (S.raid.phase === "fight") {
    S.raid.rallyCd -= dt;
    S.raid.retreat -= dt;
    updateBoss(dt);
  } else if (S.raid.phase === "flee") {
    const b = S.raid.boss;
    b.x += b.dir * 1.8 * dt * 0.06;
    if (b.x < -45 || b.x > W + 45) {
      S.raid = null;
      S.raidTimer = rnd(140000, 280000);
    }
  }
  S.raidDark += (((S.raid && S.raid.phase !== "flee") ? 1 : 0) - S.raidDark) * 0.0012 * dt;
  const threat = S.raid && S.raid.phase === "fight" ? S.raid.boss : S.shark;
  const fleeR = S.raid && S.raid.phase === "fight" ? 26 : 75;

  // S.shark event (paused during raids)
  if (!S.raid) S.sharkTimer -= dt;
  if (!S.raid && !S.shark && S.sharkTimer <= 0) { summonShark(); }
  if (S.shark) {
    S.shark.x += S.shark.dir * (reduced ? 0.4 : 0.75) * dt * 0.06;
    S.shark.y += Math.sin(S.t * 0.005) * 0.03 * dt * 0.06;
    // first fish caught in the mouth gets eaten (one per visit)
    if (!S.shark.fed) {
      const mx = S.shark.x + S.shark.dir * 9;
      for (let i = 0; i < fishes.length; i++) {
        const f = fishes[i];
        if (SAND_DWELLERS.includes(f.species) || f.species === "jelly" || f.jail || f.dragged) continue;
        if (f.inflated) continue; // spikes: inflated puffer is inedible
        if (Math.abs(f.x - mx) < 7 && Math.abs(f.y - S.shark.y) < 5) {
          dropFood(f);
          fishes.splice(i, 1);
          S.shark.fed = true;
          for (let k = 0; k < 10; k++) {
            bubbles.push({ x: f.x + rnd(-4, 4), y: f.y + rnd(-3, 3), r: Math.random() < 0.5 ? 1 : 2, ph: rnd(0, 6) });
          }
          if (nonCrabCount() < MIN_FISH) {
            setTimeout(() => {
              if (nonCrabCount() >= MIN_FISH) return;
              let nf; do { nf = makeFish(); } while (nf.species === "crab");
              addFish(nf);
            }, 8000);
          }
          break;
        }
      }
    }
    if (S.shark.x < -35 || S.shark.x > W + 35) {
      S.shark = null;
      S.sharkTimer = rnd(60000, 150000);
    }
  }

  // mantis shrimp guards the chest: punches anything that swims too close
  // (during a S.raid fight it saves its punches for the boss; while a S.shark
  // hunts it holds fire — a knocked-out fish is S.shark food)
  MANTIS.cool -= dt;
  if (MANTIS.show > 0) MANTIS.show -= dt;
  if (MANTIS.cool <= 0 && !S.shark && (!S.raid || S.raid.phase === "warn")) {
    for (const f of fishes) {
      if (SAND_DWELLERS.includes(f.species) || f.knock > 0 || f.jail || f.dragged) continue;
      if (Math.abs(f.x - (CHEST.x + 6)) < 13 && f.y > CHEST.y - 15) {
        MANTIS.dir = f.x >= CHEST.x + 6 ? 1 : -1;
        MANTIS.cool = 5000;
        MANTIS.show = 1000;
        CHEST.openT = Math.max(CHEST.openT, 1000);
        const power = rnd(2.8, 3.8);
        const ang = rnd(-2.2, -0.9); // launch upward-ish
        f.knock = 3200;
        f.kvx = Math.cos(ang) * power * MANTIS.dir;
        f.kvy = Math.sin(ang) * power;
        dropFood(f);
        f.inflated = f.species === "puffer"; // puffer panics
        for (let k = 0; k < 6; k++) {
          bubbles.push({ x: f.x + rnd(-2, 2), y: f.y + rnd(-2, 2), r: 1, ph: rnd(0, 6) });
        }
        break;
      }
    }
  }

  // breeding: a close same-species pair lays 1-2 eggs
  S.breedT -= dt;
  if (S.breedT <= 0) {
    S.breedT = rnd(25000, 50000);
    if (!S.raid && eggs.length === 0 && fishes.length < S.CAP - 1) {
      outer:
      for (let i = 0; i < fishes.length; i++) {
        for (let j = i + 1; j < fishes.length; j++) {
          const a = fishes[i], b = fishes[j];
          if (a.species !== b.species) continue;
          if (SAND_DWELLERS.includes(a.species) || a.species === "jelly") continue;
          if (a.jail || b.jail || a.dragged || b.dragged) continue;
          if (a.sat < BREED_SAT || b.sat < BREED_SAT) continue; // both must be well fed
          if (Math.hypot(a.x - b.x, a.y - b.y) < 24) {
            // diet of the lesser-fed parent caps the egg grade; crowns tilt the odds up
            const grade = rollEggGrade(Math.min(a.dietTier, b.dietTier),
              (isCrowned(a) ? 1 : 0) + (isCrowned(b) ? 1 : 0));
            const n = ri(1, 2);
            for (let k = 0; k < n; k++) {
              dropGradeEgg(grade, (a.x + b.x) / 2 + rnd(-4, 4), (a.y + b.y) / 2, rnd(22000, 38000));
            }
            a.sat -= BREED_SAT; b.sat -= BREED_SAT; // laying takes it out of them — feed again
            break outer;
          }
        }
      }
    }
  }
  // eggs sink to the sand, then hatch
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i];
    if (e.y < S.SAND_Y - 3) e.y += 0.04 * dt * 0.06;
    e.hatch -= dt;
    if (e.hatch <= 0) {
      eggs.splice(i, 1);
      if (fishes.length < S.CAP) {
        // graded eggs roll their species only now, at the moment of hatching
        const species = e.grade != null ? rollEggSpecies(e.grade) : e.species;
        const baby = makeFish(species);
        if (e.grade == null) {
          baby.pal = e.pal;
          if (e.palIdx != null) baby.palIdx = e.palIdx;
        }
        baby.x = e.x; baby.y = Math.min(e.y, S.SAND_Y - 12);
        if (species === "crab" || species === "starfish") baby.y = S.SAND_Y - 4;
        addFish(baby);
        recordHatch(e, species);
        for (let k = 0; k < 4; k++) bubbles.push({ x: e.x + rnd(-2, 2), y: e.y, r: 1, ph: rnd(0, 6) });
      }
    }
  }

  // occasional drifter wanders in
  S.driftT -= dt;
  if (S.driftT <= 0) {
    S.driftT = rnd(90000, 180000);
    if (!S.raid && fishes.length < 12) addFish(makeFish());
  }

  // fish
  for (const f of fishes) {
    f.retarget -= dt;

    // doing time: swim the treadmill until the sentence is served
    if (f.jail) {
      f.jail.sentence -= dt;
      const floorY = S.SAND_Y - 1 - f.jail.slot * 10;
      f.dir = 1;
      f.x = 13 + Math.sin(S.t * 0.02 + f.phase) * 0.6;
      f.y = floorY - 4 + Math.sin(S.t * 0.018 + f.phase) * 0.5;
      f.vx = 0;
      if (Math.random() < 0.0012 * dt) bubbles.push({ x: f.x + 4, y: f.y - 3, r: 1, ph: rnd(0, 6) }); // effort bubbles
      // catches meals dropped into the cell as they fall past
      for (const fl of flakes) {
        if (fl.life <= 0) continue;
        if (Math.abs(fl.x - f.x) < 6 && Math.abs(fl.y - f.y) < 6) { eat(f, fl); break; }
      }
      if (f.jail.sentence <= 0) {
        JAIL.slots[f.jail.slot] = null;
        f.jail = null;
        f.knock = 700; f.kvx = 1.6; f.kvy = -0.5; // bursts out through the door
        hearts.push({ x: JAIL.right + 4, y: floorY - 8, life: 1000 });
        for (let k = 0; k < 5; k++) bubbles.push({ x: JAIL.right + 2, y: floorY - 4, r: 1, ph: rnd(0, 6) });
        // the treadmill powers the tank generator — labor pays out on release
        const wage = ri(40, 80);
        addGold(wage);
        toast(`${f.customName || KOR[f.species]} 노역 완료 +${wage}🪙`);
        log(`${f.customName || KOR[f.species]} 노역 완료 +${wage}골드`);
        for (let k = 0; k < 3; k++) {
          coins.push({ x: JAIL.right + 4 + rnd(-2, 2), y: floorY - 6, vy: -rnd(0.15, 0.3), life: rnd(500, 900), ghost: true });
        }
      }
      continue;
    }
    if (f.dragged) continue;

    // mantis-punched: ragdoll bouncing off the glass until it recovers
    if (f.knock > 0) {
      f.knock -= dt;
      f.x += f.kvx * dt * 0.06;
      f.y += f.kvy * dt * 0.06;
      if (f.x < 9) { f.x = 9; f.kvx = Math.abs(f.kvx) * 0.92; }
      if (f.x > W - 9) { f.x = W - 9; f.kvx = -Math.abs(f.kvx) * 0.92; }
      if (f.y < 8) { f.y = 8; f.kvy = Math.abs(f.kvy) * 0.92; }
      if (f.y > S.SAND_Y - 7) { f.y = S.SAND_Y - 7; f.kvy = -Math.abs(f.kvy) * 0.92; }
      const drag = 1 - 0.0005 * dt;
      f.kvx *= drag; f.kvy *= drag;
      f.dir = f.kvx >= 0 ? 1 : -1; // tumbles with each wall hit
      if (f.knock <= 0) { f.vx = 0; f.retarget = 0; }
      continue;
    }

    if (f.species === "starfish") {
      // barely crawls along the sand
      f.y = S.SAND_Y - 3;
      if (f.retarget <= 0) { f.retarget = rnd(6000, 14000); if (Math.random() < 0.5) f.dir *= -1; }
      f.x += f.dir * f.speed * nightMul * dt * 0.06;
      if (f.x < 8) { f.x = 8; f.dir = 1; }
      if (f.x > W - 8) { f.x = W - 8; f.dir = -1; }
      continue;
    }

    if (f.species === "seahorse") {
      // upright bobbing, drifts between plants
      if (f.retarget <= 0) {
        f.retarget = rnd(5000, 11000);
        f.targetY = rnd(24, S.SAND_Y - 18);
        f.tx = rnd(14, W - 14);
      }
      f.x += (f.tx - f.x) * 0.00025 * dt * nightMul;
      f.dir = f.tx > f.x ? 1 : -1;
      f.y += ((f.targetY - f.y) * 0.0006 + Math.sin(S.t * 0.003 + f.phase) * 0.012) * dt * 0.6 * nightMul;
      f.y = Math.max(14, Math.min(S.SAND_Y - 12, f.y));
      f.x = Math.max(10, Math.min(W - 10, f.x));
      continue;
    }

    if (f.species === "crab") {
      // ferris walks the sand, eats flakes that land nearby
      f.y = S.SAND_Y - 4;
      if (f.retarget <= 0) {
        f.retarget = rnd(2500, 7000);
        if (Math.random() < 0.5) f.dir *= -1;
        if (Math.random() < 0.3) f.scurry = rnd(600, 1200); // sudden crab dash
      }
      if (f.scurry > 0) f.scurry -= dt;
      let snack = null;
      for (const fl of flakes) {
        if (fl.y > S.SAND_Y - 8 && Math.abs(fl.x - f.x) < 40) { snack = fl; break; }
      }
      if (snack) {
        f.dir = snack.x > f.x ? 1 : -1;
        if (Math.abs(snack.x - f.x) < 5) eat(f, snack);
      }
      f.x += f.dir * f.speed * (f.scurry > 0 ? 2.8 : 1) * nightMul * dt * 0.06;
      if (f.x < 10) { f.x = 10; f.dir = 1; }
      if (f.x > W - 10) { f.x = W - 10; f.dir = -1; }
      continue;
    }

    if (f.species === "jelly") {
      // jellyfin drifts and pulses, ignores food and sharks
      f.y += (Math.sin(S.t * 0.0015 + f.phase) * 0.06 - 0.005) * dt * 0.06 * nightMul;
      f.x += Math.sin(S.t * 0.0008 + f.phase * 2) * 0.04 * dt * 0.06 * nightMul;
      f.y = Math.max(12, Math.min(S.SAND_Y - 14, f.y));
      f.x = Math.max(10, Math.min(W - 10, f.x));
      continue;
    }

    // S.raid omen: swimmers sink toward cover among the plants
    if (S.raid && S.raid.phase === "warn") f.targetY = Math.max(f.targetY, S.SAND_Y - 26);

    // puffer inflation: scheduled hiccups + threat proximity
    if (f.species === "puffer") {
      f.puffT -= dt;
      const sharkNear = threat && Math.abs(threat.x - f.x) < 55;
      f.inflated = sharkNear || f.puffT < 3000;
      if (f.puffT < 0) f.puffT = rnd(12000, 26000);
    }

    // S.raid combat: the whole school mobs the boss in hit-and-run waves
    if (S.raid && S.raid.phase === "fight" && !f.inflated) {
      const b = S.raid.boss;
      f.aggroT -= dt;
      if (f.aggroT <= 0) {
        f.aggroT = rnd(1000, 2400);
        f.aggro = Math.random() < 0.7; // most of the tank fights, a few catch their breath
        f.aggroY = rnd(-9, 9);
      }
      if (S.raid.retreat > 0) f.aggro = false; // scatter command overrides
      dropFood(f);
      if (f.aggro) {
        // dart at the boss flank
        f.dir = f.x < b.x ? 1 : -1;
        f.targetY = b.y + f.aggroY;
      } else {
        // peel off before circling back
        f.dir = f.x < b.x ? -1 : 1;
        f.targetY = f.y < 50 ? 18 : S.SAND_Y - 16;
      }
    }
    // flee threat (regular S.shark passes)
    else if (threat && Math.abs(threat.x - f.x) < fleeR && !f.inflated) {
      f.dir = f.x < threat.x ? -1 : 1;
      f.targetY = f.y < threat.y ? 16 : S.SAND_Y - 14;
      dropFood(f);
    } else {
      if (f.foodCd > 0) f.foodCd -= dt;
      // lost interest only when the flake is truly gone — a claimed chaser
      // follows its flake all the way to the sand (unclaimed crumbs stay the crab's job)
      if (f.food && f.food.life <= 0) {
        dropFood(f);
        f.foodCd = rnd(400, 1000);
      }
      // probabilistic interest: hungry fish react sooner, and a flake
      // only gets chased by the 1-2 fish that claimed it first
      if (!S.raid && !f.food && f.foodCd <= 0 && Math.random() < 0.012 * (0.6 + 0.4 * (1 - f.sat / 100)) * dt) {
        claimFlake(f, 150);
      }
      if (f.food) {
        f.dir = f.food.x > f.x ? 1 : -1;
        f.targetY = f.food.y;
        if (Math.abs(f.food.x - f.x) < 9 && Math.abs(f.food.y - f.y) < 11) eat(f, f.food);
        // failsafe: a chase that drags on means the flake is unreachable — give it up
        else if ((f.chaseT = (f.chaseT || 0) + dt) > 6000) {
          dropFood(f);
          f.foodCd = rnd(400, 1000);
        }
      } else if (f.retarget <= 0) {
        f.retarget = rnd(2000, 6000);
        // deep dwellers stay below the old floor line; everyone else roams the full column
        f.targetY = DEEP_REQ[f.species] && S.tankDepth > 0
          ? rnd(BASE_SAND + 4, S.SAND_Y - 8)
          : rnd(14, S.SAND_Y - 14);
        if (Math.random() < 0.35) f.dir *= -1;
      }
    }

    let sp = f.food ? f.speed * 2.4 : f.speed;
    const inCombat = S.raid && S.raid.phase === "fight";
    const excited = f.food || inCombat || (threat && Math.abs(threat.x - f.x) < fleeR);
    if (threat && Math.abs(threat.x - f.x) < fleeR) sp = f.speed * 2.6;
    if (inCombat && f.aggro) sp = f.speed * 2.2;
    if (f.inflated) sp = f.speed * 0.3;
    sp *= nightMul;
    // burst-and-glide: tail-beat kicks accelerate the fish, then it coasts
    f.burstT -= dt;
    if (f.burstT <= 0) {
      f.burstT = (excited ? rnd(300, 800) : rnd(1000, 3000)) * (SLOW_GIANTS.includes(f.species) ? 2 : 1);
      f.thrust = rnd(1.3, 2.1);
    }
    f.thrust = Math.max(0.3, f.thrust - 0.0006 * dt);
    f.vx += (f.dir * sp * f.thrust - f.vx) * 0.04 * dt * 0.06;
    f.x += f.vx * dt * 0.06;
    // chasing fish dive much harder so they can keep up with sinking flakes
    f.y += ((f.targetY - f.y) * (f.food ? 0.009 : 0.0009) + Math.sin(S.t * 0.004 + f.phase) * 0.004) * dt * 0.6;
    if (f.x < 12) { f.x = 12; f.dir = 1; }
    if (f.x > W - 12) { f.x = W - 12; f.dir = -1; }
    f.y = Math.max(DEEP_REQ[f.species] && S.tankDepth > 0 ? BASE_SAND + 3 : 10, Math.min(S.SAND_Y - 8, f.y));
  }

  // free fish keep clear of the jail block
  for (const f of fishes) {
    if (f.jail || f.dragged) continue;
    if (f.y > JAIL.top - 6 && f.x < JAIL.right + 5) {
      f.x = JAIL.right + 5;
      if (f.knock > 0) f.kvx = Math.abs(f.kvx);
      else f.dir = 1;
    }
  }

  // separation: overlapping swimmers gently push apart (crabs stay on sand)
  for (let i = 0; i < fishes.length; i++) {
    const a = fishes[i];
    if (SAND_DWELLERS.includes(a.species) || a.knock > 0 || a.jail || a.dragged) continue;
    for (let j = i + 1; j < fishes.length; j++) {
      const b = fishes[j];
      if (SAND_DWELLERS.includes(b.species) || b.knock > 0 || b.jail || b.dragged) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < 11 && Math.abs(dy) < 7) {
        const push = 0.06 * dt * 0.06;
        const sy = dy >= 0 ? 1 : -1;
        const sx = dx >= 0 ? 1 : -1;
        a.y = Math.max(10, Math.min(S.SAND_Y - 8, a.y - sy * push));
        b.y = Math.max(10, Math.min(S.SAND_Y - 8, b.y + sy * push));
        a.x = Math.max(10, Math.min(W - 10, a.x - sx * push * 0.6));
        b.x = Math.max(10, Math.min(W - 10, b.x + sx * push * 0.6));
      }
    }
  }

  // command ripple rings expand and fade
  for (let i = rings.length - 1; i >= 0; i--) {
    const rg = rings[i];
    rg.r += 0.06 * dt;
    rg.life -= dt;
    if (rg.life <= 0) rings.splice(i, 1);
  }

  // satiety slowly wears off — no penalty at zero, the fish just isn't breed-ready
  for (const f of fishes) f.sat = Math.max(0, f.sat - dt / 6000);
  // hearts drift up and fade
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.y -= 0.1 * dt * 0.06;
    h.life -= dt;
    if (h.life <= 0) hearts.splice(i, 1);
  }
  // a well-fed fish occasionally shows affection on its own (also signals breed-ready)
  if (Math.random() < 0.0002 * dt) {
    const loved = fishes.filter(f => f.sat >= BREED_SAT);
    if (loved.length) {
      const f = loved[ri(0, loved.length - 1)];
      hearts.push({ x: f.x, y: f.y - 5, life: 1100 });
    }
  }

  // chest + coins
  if (CHEST.openT > 0) CHEST.openT -= dt;
  if (CHEST.cooldown > 0) CHEST.cooldown -= dt;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.y += c.vy * dt * 0.06;
    c.vy += 0.004 * dt * 0.06;
    c.life -= dt;
    if (c.life <= 0 || c.y > S.SAND_Y - 1) {
      coins.splice(i, 1);
      if (!c.ghost) addGold(1); // every coin lands in the wallet
    }
  }
  // bubbles
  if (Math.random() < 0.03 * dt * 0.06) {
    bubbles.push({ x: rnd(4, W - 4), y: S.SAND_Y - 2, r: Math.random() < 0.7 ? 1 : 2, ph: rnd(0, 6) });
  }
  if (Math.random() < 0.02 * dt * 0.06) {
    bubbles.push({ x: 93 + rnd(-2, 2), y: S.SAND_Y - 9, r: 1, ph: rnd(0, 6) });
  }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= (reduced ? 0.1 : 0.22) * dt * 0.06;
    b.x += Math.sin(S.t * 0.01 + b.ph) * 0.05 * dt * 0.06;
    if (b.y < 2) bubbles.splice(i, 1);
  }
  // flakes
  for (let i = flakes.length - 1; i >= 0; i--) {
    const fl = flakes[i];
    fl.life -= dt * 0.06;
    if (fl.y < S.SAND_Y - 4) {
      fl.y += fl.vy * dt * 0.06;
    } else if (!fl.grounded) {
      fl.grounded = true;
      fl.life = Math.min(fl.life, 700); // landed crumbs linger a while for stragglers and the crab
    }
    fl.x += Math.sin(S.t * 0.008 + fl.y) * 0.02 * dt * 0.06;
    if (fl.life <= 0) flakes.splice(i, 1);
  }
}

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

