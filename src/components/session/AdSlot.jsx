import React from "react";
import { getAdProvider, isAdFree } from "@/lib/ads";

// V1 renders nothing. This is the single place future optional ads would appear.
// Never place it on a screen that asks the user to take a physical action.
export default function AdSlot({ placement }) {
  if (isAdFree()) return null;
  const Provider = getAdProvider();
  return Provider ? <Provider placement={placement} /> : null;
}
