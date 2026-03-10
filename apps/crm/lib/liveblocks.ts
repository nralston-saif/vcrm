import { createClient, Client } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const publicApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY || '';
const isValidKey = publicApiKey.startsWith('pk_');
export const isLiveblocksConfigured = isValidKey;

const client: Client = isValidKey
  ? createClient({
      authEndpoint: async (roomId) => {
        const response = await fetch('/api/liveblocks-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomId }),
        });

        if (!response.ok) {
          throw new Error(`Auth failed: ${response.status}`);
        }

        return await response.json();
      },
      throttle: 100,
    })
  : createClient({
      authEndpoint: async () => {
        throw new Error('Liveblocks not configured');
      },
      throttle: 100,
    });

type Presence = {
  cursor: { x: number; y: number } | null;
  name: string;
  isTyping: boolean;
};

type Storage = {
  draft: string;
  sharedNoteId: string | null;
  meetingDate: string;
  creatingNoteBy: string | null;
};

type UserMeta = {
  id: string;
  info: {
    name: string;
    color: string;
  };
};

type RoomEvent = {};
type ThreadMetadata = {};

const roomContext = createRoomContext<Presence, Storage, UserMeta, RoomEvent, ThreadMetadata>(client);

export const {
  suspense: {
    RoomProvider,
    useRoom,
    useMyPresence,
    useUpdateMyPresence,
    useOthers,
    useOthersMapped,
    useSelf,
    useStorage,
    useMutation,
    useStatus,
  },
} = roomContext;

export { ClientSideSuspense } from "@liveblocks/react";
export const { RoomProvider: BaseRoomProvider } = roomContext;
