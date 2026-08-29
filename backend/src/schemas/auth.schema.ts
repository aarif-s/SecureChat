import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254),

  password: z
    .string()
    .min(12)
    .max(128),

  displayName: z
    .string()
    .trim()
    .min(1)
    .max(80),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254),

  password: z
    .string()
    .min(1)
    .max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;