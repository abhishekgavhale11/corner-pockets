import type { ReactNode } from "react";
import { historyUi } from "@/components/business-day/history/tokens";

interface HistoryPageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}

export function HistoryPageLayout({
  title,
  subtitle,
  actions,
  tabs,
  filters,
  children,
}: HistoryPageLayoutProps) {
  return (
    <div className={historyUi.spaceY}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={historyUi.pageTitle}>{title}</h1>
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
      {tabs}
      {filters}
      {children}
    </div>
  );
}
