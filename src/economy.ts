// economy data tables: feed, eggs, prices, localization

export const KOR = {
  tetra: "테트라", guppy: "구피", angel: "엔젤피시", puffer: "복어", jelly: "해파리",
  crab: "게", whale: "고래", golden: "황금 물고기", starfish: "불가사리", seahorse: "해마",
  clown: "흰동가리", sword: "황새치", beluga: "벨루가",
  goldfish: "금붕어", zebra: "제브라다니오", molly: "몰리",
  betta: "베타", discus: "디스커스", bluetang: "블루탱",
  arowana: "아로와나", coelacanth: "실러캔스", mola: "개복치",
  hatchet: "도끼고기", angler: "초롱아귀", gulper: "풍선장어", oarfish: "산갈치",
  bluewhale: "흰수염고래", giantsquid: "대왕오징어",
  cory: "코리도라스", catfish: "메기", lionfish: "쏠배감펭", moray: "곰치", octopus: "문어",
  ray: "가오리", turtle: "바다거북", dolphin: "돌고래", orca: "범고래", narwhal: "일각고래",
  cherrysalmon: "산천어", seabream: "참돔", butterflyfish: "나비고기",
  mackerel: "고등어", flyingfish: "날치", manta: "만타가오리",
  salmon: "연어", gizzardshad: "전어", cutlass: "갈치",
  cod: "대구", icefish: "빙어", yellowtail: "방어",
};

export const VARIED = ["tetra", "guppy", "angel", "seahorse"]; // species with random palettes

// seasonal visitors: only enter egg pools during their real-world season
// index matches seasonNow(): 0 겨울(12-2월) 1 봄(3-5월) 2 여름(6-8월) 3 가을(9-11월)
export const SEASONS = ["겨울", "봄", "여름", "가을"];
export const SEASON_REQ = {
  cherrysalmon: 1, seabream: 1, butterflyfish: 1,
  mackerel: 2, flyingfish: 2, manta: 2,
  salmon: 3, gizzardshad: 3, cutlass: 3,
  cod: 0, icefish: 0, yellowtail: 0,
};

export const FEED_DEF = [
  // daily > 0 → that many free claims per local calendar day, then paid at price
  { key: "basic",  label: "일반 사료", price: 20,  daily: 20, pack: 10, sat: 30, col: ["#e8a94e", "#ffd27a"] },
  { key: "prime",  label: "고급 사료", price: 100, daily: 10, pack: 10, sat: 45, col: ["#4fa8e0", "#9fd8ff"] },
  { key: "golden", label: "황금 사료", price: 300, daily: 0,  pack: 10, sat: 60, col: ["#ffd54a", "#fff6c9"] },
];

export const EGG_SHOP = [
  { grade: 0, label: "일반 알", price: 100 },
  { grade: 1, label: "고급 알", price: 300 },
  { grade: 2, label: "전설 알", price: 900 },
  { grade: 3, label: "신화 알", price: 2500 },
];

export const EGG_POOLS = [
  [ ["tetra", 22], ["guppy", 22], ["clown", 12], ["angel", 10], ["goldfish", 10], ["zebra", 8],
    ["molly", 6], ["cory", 6], ["starfish", 5], ["seahorse", 5] ],
  // within every pool a more common species never rolls below a rarer one
  [ ["tetra", 11], ["guppy", 11], ["clown", 8], ["angel", 7], ["goldfish", 7], ["zebra", 6],
    ["molly", 5], ["cory", 5], ["starfish", 5], ["seahorse", 5],
    ["crab", 5], ["puffer", 5], ["jelly", 5], ["betta", 5], ["sword", 5], ["catfish", 5],
    ["discus", 4], ["bluetang", 4], ["lionfish", 4], ["moray", 4], ["octopus", 4],
    ["whale", 3], ["hatchet", 4], ["angler", 3],
    // seasonal visitors (filtered off-season)
    ["cherrysalmon", 3], ["seabream", 3], ["mackerel", 3], ["flyingfish", 3],
    ["salmon", 3], ["gizzardshad", 3], ["cod", 3], ["icefish", 3] ],
  [ ["tetra", 8], ["guppy", 8], ["goldfish", 7], ["clown", 6], ["angel", 6], ["zebra", 6],
    ["molly", 5], ["cory", 5], ["starfish", 5], ["seahorse", 5],
    ["crab", 5], ["puffer", 5], ["jelly", 5], ["sword", 4], ["whale", 4], ["betta", 4],
    ["catfish", 4], ["discus", 4], ["bluetang", 3],
    ["lionfish", 3.5], ["moray", 3.5], ["octopus", 3.5],
    ["hatchet", 3], ["angler", 3], ["gulper", 2], ["oarfish", 1.5],
    ["golden", 3], ["arowana", 2.5], ["coelacanth", 2.5], ["mola", 2.5],
    ["ray", 2], ["turtle", 2], ["dolphin", 2],
    ["cherrysalmon", 2.5], ["seabream", 2.5], ["mackerel", 2.5], ["flyingfish", 2.5],
    ["salmon", 2.5], ["gizzardshad", 2.5], ["cod", 2.5], ["icefish", 2.5],
    ["butterflyfish", 1.5], ["cutlass", 1.5], ["yellowtail", 1.5], ["manta", 1.2] ],
  // mythic egg: legendary tier and above only — no commons, no mids
  [ ["gulper", 20], ["mola", 18], ["arowana", 16], ["golden", 13], ["coelacanth", 11], ["oarfish", 8],
    ["giantsquid", 6], ["bluewhale", 5], ["orca", 5], ["narwhal", 4], ["beluga", 3] ],
];

