// language: "ko" | "en" — decided once at boot; switching reloads the page
// (single-file bundle, all localized consts are computed at module load)
const stored = (() => { try { return localStorage.getItem("cft.lang"); } catch { return null; } })();
export const LANG: "ko" | "en" =
  stored === "ko" || stored === "en" ? stored
  : (navigator.language || "").toLowerCase().startsWith("ko") ? "ko" : "en";

// pick localized string at call site: tr("골드 부족", "Not enough gold")
export function tr(ko: string, en: string): string {
  return LANG === "en" ? en : ko;
}

export function setLang(lang: "ko" | "en") {
  try { localStorage.setItem("cft.lang", lang); } catch {}
  location.reload();
}
