import Link from "next/link";
import {
  NOTEBOOK_SECTION_META,
  NOTEBOOK_SECTIONS,
} from "@/lib/constants/notebook-sections";
import { Card } from "@/components/ui/Card";

export function NotebookHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notebook</h1>
        <p className="mt-1 text-gray-600">
          Tap a section to add an entry, or manage open tabs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {NOTEBOOK_SECTIONS.map((section) => {
          const meta = NOTEBOOK_SECTION_META[section];
          return (
            <Link
              key={section}
              href={`/notebook/${meta.slug}`}
              className="block"
            >
              <Card className="flex min-h-[96px] flex-col items-center justify-center gap-2 p-4 text-center transition-colors hover:border-emerald-600 hover:bg-emerald-50">
                <span className="text-3xl">{meta.emoji}</span>
                <span className="text-sm font-semibold text-gray-900">
                  {meta.label}
                </span>
              </Card>
            </Link>
          );
        })}

        <Link href="/notebook/tabs" className="block">
          <Card className="flex min-h-[96px] flex-col items-center justify-center gap-2 p-4 text-center transition-colors hover:border-emerald-600 hover:bg-emerald-50">
            <span className="text-3xl">📋</span>
            <span className="text-sm font-semibold text-gray-900">Open Tabs</span>
          </Card>
        </Link>

        <Link href="/notebook/closing" className="block">
          <Card className="flex min-h-[96px] flex-col items-center justify-center gap-2 p-4 text-center transition-colors hover:border-emerald-600 hover:bg-emerald-50">
            <span className="text-3xl">💰</span>
            <span className="text-sm font-semibold text-gray-900">
              Daily Closing
            </span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
