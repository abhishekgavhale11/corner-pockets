import { z } from "zod";

export const finishVisitSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
});
