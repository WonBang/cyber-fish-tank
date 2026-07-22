// @ts-nocheck — mechanical port from the single-file build; typing is a follow-up pass
import { S } from "./state";
import { W, BASE_SAND, LAYER_H, reduced } from "./canvas";
import { rnd, ri } from "./utils";
import { MIN_FISH } from "./palette";
import { FEED_DEF, KOR } from "./economy";
import { DEEP_REQ } from "./sprites";
import { fishes, bubbles, flakes, coins, eggs, hearts, rings, JAIL, CHEST, MANTIS, SAND_DWELLERS, SLOW_GIANTS, BOSS_HP, startRaid, updateBoss, summonShark, nonCrabCount, makeFish, addFish, isCrowned, rollEggGrade, dropGradeEgg, BREED_SAT, rollEggSpecies, recordHatch, LOVE_AT, CROWN_AT, log, toast, addGold, bumpStat } from "./game";

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
  bumpStat("fed");
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

  // S.raid state machine (event timers freeze during catch-up: raids and
  // sharks need a present player — absence must never cost a fish)
  if (!S.raid) {
    if (!S.catchup) {
      S.raidTimer -= dt;
      if (S.raidTimer <= 0 && fishes.length >= 8 && !S.shark) startRaid();
    }
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

  // S.shark event (paused during raids and catch-up)
  if (!S.raid && !S.catchup) S.sharkTimer -= dt;
  if (!S.raid && !S.shark && !S.catchup && S.sharkTimer <= 0) { summonShark(); }
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
        const wage = ri(20, 40);
        addGold(wage);
        toast(`${f.customName || KOR[f.species]} 노역 완료 +${wage}🪙`);
        log(`${f.customName || KOR[f.species]} 노역 완료 +${wage}골드`);
        bumpStat("jailDone");
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

// ---------- background catch-up ----------
// rAF stops while the page is hidden (menubar popover closed, tab in the
// background), so wall-clock time is lost. On return we fast-forward the
// simulation in a time-boxed loop; raid/shark triggers freeze while
// S.catchup is set, so time away only ever pays out (jail wages, hatches).
const CU_MAX_REAL = 8 * 3600 * 1000; // simulate at most 8h of absence
const CU_STEP = 45; // sim-ms per step = 100ms real at the 45% pace
function queueCatchup(gapMs) {
  if (!S.cuLeft) {
    S.cuStats = { gold: S.save.gold, fish: fishes.length, real: 0 };
    // nobody was watching: an in-flight raid or shark visit is called off
    if (S.raid) { S.raid = null; S.raidTimer = rnd(60000, 120000); S.raidDark = 0; }
    S.shark = null;
  }
  S.cuStats.real += Math.min(gapMs, CU_MAX_REAL);
  S.cuLeft = Math.min((S.cuLeft || 0) + gapMs * 0.45, CU_MAX_REAL * 0.45);
}
function runCatchup() {
  if (!S.cuLeft) return;
  S.catchup = true;
  const t0 = performance.now();
  // ~8ms of real work per frame keeps the UI responsive while fast-forwarding
  while (S.cuLeft > 0 && performance.now() - t0 < 8) {
    const step = Math.min(CU_STEP, S.cuLeft);
    update(step);
    S.cuLeft -= step;
  }
  S.catchup = false;
  if (S.cuLeft <= 0) {
    S.cuLeft = 0;
    const st = S.cuStats;
    S.cuStats = null;
    if (st.real < 60000) return; // short blips resolve silently
    const dg = S.save.gold - st.gold, df = fishes.length - st.fish;
    const mins = Math.round(st.real / 60000);
    const dur = mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`;
    const bits = [];
    if (dg > 0) bits.push(`+${dg}🪙`);
    if (df > 0) bits.push(`물고기 +${df}마리`);
    toast(`😴 ${dur} 만에 복귀${bits.length ? " — " + bits.join(", ") : ""}`);
    log(`부재 ${dur} 경과분 반영${bits.length ? " — " + bits.join(", ") : ""}`);
  }
}

export { dropFood, update, queueCatchup, runCatchup };
