import { Types } from "mongoose";
import type { Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendMessageSchema } from "../schemas/message.schema.js";
import {
  ConversationNotAccessibleError,
} from "../services/conversation.service.js";
import {
  listMessages,
  sendMessage,
} from "../services/message.service.js";

function isValidConversationId(value: unknown): value is string {
  return typeof value === "string" && Types.ObjectId.isValid(value);
}

export async function getMessages(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return;
  }

  const { conversationId } = req.params;
  if (!isValidConversationId(conversationId)) {
    res.status(400).json({ success: false, error: "Invalid conversation ID." });
    return;
  }

  try {
    const messages = await listMessages(conversationId, req.userId);
    res.status(200).json({ success: true, messages });
  } catch (error: unknown) {
    if (error instanceof ConversationNotAccessibleError) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    throw error;
  }
}

export async function postMessage(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return;
  }

  const { conversationId } = req.params;
  const result = sendMessageSchema.safeParse(req.body);
  if (!isValidConversationId(conversationId) || !result.success) {
    res.status(400).json({ success: false, error: "Invalid message data." });
    return;
  }

  try {
    const message = await sendMessage(conversationId, req.userId, result.data);
    res.status(201).json({ success: true, message });
  } catch (error: unknown) {
    if (error instanceof ConversationNotAccessibleError) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    throw error;
  }
}
