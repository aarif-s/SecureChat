import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  getErrorMessage,
  isUnauthorizedError,
  logout,
} from "../../services/auth";
import {
  getConversations,
  createConversation,
  getMessages,
  searchUsers,
  sendMessage,
} from "../../services/chat";
import { createChatSocket, type ChatSocket } from "../../services/socket";
import type { AuthUser } from "../../types/auth";
import type {
  Conversation,
  Message,
  ReactionEmoji,
  UserSummary,
} from "../../types/chat";
import "./chat-page.css";

interface ChatPageProps {
  user: AuthUser;
  onLogout: () => void;
}

function ChatPage({ user, onLogout }: ChatPageProps) {
  const reactionEmojis: ReactionEmoji[] = ["❤️", "👍", "😂", "😮", "😢", "😡"];
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [openReactionMessageId, setOpenReactionMessageId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [socketStatus, setSocketStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveredMessageIdsRef = useRef(new Set<string>());
  const readMessageIdsRef = useRef(new Set<string>());
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollAfterUpdateRef = useRef(false);

  function isMessageListNearBottom(): boolean {
    const messageList = messageListRef.current;
    if (!messageList) return true;

    return (
      messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight <=
      120
    );
  }

  useEffect(() => {
    async function loadConversations() {
      try {
        const response = await getConversations();
        setConversations(response.conversations);
      } catch (loadError: unknown) {
        if (isUnauthorizedError(loadError)) {
          onLogout();
        } else {
          setError(getErrorMessage(loadError));
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadConversations();
  }, [onLogout]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const conversationId = selectedConversationId;

    const socket: ChatSocket = createChatSocket();
    socketRef.current = socket;
    let isMounted = true;

    function appendMessage(message: Message) {
      if (message.conversation !== conversationId) return;
      shouldScrollAfterUpdateRef.current =
        shouldScrollAfterUpdateRef.current || isMessageListNearBottom();
      setMessages((currentMessages) =>
        currentMessages.some((currentMessage) => currentMessage._id === message._id)
          ? currentMessages
          : [...currentMessages, message],
      );

      acknowledgeDelivery(message);
    }

    function acknowledgeDelivery(message: Message): void {
      if (
        message.sender._id === user.id ||
        message.deliveredAt ||
        deliveredMessageIdsRef.current.has(message._id)
      ) return;

      deliveredMessageIdsRef.current.add(message._id);
      socket.emit(
        "message:delivered",
        { conversationId, messageId: message._id },
        () => undefined,
      );
    }

    socket.on("connect", () => {
      if (isMounted) setSocketStatus("connected");
      socket.emit("conversation:join", { conversationId }, (response) => {
        if (!response.success && isMounted) {
          setError(response.error ?? "Unable to join conversation.");
        }
      });
    });
    socket.on("disconnect", () => {
      if (isMounted) {
        setSocketStatus("disconnected");
        setOnlineUserIds([]);
        setTypingUserIds([]);
      }
    });
    socket.on("connect_error", () => {
      if (isMounted) setSocketStatus("error");
    });
    socket.io.on("reconnect_attempt", () => {
      if (isMounted) setSocketStatus("connecting");
    });
    socket.on("message:new", appendMessage);
    socket.on("message:status", (status) => {
      if (!isMounted || status.conversationId !== conversationId) return;
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message._id === status.messageId
            ? {
                ...message,
                deliveredAt: status.deliveredAt,
                readAt: status.readAt,
                status: status.readAt
                  ? "read"
                  : status.deliveredAt
                    ? "delivered"
                    : "sent",
              }
            : message,
        ),
      );
    });
    socket.on("message:reaction", (update) => {
      if (!isMounted || update.conversationId !== conversationId) return;
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message._id === update.messageId
            ? {
                ...message,
                reactions: update.reactions.filter(
                  (reaction) => reaction.userIds.length > 0,
                ),
              }
            : message,
        ),
      );
    });
    socket.on("presence:update", (update) => {
      if (!isMounted || update.userId === user.id) return;
      setOnlineUserIds((currentIds) =>
        update.online
          ? currentIds.includes(update.userId)
            ? currentIds
            : [...currentIds, update.userId]
          : currentIds.filter((userId) => userId !== update.userId),
      );
    });
    socket.on("typing:update", (update) => {
      if (!isMounted || update.conversationId !== conversationId || update.userId === user.id) return;
      setTypingUserIds((currentIds) =>
        update.isTyping
          ? currentIds.includes(update.userId)
            ? currentIds
            : [...currentIds, update.userId]
          : currentIds.filter((userId) => userId !== update.userId),
      );
    });

    socket.connect();

    async function loadMessages() {
      setIsLoadingMessages(true);
      setError(null);
      try {
        const response = await getMessages(conversationId);
        shouldScrollAfterUpdateRef.current = true;
        setMessages(response.messages);
        if (socket.connected) {
          response.messages.forEach(acknowledgeDelivery);
        }
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoadingMessages(false);
      }
    }

    void loadMessages();

    return () => {
      isMounted = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
      setTypingUserIds([]);
      setOnlineUserIds([]);
      socketRef.current = null;
      socket.emit("typing:stop", { conversationId }, () => undefined);
      socket.emit("conversation:leave", { conversationId }, () => undefined);
      socket.disconnect();
    };
  }, [selectedConversationId, user.id]);

  useEffect(() => {
    if (!selectedConversationId || messages.length === 0) return;
    if (!shouldScrollAfterUpdateRef.current) return;

    const messageList = messageListRef.current;
    if (messageList) {
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: "auto",
      });
    }
    shouldScrollAfterUpdateRef.current = false;
  }, [messages.length, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const socket = socketRef.current;
    const messageElements = document.querySelectorAll<HTMLElement>(
      "[data-message-id]",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.75) continue;

          const messageId = (entry.target as HTMLElement).dataset.messageId;
          const message = messages.find((item) => item._id === messageId);
          if (
            !messageId ||
            !message ||
            message.sender._id === user.id ||
            readMessageIdsRef.current.has(messageId) ||
            !socket?.connected
          ) {
            continue;
          }

          readMessageIdsRef.current.add(messageId);
          socket.emit(
            "message:read",
            { conversationId: selectedConversationId, messageId },
            () => undefined,
          );
        }
      },
      { threshold: 0.75 },
    );

    messageElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [messages, selectedConversationId, user.id]);

  function stopTyping(): void {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    const conversationId = selectedConversationId;
    if (conversationId && socketRef.current?.connected) {
      socketRef.current.emit("typing:stop", { conversationId }, () => undefined);
    }
  }

  function handleDraftChange(value: string): void {
    setDraft(value);
    const conversationId = selectedConversationId;
    const socket = socketRef.current;
    if (!conversationId || !socket?.connected) return;

    if (!value.trim()) {
      stopTyping();
      return;
    }

    socket.emit("typing:start", { conversationId }, () => undefined);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 1_500);
  }

  function toggleReaction(message: Message, emoji: ReactionEmoji): void {
    const socket = socketRef.current;
    if (!selectedConversationId || !socket?.connected) return;

    const hasReaction = message.reactions?.some(
      (reaction) => reaction.emoji === emoji && reaction.userIds.includes(user.id),
    ) ?? false;
    socket.emit(
      hasReaction ? "message:reaction:remove" : "message:reaction:add",
      {
        conversationId: selectedConversationId,
        messageId: message._id,
        emoji,
      },
      (response) => {
        if (!response.success) setError(response.error ?? "Unable to update reaction.");
      },
    );
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversationId || !draft.trim()) return;

    setIsSending(true);
    setError(null);
    stopTyping();
    try {
      const content = draft.trim();
      const socket = socketRef.current;
      if (socket?.connected) {
        shouldScrollAfterUpdateRef.current = true;
        await new Promise<void>((resolve, reject) => {
          socket.emit(
            "message:send",
            { conversationId: selectedConversationId, content },
            (response) => {
              if (!response.success) {
                reject(new Error(response.error ?? "Unable to send message."));
                return;
              }
              if (response.message) {
                setMessages((currentMessages) =>
                  currentMessages.some((message) => message._id === response.message?._id)
                    ? currentMessages
                    : [...currentMessages, response.message as Message],
                );
              }
              resolve();
            },
          );
        });
      } else {
        const response = await sendMessage(selectedConversationId, content);
        shouldScrollAfterUpdateRef.current = true;
        setMessages((currentMessages) =>
          currentMessages.some((message) => message._id === response.message._id)
            ? currentMessages
            : [...currentMessages, response.message],
        );
      }
      setDraft("");
    } catch (sendError: unknown) {
      setError(getErrorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setError("Enter at least 2 characters to search.");
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    setSelectedUser(null);
    try {
      const response = await searchUsers(query);
      setSearchResults(response.users);
    } catch (searchError: unknown) {
      setError(getErrorMessage(searchError));
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreateConversation() {
    if (!selectedUser) return;

    setIsCreatingConversation(true);
    setError(null);
    try {
      const response = await createConversation([selectedUser._id]);
      setConversations((currentConversations) => [
        response.conversation,
        ...currentConversations.filter(
          (conversation) => conversation._id !== response.conversation._id,
        ),
      ]);
      shouldScrollAfterUpdateRef.current = true;
      setSelectedConversationId(response.conversation._id);
      setIsNewConversationOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUser(null);
    } catch (createError: unknown) {
      setError(getErrorMessage(createError));
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleLogout() {
    stopTyping();
    try {
      await logout();
      onLogout();
    } catch (logoutError: unknown) {
      setError(getErrorMessage(logoutError));
    }
  }

  const selectedConversation = conversations.find(
    (conversation) => conversation._id === selectedConversationId,
  );
  const otherParticipants = selectedConversation?.participants.filter(
    (participant) => participant._id !== user.id,
  ) ?? [];
  const typingNames = otherParticipants
    .filter((participant) => typingUserIds.includes(participant._id))
    .map((participant) => participant.displayName);
  const selectedParticipant = otherParticipants[0];

  return (
    <main className="chat-page">
      <aside className="chat-sidebar">
        <header className="sidebar-header">
          <div>
            <p className="chat-eyebrow">SecureChat</p>
            <h1>Messages</h1>
          </div>
          <button type="button" className="text-button" onClick={handleLogout}>
            Sign out
          </button>
        </header>

        <section className="profile-summary" aria-label="Current user">
          <span className="profile-avatar">{user.displayName.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
          </div>
        </section>

        <div className="conversation-heading">
          <h2>Conversations</h2>
          <button
            type="button"
            className="new-conversation-button"
            onClick={() => {
              setError(null);
              setIsNewConversationOpen(true);
            }}
          >
            + New
          </button>
        </div>
        <nav aria-label="Conversations" className="conversation-list">
          {isLoading ? <p className="sidebar-note">Loading conversations...</p> : null}
          {!isLoading && conversations.length === 0 ? (
            <p className="sidebar-note">No conversations yet.</p>
          ) : null}
          {conversations.map((conversation) => (
            <button
              type="button"
              className={`conversation-item${selectedConversationId === conversation._id ? " is-selected" : ""}`}
              key={conversation._id}
              onClick={() => {
                setMessages([]);
                shouldScrollAfterUpdateRef.current = true;
                setSelectedConversationId(conversation._id);
              }}
            >
              <span className="conversation-icon">{conversation.type === "group" ? "G" : "D"}</span>
              <span>
                <strong>{conversation.type === "group" ? "Group conversation" : "Direct conversation"}</strong>
                <small>
                  {conversation.participants
                    .filter((participant) => participant._id !== user.id)
                    .map((participant) => participant.displayName)
                    .join(", ") || "You"}
                </small>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="chat-panel" aria-label="Conversation messages">
        {selectedConversation ? (
          <>
            <header className="chat-header">
              <div>
                <p className="chat-eyebrow">{selectedConversation.type}</p>
                <h2>{selectedParticipant?.displayName ?? "Conversation"}</h2>
              </div>
              <div className="chat-header-meta">
                {selectedParticipant ? (
                  <span className={`presence-label${onlineUserIds.includes(selectedParticipant._id) ? " is-online" : ""}`}>
                    {onlineUserIds.includes(selectedParticipant._id) ? "● Online" : "Offline"}
                  </span>
                ) : null}
                <span className={`socket-status socket-status-${socketStatus}`}>
                  {socketStatus === "connected" ? "Live" : socketStatus}
                </span>
              </div>
            </header>
            <div
              className="message-list"
              ref={messageListRef}
            >
              {isLoadingMessages ? <p className="empty-state">Loading messages...</p> : null}
              {!isLoadingMessages && messages.length === 0 ? (
                <p className="empty-state">No messages yet. Start the conversation.</p>
              ) : null}
              {messages.map((message) => (
                <article
                  className={`message${message.sender._id === user.id ? " is-own" : ""}`}
                  data-message-id={message._id}
                  key={message._id}
                >
                  <p className="message-sender">{message.sender.displayName}</p>
                  <p>{message.content}</p>
                  <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                  {message.sender._id === user.id ? (
                    <span className={`message-status message-status-${message.status}`} aria-label={message.status}>
                      {message.status === "sent" ? "✓" : "✓✓"}
                    </span>
                  ) : null}
                    {(message.reactions ?? []).some(
                      (reaction) => reaction.userIds.length > 0,
                    ) ? (
                    <div className="message-reactions" aria-label="Message reactions">
                      {(message.reactions ?? [])
                        .filter((reaction) => reaction.userIds.length > 0)
                        .map((reaction) => (
                        <button
                          type="button"
                          className={`reaction-chip${reaction.userIds.includes(user.id) ? " is-selected" : ""}`}
                          key={reaction.emoji}
                          onClick={() => toggleReaction(message, reaction.emoji)}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.userIds.length}</span>
                        </button>
                        ))}
                    </div>
                  ) : null}
                  <div className="reaction-tools">
                    <button
                      type="button"
                      className="reaction-trigger"
                      aria-label="Add reaction"
                      onClick={() => setOpenReactionMessageId((currentId) => currentId === message._id ? null : message._id)}
                    >
                      +
                    </button>
                    {openReactionMessageId === message._id ? (
                      <div className="reaction-picker" role="group" aria-label="Choose reaction">
                        {reactionEmojis.map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            aria-label={`React ${emoji}`}
                            onClick={() => {
                              toggleReaction(message, emoji);
                              setOpenReactionMessageId(null);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            {typingNames.length > 0 ? (
              <p className="typing-indicator">
                {typingNames.length === 1
                  ? `${typingNames[0]} is typing...`
                  : typingNames.length === 2
                    ? `${typingNames[0]} and ${typingNames[1]} are typing...`
                    : "Several people are typing..."}
              </p>
            ) : null}
            <form className="message-form" onSubmit={handleSend}>
              <textarea
                aria-label="Message"
                placeholder="Write a message..."
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                maxLength={5000}
                rows={1}
                disabled={isSending}
              />
              <button type="submit" disabled={isSending || !draft.trim()}>
                {isSending ? "Sending..." : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div className="empty-state welcome-state">
            <span className="welcome-mark">SC</span>
            <h2>Your conversations, in one place.</h2>
            <p>Select a conversation from the sidebar to view messages.</p>
          </div>
        )}
        {error ? <p className="chat-error" role="alert">{error}</p> : null}
      </section>
      {isNewConversationOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="new-conversation-modal" role="dialog" aria-modal="true" aria-labelledby="new-conversation-title">
            <header className="modal-header">
              <div>
                <p className="chat-eyebrow">Start fresh</p>
                <h2 id="new-conversation-title">New conversation</h2>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Close new conversation"
                onClick={() => setIsNewConversationOpen(false)}
              >
                ×
              </button>
            </header>
            <form className="user-search-form" onSubmit={handleSearch}>
              <label htmlFor="user-search">Search by name or email</label>
              <div>
                <input
                  id="user-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="e.g. Alex or alex@example.com"
                  minLength={2}
                  maxLength={80}
                  autoFocus
                />
                <button type="submit" disabled={isSearching}>
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>
            </form>
            <div className="search-results" aria-live="polite">
              {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <p className="modal-note">No users found.</p>
              ) : null}
              {searchResults.map((searchUser) => (
                <button
                  type="button"
                  className={`user-result${selectedUser?._id === searchUser._id ? " is-selected" : ""}`}
                  key={searchUser._id}
                  onClick={() => setSelectedUser(searchUser)}
                >
                  <span className="profile-avatar">{searchUser.displayName.charAt(0).toUpperCase()}</span>
                  <span>
                    <strong>{searchUser.displayName}</strong>
                    <small>{searchUser.email}</small>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="create-conversation-button"
              disabled={!selectedUser || isCreatingConversation}
              onClick={handleCreateConversation}
            >
              {isCreatingConversation ? "Creating..." : "Create conversation"}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default ChatPage;
