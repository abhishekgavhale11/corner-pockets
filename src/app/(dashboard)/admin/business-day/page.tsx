import { redirect } from "next/navigation";

/** Admin hub deep-link — Business Day is available to all staff at /business-day. */
export default function AdminBusinessDayRedirectPage() {
  redirect("/business-day");
}
