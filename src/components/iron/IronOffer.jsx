import React from "react";
import Disclosure from "@/components/session/Disclosure";
import { IronAddForm, IronGuidePanel, IronList } from "@/components/iron/IronParts";
import { useIronQueue } from "@/hooks/useIronQueue";
import { IRON_COPY, MAX_ITEMS, fullMessage } from "@/lib/ironQueue";

// The optional "Anything to iron?" offer shown after drying (only when the person has turned ironing
// suggestions on in Settings & Care). It is collapsed by default, takes no focus, makes no sound and sends no
// reminder. It sits beside the laundry steps and is not one of them: it reads no timer or session, and the
// "I put my clothes away" button works the same whether it is opened, used, or ignored.
export default function IronOffer() {
  const queue = useIronQueue();
  const full = queue.items.length >= MAX_ITEMS;

  return (
    <Disclosure label={IRON_COPY.offerSummary}>
      <div className="space-y-4">
        <p className="text-base">{IRON_COPY.offerIntro}</p>

        {queue.ready ? (
          <>
            <IronAddForm
              idPrefix="iron-offer"
              onAdd={queue.add}
              full={full}
              fullText={full ? fullMessage(queue.items) : ""}
            />
            {/* Always mounted, so after the last item is removed focus can land on its "empty" summary line. */}
            <IronList
              items={queue.items}
              onDone={queue.done}
              onReopen={queue.reopen}
              onRemove={queue.remove}
              onChooseHeat={queue.chooseHeat}
              onClearDone={queue.clearDone}
              saveFailed={queue.saveFailed}
            />
          </>
        ) : (
          <p role="status" className="text-base">
            {IRON_COPY.unavailable}
          </p>
        )}

        <IronGuidePanel headingLevel={2} />
        <p className="text-sm text-muted-foreground">
          {IRON_COPY.offerSkip} {IRON_COPY.storedHere}
        </p>
      </div>
    </Disclosure>
  );
}
