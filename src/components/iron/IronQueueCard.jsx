import React from "react";
import Disclosure from "@/components/session/Disclosure";
import { Panel } from "@/components/session/ui";
import { IronAddForm, IronGuidePanel, IronList } from "@/components/iron/IronParts";
import { useIronQueue } from "@/hooks/useIronQueue";
import { IRON_COPY, MAX_ITEMS, fullMessage } from "@/lib/ironQueue";

// The Home card for the optional Ironing Queue. It renders nothing at all until there is at least one item,
// so people who never use ironing never see it. It does not depend on the "ironing suggestions" setting:
// anything already on the list stays visible and manageable even if that setting is later turned off.
// This is separate from the earlier ironing pages, which are untouched.
export default function IronQueueCard() {
  const queue = useIronQueue();
  if (!queue.ready || queue.items.length === 0) return null;
  const full = queue.items.length >= MAX_ITEMS;

  return (
    <Panel aria-labelledby="iron-queue-heading" className="space-y-4">
      <div>
        <h2 id="iron-queue-heading" className="text-xl font-semibold">
          {IRON_COPY.cardHeading}
        </h2>
        <p className="text-sm text-muted-foreground">{IRON_COPY.noPressure}</p>
      </div>

      <IronList
        items={queue.items}
        onDone={queue.done}
        onReopen={queue.reopen}
        onRemove={queue.remove}
        onChooseHeat={queue.chooseHeat}
        onClearDone={queue.clearDone}
        saveFailed={queue.saveFailed}
      />

      <Disclosure label={IRON_COPY.addAnother}>
        <IronAddForm idPrefix="iron-card" onAdd={queue.add} full={full} fullText={full ? fullMessage(queue.items) : ""} />
      </Disclosure>

      <IronGuidePanel />
      <p className="text-sm text-muted-foreground">{IRON_COPY.storedHere}</p>
    </Panel>
  );
}
