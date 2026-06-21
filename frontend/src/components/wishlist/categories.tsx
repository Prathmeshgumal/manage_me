import { ShoppingBag, MapPin, Target, List } from "lucide-react";
import type { WishlistCategory } from "@/types";

export const CATEGORIES: WishlistCategory[] = ["Items", "Places", "Goals", "Other"];

const ICONS: Record<WishlistCategory, typeof ShoppingBag> = {
  Items: ShoppingBag,
  Places: MapPin,
  Goals: Target,
  Other: List,
};

export function CategoryIcon({ category, className }: { category: WishlistCategory; className?: string }) {
  const Icon = ICONS[category] ?? List;
  return <Icon className={className ?? "size-4"} />;
}
