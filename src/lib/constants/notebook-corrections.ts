export const NOTEBOOK_CORRECTION_FIELDS = [
  "customer",
  "entryType",
  "amount",
  "playerCount",
  "quantity",
  "itemNote",
] as const;

export type NotebookCorrectionField =
  (typeof NOTEBOOK_CORRECTION_FIELDS)[number];
