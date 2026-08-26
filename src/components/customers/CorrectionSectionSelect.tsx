import { Label } from "@/components/ui/Label";
import {
  FINANCIAL_CORRECTION_SECTION_LABELS,
  FINANCIAL_CORRECTION_SECTIONS,
  isFinancialCorrectionSection,
  type FinancialCorrectionSection,
} from "@/lib/constants/financial-corrections";

interface CorrectionSectionSelectProps {
  id: string;
  value: FinancialCorrectionSection | "";
  disabled?: boolean;
  /** When true, staff must pick a section — no Cafe/Snooker default. */
  allowEmpty?: boolean;
  onChange: (section: FinancialCorrectionSection | "") => void;
}

export function CorrectionSectionSelect({
  id,
  value,
  disabled,
  allowEmpty = false,
  onChange,
}: CorrectionSectionSelectProps) {
  return (
    <div>
      <Label htmlFor={id}>
        Section <span className="text-red-600">*</span>
      </Label>
      <select
        id={id}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "" && allowEmpty) {
            onChange("");
            return;
          }
          if (isFinancialCorrectionSection(next)) {
            onChange(next);
          }
        }}
      >
        {allowEmpty ? <option value="">Select a section</option> : null}
        {FINANCIAL_CORRECTION_SECTIONS.map((section) => (
          <option key={section} value={section}>
            {FINANCIAL_CORRECTION_SECTION_LABELS[section]}
          </option>
        ))}
      </select>
    </div>
  );
}
