// The ONE source of laundry-care education (symbols, explanations, basic tips).
// Every place that shows care information (Home, each Laundry Session stage, and Settings & Care)
// renders from this file via <CareGuide view="..."/>, so the content can never drift apart.
// Pure data + selectors: no React, no timers, no session state.

// Views are filtered slices of the same content:
//   all  : everything (Home, Settings & Care)
//   wash : washing + bleaching (+ the "crossed out" rule): Start and Wash stages
//   dry  : tumble + air drying (+ the "crossed out" rule): Move and Dry stages
//   airdry : only the air-drying symbols and tips, shown while the person is air-drying
//   iron : only the ironing symbols and tips (prepared for the optional ironing queue; not shown by a stage yet)
// A view may carry an `intro`: a short plain-language note shown under its title.
export const CARE_VIEWS = {
  all: { title: "Laundry symbol reference", groups: null },
  wash: { title: "Washing and bleaching symbols", groups: ["washing", "bleaching", "crossed"] },
  dry: { title: "Drying symbols", groups: ["tumble", "airdry", "crossed"] },
  airdry: { title: "Air-drying symbols", groups: ["airdry"] },
  iron: {
    title: "Ironing symbols",
    groups: ["ironing"],
    intro:
      "The dots show the highest temperature of the iron's soleplate (its flat metal base) that the fabric can take. " +
      "That is a limit, not a target, so you can always iron cooler.",
  },
};

// ─── Ironing: where the facts come from ────────────────────────────────────────────────────────────
// Dots -> maximum SOLEPLATE temperature, the same in every system: one dot 110 °C, two dots 150 °C, three dots 200 °C.
//  - ISO 3758:2023 (4th ed.) and GINETEX: maximum soleplate temperatures; the 4th edition adds a symbol for
//    ironing without steam and redraws "do not iron". Its scope is the most severe treatment that will not
//    cause irreversible damage, so the dots are ceilings. GINETEX also flags that steam may damage fabric at
//    the one-dot level.
//  - ASTM D5489 (US) uses the same three levels (about 230, 300 and 390 °F), has a separate "do not steam"
//    symbol, and a plain iron with no dots for "any temperature".
//  - Government of Canada care-symbol guide: the same ceilings (110, 150, 200 °C), plus the fabrics each level is
//    recommended for. Those fabrics are a GUIDE, kept apart from the limit below (`fibres` vs `maxC`).
// Fahrenheit values are the rounded figures printed on US charts; tests check they stay within 3 °F of the exact
// conversion. Everything else in the ironing entries (tips, plain-language wording) is general guidance.
// Note: the paid ISO text itself was not read; the figures above were confirmed against the sources named here.

export const CARE_SYMBOLS = [
  {
    id: "washing",
    group: "washing",
    name: "Washing (tub)",
    meaning:
      "Machine washing is fine. A number is the highest water temperature in °C, and dots work the same way: more dots, hotter water. A line under the tub means a gentler cycle. A hand in the tub means hand wash only.",
  },
  {
    id: "bleaching",
    group: "bleaching",
    name: "Bleaching (triangle)",
    meaning: "An empty triangle means bleach is allowed. Two diagonal lines inside means non-chlorine bleach only.",
  },
  {
    id: "tumble",
    group: "tumble",
    name: "Tumble drying (square with a circle)",
    meaning:
      "You can use the dryer. Dots show the heat: one dot is low, two dots is medium, and three dots (on some tags) is high. A filled-in circle means no heat.",
  },
  {
    id: "line_dry",
    group: "airdry",
    name: "Line dry (hang up)",
    meaning:
      "Hang it on a line or rack to dry. Depending on the region, the tag shows a square with a line across the top or a square with one vertical line.",
  },
  {
    id: "drip_dry",
    group: "airdry",
    name: "Drip dry (three vertical lines)",
    meaning: "Hang it up dripping wet, without wringing or spinning, and let the water run off.",
  },
  {
    id: "dry_flat",
    group: "airdry",
    name: "Dry flat (one horizontal line)",
    meaning: "Lay it flat to dry. This keeps heavy or stretchy items, like knits, from losing their shape.",
  },
  {
    id: "shade_dry",
    group: "airdry",
    name: "Dry in the shade (diagonal lines in the corner)",
    meaning: "Dry it away from direct sunlight, which can fade colors.",
  },
  {
    id: "ironing",
    group: "ironing",
    name: "Ironing (iron)",
    meaning:
      "You can iron. Dots show the heat limit: one dot is low, two is medium, three is high. " +
      "On US labels, a plain iron with no dots means any heat is fine.",
  },
  {
    id: "iron_low",
    group: "ironing",
    name: "Iron, one dot (low heat)",
    meaning:
      "Iron on a low setting. Many European labels warn that steam can damage the fabric at this level, " +
      "so when unsure, iron it dry.",
    dots: 1,
    maxC: 110,
    maxF: 230,
    fibres: "acetate, acrylic, modacrylic, nylon, polypropylene and spandex",
  },
  {
    id: "iron_medium",
    group: "ironing",
    name: "Iron, two dots (medium heat)",
    meaning: "Iron on a medium setting.",
    dots: 2,
    maxC: 150,
    maxF: 300,
    fibres: "polyester, rayon, silk, triacetate and wool",
  },
  {
    id: "iron_high",
    group: "ironing",
    name: "Iron, three dots (high heat)",
    meaning: "Iron on a high setting.",
    dots: 3,
    maxC: 200,
    maxF: 390,
    fibres: "cotton and linen",
  },
  {
    id: "iron_none",
    group: "ironing",
    name: "Do not iron (crossed-out iron)",
    meaning:
      "Do not iron or press this item. The heat can damage the fabric for good. " +
      "Hanging it up and smoothing it by hand can help.",
  },
  {
    id: "no_steam",
    group: "ironing",
    name: "Do not steam (iron with crossed-out steam)",
    meaning:
      "Do not use steam. You can still iron at the heat the dots show, but keep the steam button off, " +
      "because steam can harm this fabric. It usually appears next to the iron dots.",
  },
  {
    id: "dry_cleaning",
    group: "drycleaning",
    name: "Dry cleaning (circle)",
    meaning: "Take it to a professional dry cleaner. A letter inside tells the cleaner which solvent to use.",
  },
  {
    id: "crossed",
    group: "crossed",
    name: "Crossed out (any symbol with an X)",
    meaning:
      "Do NOT do that thing. For example, a crossed-out square with a circle means do not tumble dry.",
  },
];

