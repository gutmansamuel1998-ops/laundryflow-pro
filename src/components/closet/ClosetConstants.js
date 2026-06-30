export const CATEGORIES = [
  { id: "shirts", label: "Shirts", emoji: "👕" },
  { id: "pants", label: "Pants", emoji: "👖" },
  { id: "jeans", label: "Jeans", emoji: "👖" },
  { id: "shorts", label: "Shorts", emoji: "🩳" },
  { id: "dresses", label: "Dresses", emoji: "👗" },
  { id: "skirts", label: "Skirts", emoji: "👗" },
  { id: "jackets", label: "Jackets", emoji: "🧥" },
  { id: "sweaters", label: "Sweaters", emoji: "🧶" },
  { id: "coats", label: "Coats", emoji: "🥼" },
  { id: "pajamas", label: "Pajamas", emoji: "😴" },
  { id: "underwear", label: "Underwear", emoji: "🩲" },
  { id: "socks", label: "Socks", emoji: "🧦" },
  { id: "towels", label: "Towels", emoji: "🏖️" },
  { id: "bedding", label: "Bedding", emoji: "🛏️" },
  { id: "uniforms", label: "Uniforms", emoji: "👔" },
  { id: "activewear", label: "Activewear", emoji: "🏃" },
  { id: "swimwear", label: "Swimwear", emoji: "🩱" },
  { id: "accessories", label: "Accessories", emoji: "🧤" },
  { id: "tops", label: "Tops", emoji: "👕" },
  { id: "bottoms", label: "Bottoms", emoji: "👖" },
  { id: "outerwear", label: "Outerwear", emoji: "🧥" },
  { id: "delicates", label: "Delicates", emoji: "🧸" },
  { id: "other", label: "Other", emoji: "📦" },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export const COLORS = [
  { id: "white", label: "White", dot: "bg-gray-100 border-gray-300" },
  { id: "light", label: "Light", dot: "bg-gray-200 border-gray-300" },
  { id: "dark", label: "Dark", dot: "bg-gray-700 border-gray-600" },
  { id: "color", label: "Colors", dot: "bg-gradient-to-br from-red-400 to-blue-400" },
  { id: "mixed", label: "Mixed", dot: "bg-gradient-to-br from-gray-200 to-gray-700" },
];

export const LAUNDRY_TAGS = [
  { id: "delicate", label: "Delicate", emoji: "🌸" },
  { id: "air_dry", label: "Air Dry", emoji: "💨" },
  { id: "hang_dry", label: "Hang Dry", emoji: "👕" },
  { id: "wash_separately", label: "Wash Separately", emoji: "🔒" },
  { id: "heavy_fabric", label: "Heavy Fabric", emoji: "🪨" },
  { id: "stain_prone", label: "Stain-Prone", emoji: "⚠️" },
  { id: "bleach_safe", label: "Bleach Safe", emoji: "🧪" },
  { id: "athletic_wear", label: "Athletic Wear", emoji: "💪" },
  { id: "school_uniform", label: "School Uniform", emoji: "🎒" },
  { id: "work_uniform", label: "Work Uniform", emoji: "💼" },
  { id: "frequently_worn", label: "Frequently Worn", emoji: "🔄" },
  { id: "seasonal", label: "Seasonal", emoji: "📅" },
];

export const LAUNDRY_TAG_MAP = Object.fromEntries(LAUNDRY_TAGS.map(t => [t.id, t]));

export const LAUNDRY_STATUSES = [
  { id: "clean", label: "Clean", emoji: "✅", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "dirty", label: "Dirty", emoji: "🧺", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "in_wash", label: "In Wash", emoji: "🌀", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "drying", label: "Drying", emoji: "💨", color: "bg-sky-100 text-sky-800 border-sky-200" },
  { id: "unavailable", label: "Unavailable", emoji: "⏸️", color: "bg-gray-100 text-gray-600 border-gray-200" },
];

export const LAUNDRY_STATUS_MAP = Object.fromEntries(LAUNDRY_STATUSES.map(s => [s.id, s]));

export const DRY_METHODS = [
  { id: "tumble_low", label: "Tumble Low", emoji: "🌡️" },
  { id: "tumble_medium", label: "Tumble Medium", emoji: "🔥" },
  { id: "tumble_high", label: "Tumble High", emoji: "🔥🔥" },
  { id: "hang_dry", label: "Hang Dry", emoji: "👕" },
  { id: "lay_flat", label: "Lay Flat", emoji: "📋" },
  { id: "air_dry", label: "Air Dry", emoji: "💨" },
];

export const DRY_METHOD_MAP = Object.fromEntries(DRY_METHODS.map(d => [d.id, d]));

export const LIFESTYLES = [
  { id: "casual", label: "Casual", emoji: "😊" },
  { id: "gym", label: "Gym", emoji: "💪" },
  { id: "beach", label: "Beach", emoji: "🏖️" },
  { id: "business_casual", label: "Business Casual", emoji: "👔" },
  { id: "formal", label: "Formal", emoji: "🎩" },
  { id: "lounge", label: "Lounge", emoji: "🛋️" },
  { id: "outdoor", label: "Outdoor", emoji: "🏕️" },
  { id: "other", label: "Other", emoji: "📦" },
];

export const LIFESTYLE_MAP = Object.fromEntries(LIFESTYLES.map(l => [l.id, l]));

export const WASH_CYCLES = [
  { id: "cold_delicate", label: "Cold / Delicate" },
  { id: "cold_normal", label: "Cold / Normal" },
  { id: "warm_normal", label: "Warm / Normal" },
  { id: "hot_normal", label: "Hot / Normal" },
  { id: "hot_heavy", label: "Hot / Heavy Duty" },
];

export const SUPPLIES = [
  "Regular Detergent", "Color-Safe Detergent", "Bleach",
  "Fabric Softener", "Wool & Delicate Wash", "Stain Remover Spray"
];

export const SHRINK_PRONE_FABRICS = ["cotton", "wool", "linen", "cashmere", "rayon", "bamboo", "silk"];

export function isShrinkRisk(item) {
  const fabric = (item.fabric_composition || "").toLowerCase();
  const care = (item.care_instructions || "").toLowerCase();
  return SHRINK_PRONE_FABRICS.some(f => fabric.includes(f)) ||
    care.includes("do not tumble") || care.includes("hang dry") ||
    care.includes("air dry") || care.includes("lay flat");
}

export const EMPTY_FORM = {
  name: "",
  category: "shirts",
  color: "color",
  laundry_status: "",
  laundry_tags: [],
  assigned_to: "",
  lifestyle: "",
  is_new_garment: false,
  is_wrinkle_free: false,
  requires_ironing: false,
  preferred_dry_method: "",
  fabric_composition: "",
  care_instructions: "",
  image_url: "",
  notes: "",
};