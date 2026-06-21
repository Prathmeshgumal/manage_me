/** Everything in the wishlist is tracked in Indian Rupees. */
export const CURRENCY = "INR";

export function formatINR(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
