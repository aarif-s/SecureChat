import { z } from "zod";

export const userSearchSchema = z.object({
  q: z.string().trim().min(2).max(80),
});

export type UserSearchInput = z.infer<typeof userSearchSchema>;
