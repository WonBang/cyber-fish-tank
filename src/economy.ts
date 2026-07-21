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
};

export const VARIED = ["tetra", "guppy", "angel", "seahorse"]; // species with random palettes

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
    ["molly", 6], ["starfish", 5], ["seahorse", 5] ],
  // within every pool a more common species never rolls below a rarer one
  [ ["tetra", 11], ["guppy", 11], ["clown", 8], ["angel", 7], ["goldfish", 7], ["zebra", 6],
    ["molly", 5], ["starfish", 5], ["seahorse", 5],
    ["crab", 5], ["puffer", 5], ["jelly", 5], ["betta", 5], ["sword", 5], ["discus", 4],
    ["bluetang", 4], ["whale", 3], ["hatchet", 4], ["angler", 3] ],
  [ ["tetra", 8], ["guppy", 8], ["goldfish", 7], ["clown", 6], ["angel", 6], ["zebra", 6],
    ["molly", 5], ["starfish", 5], ["seahorse", 5],
    ["crab", 5], ["puffer", 5], ["jelly", 5], ["sword", 4], ["whale", 4], ["betta", 4],
    ["discus", 4], ["bluetang", 3],
    ["hatchet", 3], ["angler", 3], ["gulper", 2], ["oarfish", 1.5],
    ["golden", 3], ["arowana", 2.5], ["coelacanth", 2.5], ["mola", 2.5] ],
  // mythic egg: legendary tier and above only — no commons, no mids
  [ ["gulper", 20], ["mola", 18], ["arowana", 16], ["golden", 13], ["coelacanth", 11], ["oarfish", 8],
    ["giantsquid", 6], ["bluewhale", 5], ["beluga", 3] ],
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
};

export const DEX_BONUS = {
  crab: 60, puffer: 60, jelly: 60, sword: 60, whale: 60,
  betta: 60, discus: 60, bluetang: 60,
  hatchet: 80, angler: 120, gulper: 180, oarfish: 300,
  arowana: 150, mola: 150, coelacanth: 200, golden: 200,
  giantsquid: 350, bluewhale: 400, beluga: 500,
};

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
