import React from "react";
import GuideCard from "@/components/laundry/GuideCard";
import { Thermometer, Palette, Droplets, Wind, ShieldAlert, Minimize2 } from "lucide-react";
import { motion } from "framer-motion";

const guides = [
  {
    title: "First Wash — Preventing Color Bleed",
    icon: ShieldAlert,
    color: "bg-amber-50 text-amber-600",
    highlight: true,
    intro: "New garments often have excess dye that bleeds in the first wash. Follow these steps to protect your clothes.",
    items: [
      { label: "Always use cold water", text: "Heat opens fabric fibers and releases dye. Cold water (60–80°F) keeps dye locked in and dramatically reduces bleeding." },
      { label: "Wash new items alone or by color", text: "Never mix brand-new dark or bright garments with whites or light colors for the first 2–3 washes." },
      { label: "Turn garments inside out", text: "Flipping clothes inside out reduces friction on the outer surface, preserving color and preventing dye transfer." },
      { label: "Use a color catcher sheet", text: "Products like Shout Color Catchers absorb loose dye in the wash water, protecting everything else in the load." },
      { label: "Skip the fabric softener", text: "Fabric softener can interfere with dye setting and spread loose dye unevenly across the load." },
      { label: "Use a gentle or delicate cycle", text: "Less agitation = less dye released. Choose the shortest, gentlest cycle available for new items." },
      { label: "Hang dry after the first wash", text: "Dryer heat can set any remaining transferred dye permanently. Air dry after the first wash to be safe." },
      { label: "Check for bleeding before mixing", text: "Dampen a white cloth and rub it on the garment. If color transfers, repeat the first-wash process before mixing with other clothes." },
    ],
  },
  {
    title: "Water Temperature",
    icon: Thermometer,
    color: "bg-red-50 text-red-500",
    items: [
      { label: "Cold (60–80°F)", text: "Best for darks, delicates, and everyday clothes. Saves energy and prevents shrinking." },
      { label: "Warm (90–110°F)", text: "Good for towels, moderately dirty clothes, and permanent press fabrics." },
      { label: "Hot (130°F+)", text: "Use for whites, heavily soiled items, or bedding. Can cause shrinking in some fabrics." },
    ],
  },
  {
    title: "Sorting Colors",
    icon: Palette,
    color: "bg-purple-50 text-purple-500",
    items: [
      { label: "Whites", text: "Wash separately to keep them bright. Use hot or warm water." },
      { label: "Darks", text: "Wash in cold water, inside out. This prevents fading." },
      { label: "Brights / Colors", text: "Wash in cold water. New colored items may bleed — wash separately the first few times." },
      { text: "Not sure? Cold water with mixed items is almost always safe." },
    ],
  },
  {
    title: "Detergent Basics",
    icon: Droplets,
    color: "bg-blue-50 text-blue-500",
    items: [
      { text: "Use the amount recommended on the bottle — more isn't better." },
      { label: "HE machines", text: "High Efficiency machines need HE detergent. Using regular detergent makes too many suds." },
      { label: "Pods", text: "Place pods at the bottom of the drum before adding clothes." },
      { text: "Liquid detergent works well in cold water. Powder may not dissolve fully in cold." },
    ],
  },
  {
    title: "Preventing Shrinkage in the Dryer",
    icon: Minimize2,
    color: "bg-orange-50 text-orange-500",
    highlight: true,
    intro: "Heat and agitation are the two main causes of shrinkage. These tips will keep your clothes fitting the way they should.",
    items: [
      { label: "Always check the care label", text: "Look for symbols like a square with a circle (tumble dry) or an X through it (do not tumble dry). When in doubt, air dry." },
      { label: "Use low or no heat", text: "High heat causes fibers to contract. Use the lowest heat setting that still dries your clothes effectively." },
      { label: "Remove clothes while slightly damp", text: "Taking clothes out before they're bone dry prevents over-shrinking and reduces wrinkles. Hang to finish air drying." },
      { label: "Use a mesh laundry bag", text: "Mesh bags reduce agitation and friction in the dryer, which is especially important for knitwear and delicates." },
      { label: "Dry synthetics on low or air-only", text: "Polyester, nylon, and spandex are heat-sensitive. Even 'medium' heat can warp or shrink them over time." },
      { label: "Never over-dry", text: "Over-drying is the #1 cause of gradual shrinkage. Use timed dry instead of 'auto dry' if your machine runs hot." },
      { label: "Air dry cotton, wool & linen", text: "These natural fibers shrink the most in heat. Lay flat or hang to dry whenever possible." },
      { label: "Don't overload the dryer", text: "Overcrowding creates more friction and uneven heat distribution, both of which accelerate shrinkage." },
    ],
  },
  {
    title: "Drying Tips",
    icon: Wind,
    color: "bg-teal-50 text-teal-500",
    items: [
      { label: "Low heat", text: "Best for delicates, synthetics, and anything you don't want to shrink." },
      { label: "Medium heat", text: "Good for towels and cotton items." },
      { label: "High heat", text: "Use sparingly — can shrink clothes and wear out elastic." },
      { text: "Clean the lint trap before every load for better performance and safety." },
      { text: "Don't overload the dryer — clothes need room to tumble." },
    ],
  },
];

export default function Guides() {
  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">Laundry Guides</h1>
          <p className="text-muted-foreground text-sm mb-6">Quick reference for common laundry questions.</p>
        </header>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
          role="list"
          aria-label="Laundry guide topics"
        >
          {guides.map((guide) => (
            <article key={guide.title} role="listitem">
              <GuideCard {...guide} />
            </article>
          ))}
        </motion.div>
      </div>
    </div>
  );
}