import { Router } from "express";

import { requireAuthentication } from "../middleware/auth.js";
import {
  getConversations,
  postConversation,
} from "../controllers/conversation.controller.js";
import {
  getMessages,
  postMessage,
} from "../controllers/message.controller.js";

const router = Router();

router.use(requireAuthentication);
router.get("/", getConversations);
router.post("/", postConversation);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", postMessage);

export default router;
