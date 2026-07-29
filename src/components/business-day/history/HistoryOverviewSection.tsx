import type { ReactNode } from "react";
import { SectionHeader } from "@/components/business-day/history/SectionHeader";
import { HistoryMetricCard } from "@/components/business-day/history/HistoryMetricCard";
import {
  historyUi,
  type HistoryTone,
} from "@/components/business-day/history/tokens";

export type HistoryMetric = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone?: HistoryTone;
  icon?: ReactNode;
};

interface HistoryOverviewSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: HistoryTone;
  metrics: HistoryMetric[];
  /** Optional denser secondary content under metrics. */
  children?: ReactNode;
}

export function HistoryOverviewSection({
  title,
  subtitle,
  icon,
  tone = "neutral",
  metrics,
  children,
}: HistoryOverviewSectionProps) {
  return (
    <section className={`${historyUi.card} ${historyUi.cardPad}`}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        tone={tone}
      />
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          metrics.length >= 5
            ? "lg:grid-cols-3 xl:grid-cols-5"
            : metrics.length === 4
              ? "lg:grid-cols-4"
              : "lg:grid-cols-3"
        } ${historyUi.gapMetrics}`}
      >
        {metrics.map((metric) => (
          <HistoryMetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            tone={metric.tone}
            icon={metric.icon}
          />
        ))}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
