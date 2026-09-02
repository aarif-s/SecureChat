import { request } from "./auth";
import type {
  ConversationResponse,
  ConversationsResponse,
  MessageResponse,
  MessagesResponse,
  UserSearchResponse,
} from "../types/chat";

export function getConversations(): Promise<ConversationsResponse> {
  return request<ConversationsResponse>("/api/conversations");
}

export function searchUsers(query: string): Promise<UserSearchResponse> {
  return request<UserSearchResponse>(
    `/api/users/search?q=${encodeURIComponent(query)}`,
  );
}

export function createConversation(
  participantIds: string[],
  type: "direct" | "group" = "direct",
): Promise<ConversationResponse> {
  return request<ConversationResponse>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ participantIds, type }),
  });
}

export function removeConversation(
  conversationId: string,
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    `/api/conversations/${conversationId}`,
    {
      method: "DELETE",
    },
  );
}

export function getMessages(
  conversationId: string,
): Promise<MessagesResponse> {
  return request<MessagesResponse>(
    `/api/conversations/${conversationId}/messages`,
  );
}

export function sendMessage(
  conversationId: string,
  content: string,
): Promise<MessageResponse> {
  return request<MessageResponse>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
  );
}