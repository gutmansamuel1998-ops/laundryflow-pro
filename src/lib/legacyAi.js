import { base44 } from "@/api/base44Client";

// Browser helper for the legacy (non-V1) AI features.
//
// Phase 3E: the browser no longer calls the paid LLM integration. Every request goes to the `legacyAi` backend
// function with a fixed operation name and a few small fields. The server decides who may use which operation
// (Premium status is read from the signed-in user's record there, never from this file), reads the caller's
// own supplies/closet/loads itself, applies size and usage limits, and owns every prompt.

export const LEGACY_AI_OPS = Object.freeze([
  "tag_scan",
  "stain_guidance",
  "cycle_recommend",
  "routine_build",
  "smart_wash",
  "fabric_tag_analyze",
  "closet_wash_check",
  "closet_item_tag_scan",
  "load_recommendation",
  "basket_plan",
  "load_planner",
  "closet_scan",
]);

export class LegacyAiError extends Error {
  constructor(code, status) {
    super(code);
    this.name = "LegacyAiError";
    this.code = code;
    this.status = status;
  }
}

export async function legacyAi(op, input = {}) {
  if (!LEGACY_AI_OPS.includes(op)) throw new LegacyAiError("unknown_operation", 400);
  try {
    const res = await base44.functions.invoke("legacyAi", { op, input });
    const data = res && res.data !== undefined ? res.data : res;
    if (!data || typeof data.result !== "object" || data.result === null) {
      throw new LegacyAiError("ai_unavailable", 502);
    }
    return data.result;
  } catch (err) {
    if (err instanceof LegacyAiError) throw err;
    const status = (err && err.response && err.response.status) || (err && err.status) || 0;
    const code = (err && err.response && err.response.data && err.response.data.error) || "ai_failed";
    throw new LegacyAiError(typeof code === "string" ? code : "ai_failed", status);
  }
}

// Friendly, non-technical text for the few failures a person can act on.
export function legacyAiMessage(err) {
  const code = err && err.code;
  if (code === "premium_required") return "This feature is part of Premium.";
  if (code === "rate_limited") return "Please wait a moment and try again.";
  if (code === "daily_limit_reached") return "You've reached today's limit for this feature. Please try again tomorrow.";
  if (code === "no_items") return "Those items could not be found. Please reselect them and try again.";
  if (code === "input_too_large" || code === "invalid_input" || code === "invalid_file") {
    return "That request couldn't be processed. Please check what you entered and try again.";
  }
  return "Something went wrong. Please try again.";
}
