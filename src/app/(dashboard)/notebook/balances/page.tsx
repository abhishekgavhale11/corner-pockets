import { redirect } from "next/navigation";

/** Outstanding is a Customers page filter — keep old bookmarks working. */
export default function BalancesPage() {
  redirect("/customers?filter=outstanding");
}
