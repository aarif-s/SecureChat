import type { Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import { userSearchSchema } from "../schemas/user.schema.js";
import { searchUsers } from "../services/user.service.js";

export async function getUserSearch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
    });
    return;
  }

  const result = userSearchSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: "Search query must be between 2 and 80 characters.",
    });
    return;
  }

  const users = await searchUsers(req.userId, result.data);
  res.status(200).json({ success: true, users });
}
