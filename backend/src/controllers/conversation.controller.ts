import { Types } from "mongoose";
import type { Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import { createConversationSchema } from "../schemas/conversation.schema.js";
import {
  ConversationValidationError,
  createConversation,
  listConversations,
} from "../services/conversation.service.js";

export async function getConversations(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return;
  }

  const conversations = await listConversations(req.userId);
  res.status(200).json({ success: true, conversations });
}

export async function postConversation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return;
  }

  const result = createConversationSchema.safeParse(req.body);
  if (!result.success || !Types.ObjectId.isValid(req.userId)) {
    res.status(400).json({ success: false, error: "Invalid conversation data." });
    return;
  }

  try {
    const conversation = await createConversation(req.userId, result.data);
    res.status(201).json({ success: true, conversation });
  } catch (error: unknown) {
    if (error instanceof ConversationValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    throw error;
  }
}
