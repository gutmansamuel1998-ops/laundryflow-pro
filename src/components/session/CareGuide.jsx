import React from "react";
import { CARE_VIEWS, getCareSymbols, getCareTips, ironFibresText, ironLimitText } from "@/lib/careContent";

// Renders the shared care content (src/lib/careContent.js). `view` picks which slice to show:
// "all" | "wash" | "dry" | "airdry" | "iron". Each symbol is drawn as a simple outline and ALWAYS paired with its
// name and meaning in text, so it never relies on the picture or on color.

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function SymbolArt({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false" {...stroke}>
      {children}
    </svg>
  );
}

// Filled dots inside the iron: drawn in the text color (never a hue), and always repeated in words by the symbol's name.
function IronDots({ count }) {
  const xs = count === 1 ? [12] : count === 2 ? [9.5, 14.5] : [8, 12, 16];
  return xs.map((cx) => <circle key={cx} cx={cx} cy={14.5} r={1.3} fill="currentColor" stroke="none" />);
}

const ART = {
  washing: (
    <SymbolArt>
      <path d="M3 7h18l-2 12H5L3 7z" />
      <path d="M7 12c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3 0" />
    </SymbolArt>
  ),
  bleaching: (
    <SymbolArt>
      <path d="M12 4l9 16H3L12 4z" />
    </SymbolArt>
  ),
  tumble: (
    <SymbolArt>
      <rect x="4" y="4" width="16" height="16" />
      <circle cx="12" cy="12" r="5" />
    </SymbolArt>
  ),
  line_dry: (
    <SymbolArt>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M12 7v10" />
    </SymbolArt>
  ),
  drip_dry: (
    <SymbolArt>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M8.5 7v10M12 7v10M15.5 7v10" />
    </SymbolArt>
  ),
  dry_flat: (
    <SymbolArt>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M7 12h10" />
    </SymbolArt>
  ),
  shade_dry: (
    <SymbolArt>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M4 10l6-6M4 15l11-11" />
    </SymbolArt>
  ),
  ironing: (
    <SymbolArt>
      <path d="M3 18h18v-1c0-4-3-8-8-8H7a2 2 0 0 0-2 2v7z" />
    </SymbolArt>
  ),
  iron_low: (
    <SymbolArt>
      <path d="M3 18h18v-1c0-4-3-8-8-8H7a2 2 0 0 0-2 2v7z" />
      <IronDots count={1} />
    </SymbolArt>
  ),
  iron_medium: (
    <SymbolArt>
      <path d="M3 18h18v-1c0-4-3-8-8-8H7a2 2 0 0 0-2 2v7z" />
      <IronDots count={2} />
    </SymbolArt>
  ),
  iron_high: (
    <SymbolArt>
      <path d="M3 18h18v-1c0-4-3-8-8-8H7a2 2 0 0 0-2 2v7z" />
      <IronDots count={3} />
    </SymbolArt>
  ),
  iron_none: (
    <SymbolArt>
      <path d="M3 18h18v-1c0-4-3-8-8-8H7a2 2 0 0 0-2 2v7z" />
      <path d="M3 3l18 18M21 3L3 21" />
    </SymbolArt>
  ),
  no_steam: (
    <SymbolArt>
      <path d="M4 12h16v-1c0-3-2.5-6-6.5-6H8a2 2 0 0 0-2 2v5z" />
      <path d="M8 15v5M12 15v5M16 15v5" />
      <path d="M5 14l14 8M19 14L5 22" />
    </SymbolArt>
  ),
  dry_cleaning: (
    <SymbolArt>
      <circle cx="12" cy="12" r="8" />
    </SymbolArt>
  ),
  crossed: (
    <SymbolArt>
      <rect x="4" y="4" width="16" height="16" />
      <circle cx="12" cy="12" r="5" />
      <path d="M3 3l18 18M21 3L3 21" />
    </SymbolArt>
  ),
};

export default function CareGuide({ view = "all" }) {
  const config = CARE_VIEWS[view] || CARE_VIEWS.all;
  const symbols = getCareSymbols(view);
  const tips = getCareTips(view);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-semibold">{config.title}</h3>
        {config.intro && <p className="mb-3 text-base">{config.intro}</p>}
        <p className="mb-3 text-sm text-muted-foreground">
          Symbols vary a little between regions. The tag on your garment is always the authority.
        </p>
        <ul className="space-y-3">
          {symbols.map((s) => {
            // Ironing symbols also show their temperature limit and the fabrics they are usually recommended for.
            const limit = ironLimitText(s);
            const fibres = ironFibresText(s);
            return (
              <li key={s.id} className="flex items-start gap-4 rounded-2xl border-2 border-border p-4">
                <div className="shrink-0">{ART[s.id]}</div>
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm">{s.meaning}</p>
                  {limit && <p className="mt-1 text-sm font-semibold">{limit}</p>}
                  {fibres && <p className="text-sm">{fibres}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-lg font-semibold">Simple care basics</h3>
        <ul className="list-disc space-y-2 pl-6 text-base">
          {tips.map((t) => (
            <li key={t.id}>{t.text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
