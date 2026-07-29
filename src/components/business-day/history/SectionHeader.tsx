import type { ReactNode } from "react";
import {
  historyToneIcon,
  historyUi,
} from "@/components/business-day/history/tokens";
import type { HistoryTone } from "@/components/business-day/history/tokens";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: HistoryTone;
  trailing?: ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  tone = "neutral",
  trailing,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${historyToneIcon(tone)}`}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className={historyUi.sectionTitle}>{title}</h2>
          {subtitle ? (
            <p className={historyUi.sectionSubtitle}>{subtitle}</p>
          ) : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}
