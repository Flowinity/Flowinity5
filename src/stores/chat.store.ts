import { computed, onMounted, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { Chat, ChatEmoji, ChatRank, Message } from "@/gql/graphql";
import { MessageType, ScrollPosition } from "@/gql/graphql";
import { useFriendsStore } from "@/stores/friends.store";
import { useUserStore } from "@/stores/user.store";
import dayjs from "@/plugins/dayjs";

import { useApolloClient, useMutation } from "@vue/apollo-composable";
import { RailMode, useAppStore } from "@/stores/app.store";
import { useMessagesStore } from "@/stores/messages.store";
import { gql } from "@apollo/client";
import { ChatsQuery } from "@/graphql/chats/chats.graphql";
import { ReadChatMutation } from "@/graphql/chats/readChat.graphql";
import { ChatPermissions } from "@/components/Workspaces/EditorV2/Core/typescache/tpu-typecache";

export const useChatStore = defineStore("chat", () => {
  const chats = ref<Chat[]>([]);
  const selectedChatAssociationId = ref(0);
  const selectedChat = computed(() => {
    return chats.value.find(
      (chat) => chat.association?.id === selectedChatAssociationId.value
    );
  });
  const trustedDomains = ref<string[]>([]);
  const drafts = ref<Record<number, string>>({});
  const emoji = ref<ChatEmoji[]>([]);
  const recentEmoji = ref<Record<string, number>>({});
  const loading = ref(false);
  const isReady = ref(0);
  const { resolveClient } = useApolloClient();
  const client = resolveClient();
  const messagesStore = useMessagesStore();
  const typers = ref<
    {
      chatId: number;
      userId: number;
      expires: Date | string;
      timeout: number;
    }[]
  >([]);

  function lookupChat(id: number) {
    return (
      (chats.value.find((chat) => chat.id === id) as Chat) ||
      ({
        name: "Unknown Chat"
      } as Chat)
    );
  }

  function chatName(chat: Chat) {
    if (!chat) return "Communications";
    if (chat.type === "direct") {
      return useFriendsStore().getName(chat?.recipient) || "Deleted User";
    } else {
      const userStore = useUserStore();
      const friendStore = useFriendsStore();
      if (chat.name === "Unnamed Group") {
        const users = chat.users
          .filter((user) => user.userId !== userStore.user?.id)
          .map(
            (user) =>
              friendStore.getName(userStore.users[user.userId]) ||
              "Deleted User"
          );

        const limitedUsers = users.slice(0, 3); // Get the first 3 users

        const remainingUsersCount = Math.max(0, users.length - 3); // Calculate the remaining users count

        return `${limitedUsers.join(", ")}${
          remainingUsersCount > 0 ? `, +${remainingUsersCount} others` : ""
        }`;
      }
      return chat.name;
    }
  }

  async function type() {
    const mutate = useMutation(
      gql`
        mutation Typing($input: Float!) {
          typing(input: $input)
        }
      `,
      {
        variables: {
          input: selectedChatAssociationId.value
        }
      }
    );
    await mutate.mutate();
  }

  async function cancelType() {
    const mutate = useMutation(
      gql`
        mutation CancelTyping($input: Float!) {
          cancelTyping(input: $input)
        }
      `,
      {
        variables: { input: selectedChatAssociationId.value }
      }
    );
    await mutate.mutate();
  }

  async function init() {
    try {
      const chatsLocal = localStorage.getItem("chatStore");
      if (chatsLocal) {
        chats.value = JSON.parse(chatsLocal).sort((a: Chat, b: Chat) => {
          return (
            Number(b._redisSortDate) - Number(a._redisSortDate) ||
            Number(b.id) - Number(a.id)
          );
        });
      }
    } catch {
      //
    }
    try {
      const trustedDomains = localStorage.getItem("trustedDomainsStore");
      if (trustedDomains) {
        this.trustedDomains = JSON.parse(trustedDomains);
      }
    } catch {
      //
    }
    try {
      const drafts = localStorage.getItem("draftStore");
      if (drafts) {
        this.drafts = JSON.parse(drafts);
      }
    } catch {
      //
    }
    try {
      const emoji = localStorage.getItem("emojiStore");
      if (emoji) {
        this.recentEmoji = JSON.parse(emoji);
      }
    } catch {
      //
    }

    const {
      data: { chats, userEmoji }
    } = await client.query({
      query: ChatsQuery
    });
    this.chats = chats;
    this.emoji = userEmoji;
  }

  function merge(message: Message, index: number) {
    if (message.replyId) return false;
    if (message.type !== MessageType.Message && message.type) return false;
    const prev = messagesStore.selected[index + 1];
    if (!prev) return false;
    if (prev.type !== MessageType.Message && prev.type) return false;
    if (dayjs(message.createdAt).diff(prev.createdAt, "minutes") > 5)
      return false;
    return prev.userId === message.userId;
  }

  async function setChat(id: number) {
    loading.value = true;
    selectedChatAssociationId.value = id;
    const appStore = useAppStore();
    appStore.title = chatName(selectedChat.value?.id);
    const messages = await messagesStore.getMessages({
      associationId: id,
      position: ScrollPosition.Top
    });
    if (id !== selectedChatAssociationId.value) return;
    messagesStore.messages[selectedChatAssociationId.value] = messages;
    readChat();
    isReady.value = id;
    loading.value = false;
  }

  function readChat(associationId?: number) {
    if (document.hasFocus()) {
      const mutate = useMutation(ReadChatMutation, {
        variables: {
          input: {
            associationId: associationId || selectedChatAssociationId.value
          }
        }
      });
      mutate.mutate();
      if (selectedChat.value) {
        chats.value = chats.value.map((chat) => {
          return {
            ...chat,
            unread: 0
          };
        });
      }
    }
  }

  const unread = computed(() => {
    return chats.value.reduce((sum, chat) => sum + chat.unread, 0);
  });

  watch(
    () => unread.value,
    (val) => {
      const appStore = useAppStore();
      appStore.navigation.railOptions[RailMode.CHAT].badge =
        val >= 1000 ? "1k+" : val;
    }
  );

  const currentTypers = computed(() => {
    return typers.value.filter(
      (typer) => typer.chatId === selectedChat.value?.id
    );
  });

  const uiOptions = ref({
    memberSidebar: !localStorage.getItem("memberList")
      ? true
      : localStorage.getItem("memberList") === "true",
    searchSidebar: false,
    search: "",
    pinSidebar: false
  });

  watch(
    () => uiOptions.value.memberSidebar,
    () => {
      localStorage.setItem(
        "memberList",
        uiOptions.value.memberSidebar.toString()
      );
    }
  );

  function getColor(ranksMap: string[], ranks: ChatRank[]): string {
    if (!ranksMap) ranksMap = [];
    for (const rankId of ranksMap) {
      const rank = ranks.find((r) => r.id === rankId);
      if (rank?.color) {
        return rank.color;
      }
    }
    return "inherit";
  }

  function hasPermission(
    permission: ChatPermissions | ChatPermissions[],
    chat?: Chat
  ) {
    const permissionsArray = Array.isArray(permission)
      ? permission
      : [permission];

    const c: Chat | undefined = chat ?? selectedChat.value;

    return (
      c?.association?.permissions?.some(
        (perm) =>
          permissionsArray.includes(<ChatPermissions>perm) ||
          (!permissionsArray.includes(<ChatPermissions>"TRUSTED") &&
            perm === "ADMIN")
      ) ||
      (c?.association?.userId === c?.userId && c?.type === "group")
    );
  }

  return {
    chats,
    selectedChatAssociationId,
    selectedChat,
    init,
    trustedDomains,
    drafts,
    emoji,
    recentEmoji,
    chatName,
    merge,
    readChat,
    setChat,
    lookupChat,
    unread,
    typers,
    currentTypers,
    type,
    cancelType,
    uiOptions,
    getColor,
    hasPermission
  };
});
