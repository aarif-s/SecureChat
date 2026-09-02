
import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const editMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
