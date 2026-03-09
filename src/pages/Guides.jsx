import React from "react";
import GuideCard from "@/components/laundry/GuideCard";
import { Thermometer, Palette, Droplets, Wind } from "lucide-react";
import { motion } from "framer-motion";

const guides = [
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
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Laundry Guides</h1>
        <p className="text-muted-foreground text-sm mb-6">Quick reference for common laundry questions.</p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {guides.map((guide) => (
            <GuideCard key={guide.title} {...guide} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}