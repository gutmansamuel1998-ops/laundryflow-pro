import React from "react";

// Basic laundry care reference. Each symbol is drawn as a simple outline and ALWAYS paired
// with its name and meaning in text, so it never relies on the picture or on color.

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function SymbolArt({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false" {...stroke}>
      {children}
    </svg>
  );
}

const SYMBOLS = [
  {
    name: "Washing (tub)",
    meaning: "Machine washing is fine. A number is the highest water temperature in °C. A hand in the tub means hand wash only.",
    art: (
      <SymbolArt>
        <path d="M3 7h18l-2 12H5L3 7z" />
        <path d="M7 12c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3 0" />
      </SymbolArt>
    ),
  },
  {
    name: "Bleaching (triangle)",
    meaning: "An empty triangle means bleach is allowed. Two diagonal lines inside means non-chlorine bleach only.",
    art: (
      <SymbolArt>
        <path d="M12 4l9 16H3L12 4z" />
      </SymbolArt>
    ),
  },
  {
    name: "Tumble drying (square with a circle)",
    meaning: "You can use the dryer. Dots show the heat: one dot is low, two dots is medium.",
    art: (
      <SymbolArt>
        <rect x="4" y="4" width="16" height="16" />
        <circle cx="12" cy="12" r="5" />
      </SymbolArt>
    ),
  },
  {
    name: "Ironing (iron)",
    meaning: "You can iron. Dots show the heat: one dot is cool, three dots is hot.",
    art: (
      <SymbolArt>
        <path d="M3 18h18v-1c0-4-3-8-8-8H7a2 2 0 0 0-2 2v7z" />
      </SymbolArt>
    ),
  },
  {
    name: "Dry cleaning (circle)",
    meaning: "Take it to a professional dry cleaner. A letter inside tells the cleaner which solvent to use.",
    art: (
      <SymbolArt>
        <circle cx="12" cy="12" r="8" />
      </SymbolArt>
    ),
  },
  {
    name: "Crossed out (any symbol with an X)",
    meaning: "Do NOT do that thing. For example, a crossed-out square with a circle means do not tumble dry.",
    art: (
      <SymbolArt>
        <rect x="4" y="4" width="16" height="16" />
        <circle cx="12" cy="12" r="5" />
        <path d="M3 3l18 18M21 3L3 21" />
      </SymbolArt>
    ),
  },
];

const BASICS = [
  "Check the care tag first. It beats any general rule.",
  "Empty pockets and close zips before washing.",
  "Don't overfill the washer or the dryer. Clothes need room to move.",
  "Wash similar fabrics and colors together. Dark and new clothes can bleed.",
  "Move clothes to the dryer soon after the wash ends to avoid a damp smell.",
  "Clean the dryer's lint filter before each load.",
  "Take clothes out when the dryer stops. It cuts down on wrinkles.",
];

export default function CareGuide() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-semibold">Laundry symbol reference</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Symbols vary a little between regions. The tag on your garment is always the authority.
        </p>
        <ul className="space-y-3">
          {SYMBOLS.map((s) => (
            <li key={s.name} className="flex items-start gap-4 rounded-2xl border-2 border-border p-4">
              <div className="shrink-0">{s.art}</div>
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
          {BASICS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
