import { redirect } from "next/navigation";
import { getSectionBySlug } from "@/lib/constants/notebook-sections";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";

const MAP: Record<string, string> = {
  "big-snooker-1": "/counter/big-snooker",
  "big-snooker-2": "/counter/big-snooker",
  "big-snooker-3": "/counter/big-snooker",
  "mini-snooker": "/counter/pool-mini",
  "pool-1": "/counter/pool-mini",
  "pool-2": "/counter/pool-mini",
  cafe: "/counter/cafe",
};

export default async function LegacyNotebookSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = getSectionBySlug(slug);
  if (section === CAFE_SECTION) {
    redirect("/counter/cafe");
  }
  redirect(MAP[slug] ?? "/counter/big-snooker");
}
