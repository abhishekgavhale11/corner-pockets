import { redirect } from "next/navigation";

/** Legacy Staff page — Users live under Settings. */
export default function StaffPage() {
  redirect("/admin/settings/users");
}
