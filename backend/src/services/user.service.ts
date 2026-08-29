import { UserModel } from "../models/User.js";
import type { UserSearchInput } from "../schemas/user.schema.js";

const USER_SEARCH_LIMIT = 20;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchUsers(
  currentUserId: string,
  input: UserSearchInput,
) {
  const searchPattern = new RegExp(escapeRegex(input.q), "i");

  return UserModel.find({
    _id: { $ne: currentUserId },
    $or: [
      { displayName: searchPattern },
      { email: searchPattern },
    ],
  })
    .select("_id displayName email")
    .sort({ displayName: 1, _id: 1 })
    .limit(USER_SEARCH_LIMIT)
    .lean();
}
