import Link from "next/link";
import { getDailyClosing } from "@/actions/notebook-closing";
import { DailyClosingView } from "@/components/notebook/DailyClosingView";

export default async function DailyClosingPage() {
  const closing = await getDailyClosing({});

  if (!closing) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/notebook"
        className="text-sm font-medium text-emerald-800 hover:underline"
      >
        ← Notebook
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daily Closing</h1>
        <p className="mt-1 text-gray-600">Today&apos;s collections and pending.</p>
      </div>
      <DailyClosingView closing={closing} />
    </div>
  );
}
