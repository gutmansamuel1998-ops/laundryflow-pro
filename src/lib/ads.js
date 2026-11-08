// Extension point for FUTURE optional advertising and an ad-free subscription.
// V1 ships with NO ads and no ad network. Nothing here loads third-party code.
//
// To add ads later:
//   1. registerAdProvider(MyAdComponent) at app start (the component receives { placement }).
//   2. Make isAdFree() read the user's subscription instead of returning true.
// Design rules for later: ads must never appear on a screen that asks the user to act
// (move clothes / put clothes away), must be easy to skip by keyboard and screen reader,
// and accessibility features must stay free.

let provider = null;

export function registerAdProvider(component) {
  provider = component;
}

export function getAdProvider() {
  return provider;
}

// V1: always ad-free. Later: return true when the user has an active ad-free subscription.
export function isAdFree() {
  return true;
}
