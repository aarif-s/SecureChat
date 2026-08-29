import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID.");

export const createConversationSchema = z.object({
  participantIds: z.array(objectIdSchema).min(1).max(50),
  type: z.enum(["direct", "group"]).default("direct"),
});

export type CreateConversationInput = z.infer<
  typeof createConversationSchema
>;
