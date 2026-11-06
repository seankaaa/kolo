/** One place for category colors: { color (dot/marker), tint (background), ink (text on tint) }. */
export type CategoryStyle = { color: string; tint: string; ink: string; tw: { tint: string; ink: string; dot: string } };

const PALETTES = {
  beauty: { color: "#D88A9B", tint: "#F8E7EB", ink: "#8E3B50", tw: { tint: "bg-beauty-tint", ink: "text-beauty-ink", dot: "bg-beauty" } },
  cleaning: { color: "#6EA6C6", tint: "#E3EFF6", ink: "#2D5E7C", tw: { tint: "bg-cleaning-tint", ink: "text-cleaning-ink", dot: "bg-cleaning" } },
  food: { color: "#D9A05E", tint: "#F7ECDD", ink: "#86561C", tw: { tint: "bg-food-tint", ink: "text-food-ink", dot: "bg-food" } },
  childcare: { color: "#9F90D4", tint: "#ECE8F8", ink: "#4E3F8C", tw: { tint: "bg-childcare-tint", ink: "text-childcare-ink", dot: "bg-childcare" } },
  tailoring: { color: "#86AE7E", tint: "#E7F0E3", ink: "#3F6236", tw: { tint: "bg-tailoring-tint", ink: "text-tailoring-ink", dot: "bg-tailoring" } },
} satisfies Record<string, CategoryStyle>;

const MAP: Record<string, keyof typeof PALETTES> = {
  food: "food", bakery: "food", cafe: "food",
  childcare: "childcare", eldercare: "childcare", interpreting: "childcare",
  cleaning: "cleaning", tutoring: "cleaning",
  tailoring: "tailoring", petsitting: "tailoring",
  beauty: "beauty",
};

export function categoryStyle(category: string): CategoryStyle {
  return PALETTES[MAP[category] ?? "food"];
}
