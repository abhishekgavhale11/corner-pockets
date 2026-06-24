import Link from "next/link";
import { getDailyClosing } from "@/actions/notebook-closing";
import { DailyClosingView } from "@/components/notebook/DailyClosingView";

export default async function AdminClosingPage() {
  const closing = await getDailyClosing({});

  if (!closing) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Link
        href="/admin"
        className="text-xs font-medium text-emerald-800 hover:underline"
      >
        ← Admin
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Daily Closing</h1>
        <p className="text-xs text-gray-500">Today&apos;s collections and pending.</p>
      </div>
      <DailyClosingView closing={closing} />
    </div>
  );
}
