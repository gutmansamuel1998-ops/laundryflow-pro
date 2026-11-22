// What the "Earlier features" area of Settings & Care lists, and the words around it (P7).
//
// Nothing here removes or hides anything: every page that used to be reachable from "Earlier features" still is, at the
// same address, with the same saved data. The only change is grouping. Three older stand-alone tools whose job is now
// done inside the main laundry experience (air-dry tracker, ironing queue, laundry calendar) sit together under their own
// subsection with a plain explanation; every other earlier feature stays in a second list, in its original order.
//
// Pure data and strings: no imports, no storage, no dates, no network. The component that shows it is
// src/components/settings/EarlierFeatures.jsx; earlierFeatures.test.js and earlierFeaturesRender.test.js check both.

// The older stand-alone tools. `note` says how each one relates to the newer feature; it never says the older tool is gone,
// because it is not. Air-dry tracker and Ironing queue have a newer version inside the main laundry experience. The Laundry
// calendar does NOT: "My laundry days" is a simpler plan, not a recreation of the calendar, and its note says so.
export const OLDER_TOOLS = [
  {
    label: "Air-dry tracker",
    page: "AirDryTracker",
    note: "The older, separate list for clothes that are drying. Air-drying now happens inside your laundry session.",
  },
  {
    label: "Ironing queue",
    page: "IroningQueue",
    note: "The older, separate ironing list. The optional ironing list after drying is the current version.",
  },
  {
    label: "Laundry calendar",
    page: "LaundryCalendar",
    note: "Still the full Laundry calendar. “My laundry days” above is a simpler plan for your regular days and doesn't replace it.",
  },
];

// Every other earlier feature, in the order they have always been listed.
export const OTHER_EARLIER = [
  { label: "Previous home screen", page: "LegacyHome" },
  { label: "Previous settings", page: "Settings" },
  { label: "Load history", page: "Loads" },
  { label: "Digital closet", page: "DigitalCloset" },
  { label: "Supplies", page: "Supplies" },
  { label: "Shopping list", page: "ShoppingList" },
  { label: "Household", page: "HouseholdManagement" },
  { label: "Laundry funds", page: "LaundryFunds" },
  { label: "Bubbles chat (earlier version)", page: "Bubbles" },
];

export const EARLIER_COPY = {
  heading: "Earlier features",
  intro:
    "These are from the previous version. They're kept out of the main menu to keep things simple, and everything you saved in them is still there.",
  disclosure: "Open the earlier tools",

  olderHeading: "Older tools",
  olderIntro: "Air-drying and optional ironing now work inside your main laundry experience, so everyday laundry doesn't need the separate air-dry tracker or ironing queue.",
  currentHeading: "Newer options",
  currentItems: [
    "Air-drying: choose “I'll air-dry instead” on the dryer step of a laundry session.",
    "Ironing: turn on “Offer an ironing list after drying” in the Ironing section above. It's optional and off until you turn it on.",
    "Regular days: “My laundry days” above is a simpler plan for the days you'd like to do laundry. It doesn't replace the Laundry calendar.",
  ],
  olderListLabel: "Older tools, still available",
  olderTag: "Older tool",
  keptNote: "These older tools still work and still keep what you saved in them. Nothing in them is moved into the newer features automatically.",

  otherHeading: "Other earlier features",
  otherIntro: "These are unchanged and still available.",
};
