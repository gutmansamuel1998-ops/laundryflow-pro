import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { hashOwner } from "@/lib/ownerKey";

// The one-way label for the signed-in person ("" while unknown or not yet computed).
export function useOwnerKey() {
  const { user } = useAuth();
  const raw = user ? String(user.id || user.email || "") : "";
  const [key, setKey] = useState({ raw: "", hash: "" });

  useEffect(() => {
    let cancelled = false;
    if (!raw) {
      setKey({ raw: "", hash: "" });
      return undefined;
    }
    hashOwner(raw).then((hash) => {
      if (!cancelled) setKey({ raw, hash });
    });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  // Never hand out a hash that belongs to a previous person while the new one is being computed.
  return key.raw === raw ? key.hash : "";
}
