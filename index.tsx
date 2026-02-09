/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Message, ReactionEmoji } from "@vencord/discord-types";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ChannelStore, ComponentDispatch, Constants, FluxDispatcher, IconUtils, Menu, PermissionsBits, PermissionStore, RestAPI, SelectedChannelStore, showToast, Toasts, UserStore } from "@webpack/common";
import definePlugin from "@utils/types";

function validatePermissions(message: Message): boolean {
    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) {
        showToast("Channel not found", Toasts.Type.FAILURE);
        return false;
    }
    if (!PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) {
        showToast(
            "Insufficient privileges to send messages in this channel",
            Toasts.Type.FAILURE,
        );
        return false;
    }
    if (SelectedChannelStore.getChannelId() !== message.channel_id) {
        showToast("You are in the wrong channel", Toasts.Type.FAILURE);
        return false;
    }
    return true;
}

function insertMentions(userIds: Set<string>): void {
    const currentUserId = UserStore.getCurrentUser().id;
    userIds.delete(currentUserId);

    const mentions = Array.from(userIds).map((id) => `<@${id}>`).join(" ");
    insertTextIntoChatInputBox(mentions + " ");
    ComponentDispatch.dispatchToLastSubscribed("TEXTAREA_FOCUS");
    showToast(`Added ${userIds.size} mention${userIds.size !== 1 ? "s" : ""} to input`, Toasts.Type.SUCCESS);
}

async function fetchReactorsByEmoji(channelId: string, messageId: string, emojiKey: string): Promise<Set<string>> {
    const userIds = new Set<string>();
    let after: string | undefined;

    do {
        const res = await RestAPI.get({
            url: Constants.Endpoints.REACTIONS(channelId, messageId, emojiKey),
            query: {
                limit: 100,
                type: 0,
                ...(after && { after }),
            },
        });

        for (const user of res.body) {
            userIds.add(user.id);
            FluxDispatcher.dispatch({ type: "USER_UPDATE", user });
        }

        after = res.body.length === 100 ? res.body[res.body.length - 1].id : null;
    } while (after);
    return userIds;
}

async function fetchAllReactors(message: Message): Promise<Map<string, Set<string>>> {
    const reactorsByEmoji = new Map<string, Set<string>>();

    try {
        for (const { emoji } of message.reactions) {
            const key = emoji.name + (emoji.id ? `:${emoji.id}` : "");
            const display = emoji.id ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : emoji.name;
            const userIds = await fetchReactorsByEmoji(message.channel_id, message.id, key);
            reactorsByEmoji.set(display, userIds);
        }
    } catch (error) {
        showToast("Failed to fetch reactors", Toasts.Type.FAILURE);
        throw error;
    }
}

async function pingReactorsByEmoji(message: Message, emoji: ReactionEmoji): Promise<void> {
    if (!validatePermissions(message)) return;

    try {
        const key = emoji.name + (emoji.id ? `:${emoji.id}` : "");
        const userIds = await fetchReactorsByEmoji(message.channel_id, message.id, key);
        insertMentions(userIds);
    } catch (error) {
        showToast("Failed to fetch reactors", Toasts.Type.FAILURE);
    }
}

async function pingAllReactors(message: Message): Promise<void> {
    if (!validatePermissions(message)) return;

    try {
        const reactorsByEmoji = await fetchAllReactors(message);
        const allUserIds = new Set<string>();
        reactorsByEmoji.forEach((userIds) => {
            userIds.forEach((id) => allUserIds.add(id));
        });
        insertMentions(allUserIds);
    } catch (error) {
        showToast("Failed to fetch reactors", Toasts.Type.FAILURE);
    }
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
  const message = props?.message as Message;
  if (!message || !message.reactions || message.reactions.length === 0)
    return;

  const group = findGroupChildrenByChildId("mark-unread", children);

  if (group) {
    const reactionMenuItems = message.reactions.map((reaction) => {
      const { emoji } = reaction;

      let emojiElement;

      if (emoji.id) {
          // Custom emoji - render as image
          const emojiUrl = IconUtils.getEmojiURL({
              id: emoji.id,
              animated: emoji.animated,
              size: 16
          });

          emojiElement = (
              <img
                  src={emojiUrl}
                  alt={emoji.name}
                  className="emoji"
                  style={{ width: "16px", height: "16px", verticalAlign: "middle", marginRight: "4px" }}
              />
          );
      } else {
          // Unicode emoji - just use the name (which is the actual emoji character)
          emojiElement = <span style={{ marginRight: "4px" }}>{emoji.name}</span>;
      }

      return (
          <Menu.MenuItem
              id={`ping-reactors-${emoji.name}-${emoji.id || "unicode"}`}
              key={`ping-reactors-${emoji.name}-${emoji.id || "unicode"}`}
              label={<>{emojiElement}({reaction.count})</>}
              action={() => pingReactorsByEmoji(message, emoji)}
          />
      );
  });

  group.push(
    <Menu.MenuItem
      id="ping-reactors"
      key="ping-reactors"
      label="Ping Reactors"
    >
      <Menu.MenuItem
        id="ping-all-reactors"
        key="ping-all-reactors"
        label="All Reactions"
        action={() => pingAllReactors(message)}
      />
      <Menu.MenuSeparator />
      {reactionMenuItems}
    </Menu.MenuItem>,
    );
  }
};

export default definePlugin({
    name: "PingReactors",
    description: "Add Context Menu to ping all users who reacted to a message",
    authors: [{ name: "aorer.", id: 188165041336483842n }],

    contextMenus: {
        message: messageContextMenuPatch,
    },
});
