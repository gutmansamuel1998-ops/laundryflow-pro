import React from "react";
import { CARE_VIEWS, getCareSymbols, getCareTips } from "@/lib/careContent";

// Renders the shared care content (src/lib/careContent.js). `view` picks which slice to show:
// "all" | "wash" | "dry". Each symbol is drawn as a simple outline and ALWAYS paired with its
// name and meaning in text, so it never relies on the picture or on color.

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function SymbolArt({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false" {...stroke}>
      {children}
    </svg>
  );
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
        <p className="mb-3 text-sm text-muted-foreground">
          Symbols vary a little between regions. The tag on your garment is always the authority.
        </p>
        <ul className="space-y-3">
          {symbols.map((s) => (
            <li key={s.id} className="flex items-start gap-4 rounded-2xl border-2 border-border p-4">
              <div className="shrink-0">{ART[s.id]}</div>
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm">{s.meaning}</p>
              </div>
            </li>
          ))}
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
