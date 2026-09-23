// The room names both namespaces address.
//
// These were written as template literals at every call site — `site:${siteId}`
// in 27 places, `user:${agentId}` in 9, `conversation:${id}` in 11. A room name
// is a string both the sender and the joiner have to agree on, and a typo in
// either half produces no error at all: the message is simply delivered to an
// empty room. Building them in one place makes that agreement checkable.

export const siteRoom = (siteId: unknown): string => `site:${String(siteId)}`;

export const userRoom = (userId: unknown): string => `user:${String(userId)}`;

export const conversationRoom = (conversationId: unknown): string =>
  `conversation:${String(conversationId)}`;

export const teamChatRoom = (chatId: unknown): string => `team-chat:${String(chatId)}`;
