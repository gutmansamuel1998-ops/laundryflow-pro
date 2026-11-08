// The ONE source of laundry-care education (symbols, explanations, basic tips).
// Every place that shows care information (Home, each Laundry Session stage, and Settings & Care)
// renders from this file via <CareGuide view="..."/>, so the content can never drift apart.
// Pure data + selectors: no React, no timers, no session state.

// Views are filtered slices of the same content:
//   all  : everything (Home, Settings & Care)
//   wash : washing + bleaching (+ the "crossed out" rule): Start and Wash stages
//   dry  : tumble + air drying (+ the "crossed out" rule): Move and Dry stages
export const CARE_VIEWS = {
  all: { title: "Laundry symbol reference", groups: null },
  wash: { title: "Washing and bleaching symbols", groups: ["washing", "bleaching", "crossed"] },
  dry: { title: "Drying symbols", groups: ["tumble", "airdry", "crossed"] },
};

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
    meaning: "You can iron. Dots show the heat: one dot is cool, three dots is hot.",
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
  { id: "tag", text: "Check the care tag first. It beats any general rule.", views: ["wash", "dry"] },
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
    views: ["dry"],
  },
];

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
export function careViewForPhase(phase) {
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
