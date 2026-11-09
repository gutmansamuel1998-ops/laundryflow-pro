// Phase 3E: refreshing the legacy Home shopping list must work for everyone, without weakening the server's
// Premium check on the AI prediction function.
//
//  - Everyone: `updateShoppingList` (deterministic, no AI, only touches the signed-in user's own supplies and list).
//  - Premium (as shown by the client's usePremium, a display hint only): additionally ask the AI prediction
//    function for fresh depletion estimates first. The server still checks has_premium itself; if it says no, or
//    the prediction fails for any reason, the deterministic refresh still runs.
export async function refreshShoppingList({ isPremium, invoke }) {
  if (isPremium === true) {
    try {
      await invoke("predictSupplyDepletion", {});
    } catch {
      // Prediction is an extra. A refusal or failure must not stop the list from refreshing.
    }
  }
  return invoke("updateShoppingList", {});
}
