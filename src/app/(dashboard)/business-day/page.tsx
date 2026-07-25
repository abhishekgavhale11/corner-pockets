import { getBusinessDayPageData } from "@/actions/business-day";
import { BusinessDayPageClient } from "@/components/business-day/BusinessDayPageClient";

export default async function BusinessDayPage() {
  const data = await getBusinessDayPageData();

  return (
    <BusinessDayPageClient
      current={data.current}
      history={data.history}
      closePreview={data.closePreview}
      canReopen={data.canReopen}
    />
  );
}
