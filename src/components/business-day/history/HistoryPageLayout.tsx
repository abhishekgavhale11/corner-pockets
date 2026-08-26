import type { ReactNode } from "react";
import { historyUi } from "@/components/business-day/history/tokens";

interface HistoryPageLayoutProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}

export function HistoryPageLayout({
  title,
  subtitle,
  actions,
  tabs,
  filters,
  children,
  compact = false,
}: HistoryPageLayoutProps) {
  return (
    <div className={compact ? "space-y-3" : historyUi.spaceY}>
      {title || subtitle || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h1
                className={
                  compact
                    ? "text-[24px] font-semibold tracking-tight text-gray-900"
                    : historyUi.pageTitle
                }
              >
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className={historyUi.pageSubtitle}>{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      {filters}
      {tabs}
      {children}
    </div>
  );
}
