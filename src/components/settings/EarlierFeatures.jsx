import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import Disclosure from "@/components/session/Disclosure";
import { EARLIER_COPY, OLDER_TOOLS, OTHER_EARLIER } from "@/lib/earlierFeatures";

// "Earlier features" in Settings & Care. A visible heading and one calm sentence, then a closed disclosure with two
// labelled groups: the older tools whose job the main laundry experience now does (air-dry tracker, ironing queue,
// laundry calendar), and everything else from the previous version. Nothing is removed; every link goes to the same
// page it always did. It reads no data, saves nothing and sends nothing.
//
// Headings: the page has one h1, this section is an h2, and the two groups inside the disclosure are h3.
const linkClass = "block min-h-[48px] py-3 text-base underline underline-offset-4";

export default function EarlierFeatures() {
  return (
    <section aria-labelledby="earlier-heading" className="space-y-3">
      <h2 id="earlier-heading" className="text-xl font-semibold">
        {EARLIER_COPY.heading}
      </h2>
      <p className="text-sm text-muted-foreground">{EARLIER_COPY.intro}</p>
      <Disclosure label={EARLIER_COPY.disclosure}>
        <div className="space-y-6 pt-1">
          <div className="space-y-3">
            <h3 id="older-tools-heading" className="text-lg font-semibold">
              {EARLIER_COPY.olderHeading}
            </h3>
            <p className="text-base">{EARLIER_COPY.olderIntro}</p>
            <h4 id="current-versions-heading" className="text-base font-semibold">
              {EARLIER_COPY.currentHeading}
            </h4>
            <ul aria-labelledby="current-versions-heading" className="list-disc space-y-1 pl-6 text-base">
              {EARLIER_COPY.currentItems.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h4 id="older-list-heading" className="text-base font-semibold">
              {EARLIER_COPY.olderListLabel}
            </h4>
            <ul aria-labelledby="older-list-heading" className="space-y-1">
              {OLDER_TOOLS.map((t) => (
                <li key={t.page}>
                  <Link to={createPageUrl(t.page)} className={linkClass}>
                    {t.label}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">{EARLIER_COPY.olderTag}.</span> {t.note}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">{EARLIER_COPY.keptNote}</p>
          </div>
          <div className="space-y-2">
            <h3 id="other-earlier-heading" className="text-lg font-semibold">
              {EARLIER_COPY.otherHeading}
            </h3>
            <p className="text-sm text-muted-foreground">{EARLIER_COPY.otherIntro}</p>
            <ul aria-labelledby="other-earlier-heading" className="space-y-1">
              {OTHER_EARLIER.map((t) => (
                <li key={t.page}>
                  <Link to={createPageUrl(t.page)} className={linkClass}>
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Disclosure>
    </section>
  );
}
