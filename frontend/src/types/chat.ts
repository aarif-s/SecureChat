export type ConversationType = "direct" | "group";

export type MessageStatus = "sent" | "delivered" | "read";

export type ReactionEmoji = "❤️" | "👍" | "😂" | "😮" | "😢" | "😡";

export interface MessageReaction {
  emoji: ReactionEmoji;
  userIds: string[];
}

export interface UserSummary {
  _id: string;
  displayName: string;
  email: string;
}

export interface Conversation {
  _id: string;
  participants: UserSummary[];
  type: ConversationType;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: UserSummary;
  content: string;
  isEdited: boolean;
  deletedAt?: string | null;
  status: MessageStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  reactions?: MessageReaction[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationsResponse {
  success: true;
  conversations: Conversation[];
}

export interface MessagesResponse {
  success: true;
  messages: Message[];
}

export interface ConversationResponse {
  success: true;
  conversation: Conversation;
}

export interface MessageResponse {
  success: true;
  message: Message;
}

export interface UserSearchResponse {
  success: true;
  users: UserSummary[];
}