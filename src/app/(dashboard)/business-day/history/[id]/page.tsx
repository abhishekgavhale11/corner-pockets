import { notFound } from "next/navigation";
import { getBusinessDayHistoryDetailAction } from "@/actions/business-day-history";
import { BusinessDayHistoryDetail } from "@/components/business-day/BusinessDayHistoryDetail";

interface BusinessDayHistoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BusinessDayHistoryDetailPage({
  params,
}: BusinessDayHistoryDetailPageProps) {
  const { id } = await params;
  const detail = await getBusinessDayHistoryDetailAction(id);

  if (!detail) {
    notFound();
  }

  return <BusinessDayHistoryDetail detail={detail} />;
}
