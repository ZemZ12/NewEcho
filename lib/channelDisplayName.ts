import type { Channel } from 'stream-chat';

// Stream channels created without an explicit name get an opaque
// auto-generated id like "!members-JoJ1J8Z-...". Derive a human name from
// the other members' usernames instead, for chat list rows and headers.
export function channelDisplayName(channel: Channel, currentUserId: string): string {
  const others = Object.values(channel.state.members)
    .filter((member) => member.user?.id !== currentUserId)
    .map((member) => member.user?.name ?? member.user?.id ?? 'Unknown');
  return others.length > 0 ? others.join(', ') : 'Just you';
}