export const BREED_EGG_ODDS = [
  [1, 0, 0],
  [0.6, 0.4, 0],
  [0.4, 0.4, 0.2],
];

export const SELL_PRICE = {
  tetra: 50, guppy: 50, clown: 70, angel: 75, starfish: 75, seahorse: 85,
  goldfish: 55, zebra: 50, molly: 55,
  crab: 110, puffer: 135, jelly: 135, sword: 200, whale: 400,
  betta: 150, discus: 160, bluetang: 150,
  hatchet: 180, angler: 350, gulper: 600, oarfish: 1300,
  mola: 750, arowana: 880, golden: 1000, coelacanth: 1100,
  giantsquid: 1500, bluewhale: 1800, beluga: 2500,
  cory: 55, catfish: 140, lionfish: 170, moray: 180, octopus: 200,
  ray: 700, turtle: 900, dolphin: 1200, orca: 2800, narwhal: 2600,
  cherrysalmon: 180, seabream: 200, butterflyfish: 550,
  mackerel: 160, flyingfish: 190, manta: 1400,
  salmon: 220, gizzardshad: 150, cutlass: 800,
  cod: 180, icefish: 140, yellowtail: 750,
};

export const DEX_BONUS = {
  crab: 60, puffer: 60, jelly: 60, sword: 60, whale: 60,
  betta: 60, discus: 60, bluetang: 60,
  hatchet: 80, angler: 120, gulper: 180, oarfish: 300,
  arowana: 150, mola: 150, coelacanth: 200, golden: 200,
  giantsquid: 350, bluewhale: 400, beluga: 500,
  catfish: 60, lionfish: 60, moray: 60, octopus: 70,
  ray: 150, turtle: 180, dolphin: 250, orca: 550, narwhal: 520,
  cherrysalmon: 100, seabream: 100, butterflyfish: 200,
  mackerel: 100, flyingfish: 100, manta: 300,
  salmon: 100, gizzardshad: 100, cutlass: 250,
  cod: 100, icefish: 100, yellowtail: 250,
};

// achievements: tiers = [goal, gold reward]; stat "species"/"seasonal" are
// computed from the dex, the rest accumulate in save.stats
export const ACH_DEFS = [
  { id: "fed",    icon: "🍞", name: "먹이 주기",      stat: "fed",
    tiers: [[50, 50], [150, 80], [400, 120], [1000, 200], [2000, 300], [3500, 450], [5000, 600], [7500, 800], [10000, 1000], [15000, 1500]] },
  { id: "hatch",  icon: "🐣", name: "알 부화",        stat: "hatched",
    tiers: [[5, 60], [15, 100], [30, 150], [50, 250], [80, 350], [120, 500], [200, 700], [300, 900], [450, 1200], [600, 1500]] },
  { id: "sell",   icon: "💰", name: "물고기 판매",    stat: "sold",
    tiers: [[5, 50], [15, 80], [30, 150], [60, 250], [100, 350], [150, 500], [250, 700], [400, 900], [600, 1200], [1000, 1500]] },
  { id: "raid",   icon: "🦈", name: "레이드 승리",    stat: "raidWins", tiers: [[1, 100], [10, 500], [50, 2000]] },
  { id: "jail",   icon: "⛓️", name: "노역 완수",      stat: "jailDone",
    tiers: [[5, 40], [15, 60], [30, 100], [60, 180], [100, 250], [180, 350], [300, 500], [500, 700], [750, 900], [1000, 1200]] },
  { id: "chest",  icon: "📦", name: "보물상자 열기",  stat: "chests",
    tiers: [[10, 30], [30, 50], [75, 80], [150, 150], [300, 250], [500, 350], [800, 500], [1200, 650], [1700, 800], [2500, 1000]] },
  { id: "dex",    icon: "📖", name: "도감 수집",      stat: "species",  tiers: [[10, 200], [25, 500], [40, 1500], [50, 3000]] },
  { id: "season", icon: "🍂", name: "계절 한정 수집", stat: "seasonal", tiers: [[3, 300], [6, 800], [12, 2500]] },
];

export const FRAME_SHOP = [
  { key: "", label: "기본 프레임", price: 0 },
  { key: "wood", label: "원목 프레임", price: 300 },
  { key: "neon", label: "네온 프레임", price: 800 },
  { key: "gold", label: "황금 프레임", price: 1500 },
];

export const DEPTH_SHOP = [
  { label: "심해 1층", price: 1500 },
  { label: "심해 2층", price: 4000 },
];

export const GRADE_COLORS = ["#9fb6cc", "#46d8ff", "#ffd54a", "#ff6b9d"];

export const TIER_LABELS = ["🥉 일반 등급", "🥈 고급 등급", "🥇 전설 등급", "🔮 신화 등급"];

export const GRADE_NAMES = ["일반 알", "고급 알", "전설 알", "신화 알"];
