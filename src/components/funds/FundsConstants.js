export const FUND_TYPES = [
  { value: "laundry_card", label: "Laundry Card", unit: "dollars", defaultThreshold: 10, emoji: "💳" },
  { value: "credits", label: "Laundry Credits", unit: "credits", defaultThreshold: 5, emoji: "🎟️" },
  { value: "quarters", label: "Quarters", unit: "dollars", defaultThreshold: 3, emoji: "🪙" },
  { value: "cash", label: "Cash Reserved for Laundry", unit: "dollars", defaultThreshold: 10, emoji: "💵" },
];

export function formatBalance(fund) {
  if (fund.unit === "credits") {
    return `${fund.balance} Credit${fund.balance === 1 ? "" : "s"} Remaining`;
  }
  return `$${Number(fund.balance).toFixed(2)} Available`;
}