// `views` lists where a tip is relevant. The "all" view shows every tip.
export const CARE_TIPS = [
  { id: "tag", text: "Check the care tag first. It beats any general rule.", views: ["wash", "dry", "airdry", "iron"] },
  { id: "pockets", text: "Empty pockets and close zips before washing.", views: ["wash"] },
  {
    id: "overfill",
    text: "Don't overfill the washer or the dryer. Clothes need room to move.",
    views: ["wash", "dry"],
  },
  {
    id: "sort",
    text: "Wash similar fabrics and colors together. Dark and new clothes can bleed.",
    views: ["wash"],
  },
  {
    id: "move_soon",
    text: "Move clothes to the dryer soon after the wash ends to avoid a damp smell.",
    views: ["dry"],
  },
  { id: "lint", text: "Clean the dryer's lint filter before each load.", views: ["dry"] },
  {
    id: "take_out",
    text: "Take clothes out when the dryer stops. It cuts down on wrinkles.",
    views: ["dry"],
  },
  {
    id: "air_dry",
    text: "Air-drying: give clothes space and airflow, and lay knits flat so they keep their shape.",
    views: ["dry", "airdry"],
  },
  {
    id: "air_dry_time",
    text: "Thick items like towels and jeans can take longer. Still damp is normal, so just check again.",
    views: ["airdry"],
  },
  {
    id: "iron_start_low",
    text: "No symbol, or not sure? Start on low heat and test a hidden spot first, like inside a hem.",
    views: ["iron"],
  },
  {
    id: "iron_mixed",
    text: "Mixed fabrics: follow the most delicate fabric on the tag.",
    views: ["iron"],
  },
  {
    id: "iron_inside_out",
    text: "For dark, shiny or printed items, iron inside out or put a thin cloth between the iron and the fabric.",
    views: ["iron"],
  },
  {
    id: "iron_safety",
    text: "Keep the iron moving, and unplug it when you finish so it can cool safely.",
    views: ["iron"],
  },
];

// Ironing facts shown under a symbol. Returns null for symbols that have none, so other symbols render as before.
// The LIMIT (`maxC`) is what the label allows; `fibres` is only a guide to what usually suits that setting.
export function ironLimitText(symbol) {
  if (!symbol || !Number.isFinite(symbol.maxC) || !Number.isFinite(symbol.maxF)) return null;
  return `Highest soleplate temperature (the limit): ${symbol.maxC} °C (about ${symbol.maxF} °F)`;
}

export function ironFibresText(symbol) {
  return symbol && symbol.fibres ? `Often recommended for: ${symbol.fibres}` : null;
}

export function getCareSymbols(view = "all") {
  const groups = (CARE_VIEWS[view] || CARE_VIEWS.all).groups;
  return groups ? CARE_SYMBOLS.filter((s) => groups.includes(s.group)) : CARE_SYMBOLS;
}

export function getCareTips(view = "all") {
  return view === "all" || !CARE_VIEWS[view] ? CARE_TIPS : CARE_TIPS.filter((t) => t.views.includes(view));
}

// Which guidance (if any) belongs with each laundry phase. Guidance is only ever OFFERED,
// collapsed by default; it never changes the session. Put Away and Done deliberately get none,
// so completion stays the priority.
//
// `airDry` (optional) is true while the person is air-drying (or has chosen to at the dryer step). It only
// swaps the drying slice for the air-drying slice; it is a plain flag, so this file stays free of session code.
export function careViewForPhase(phase, { airDry = false } = {}) {
  if (airDry && (phase === "dryer_setup" || phase === "dry_running")) {
    return { view: "airdry", label: "Air-drying symbols and tips" };
  }
  switch (phase) {
    case "none":
    case "ready":
      return { view: "wash", label: "Check laundry care symbols" };
    case "wash_running":
      return { view: "wash", label: "Washing symbols and tips" };
    case "wash_elapsed":
    case "dryer_setup":
      return { view: "dry", label: "Check drying symbols" };
    case "dry_running":
      return { view: "dry", label: "Drying symbols and tips" };
    default:
      return null;
  }
}
