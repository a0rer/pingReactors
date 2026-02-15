# PingReactors

A simple vencord extensions that adds a context menu option to messages with reactions, allowing you to ping users who reacted to a message

## Features

- **Ping All Reactors**: Mention everyone who reacted to a message with any emoji
- **Ping by Emoji**: Mention only users who reacted with a specific emoji

## How to Use

1. Right-click on any message that has reactions
2. Hover over "Ping Reactors" in the context menu
3. Choose either:
   - **All Reactions** - Ping everyone who reacted with any emoji
   - Select a specific emoji to ping only users who used that reaction

The mentions will be automatically inserted into your chat input box.

## Notes
- You must be in the same channel as the message you're trying to ping reactors from
- You must have valid permissions to send messages in the channel
- The tool automatically excludes yourself from the mentions list in the discord chatbox
- Some users when inserted into the chatbox will have ``@unknown-user`` which is normal behaviour and will properly load after the message has been sent
