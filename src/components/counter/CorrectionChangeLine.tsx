interface CorrectionChangeLineProps {
  from: string;
  to: string;
  className?: string;
}

export function CorrectionChangeLine({
  from,
  to,
  className = "",
}: CorrectionChangeLineProps) {
  return (
    <span
      className={`block truncate text-[12px] leading-tight text-gray-800 ${className}`}
    >
      <span className="text-gray-400 line-through">{from}</span>
      <span className="mx-1 text-gray-500">→</span>
      <span className="font-semibold text-gray-900">{to}</span>
    </span>
  );
}
