import React from "react";
import CareGuide from "@/components/session/CareGuide";
import Disclosure from "@/components/session/Disclosure";

// A collapsed-by-default disclosure around the shared care guide. The open/close behavior, keyboard and
// screen-reader support live in Disclosure (a native <details>/<summary>), shared with the optional Ironing Queue.
//
// It is purely presentational: it reads no session or timer state and writes nothing, so
// opening or closing it can never pause, reset, or alter the laundry timer.
export default function CarePanel({ view = "all", label, className, headingLevel = 3 }) {
  return (
    <Disclosure label={label} className={className}>
      <CareGuide view={view} headingLevel={headingLevel} />
    </Disclosure>
  );
}
