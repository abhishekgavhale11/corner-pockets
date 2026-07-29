import type {
  BusinessDayHistoryDetailDTO,
  BusinessDayHistoryInsightsDTO,
} from "@/types";

/**
 * Client-safe presentation helper.
 * Uses Final Summary insights already on the detail DTO — never imports mongoose.
 */
export function buildDetailHistoryInsights(
  detail: BusinessDayHistoryDetailDTO
): BusinessDayHistoryInsightsDTO {
  if (!detail.insights) {
    throw new Error(
      "Business Day History detail is missing Final Summary insights."
    );
  }
  return {
    ...detail.insights,
    overall: {
      ...detail.insights.overall,
      outstandingRecovered: detail.outstandingTrend.outstandingRecovered,
    },
  };
}
