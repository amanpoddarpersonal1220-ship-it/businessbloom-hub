import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PresenceUser {
  user_id: string;
  name: string;
  role: string;
  route?: string;
  entity_type?: string;
  entity_id?: string;
}

/**
 * Track online users tenant-wide plus per-entity viewers. Broadcasts the
 * caller's own presence with the currently-viewed entity (if any).
 */
export function usePresence(entity?: { type: string; id: string }) {
  const { user, profile, role } = useAuth();
  const [online, setOnline] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!user || !profile || !role) return;

    const channel = supabase.channel("presence:tenant", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceUser[]>;
        const flat = Object.values(state).flat();
        setOnline(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            name: profile.name,
            role,
            entity_type: entity?.type,
            entity_id: entity?.id,
          } satisfies PresenceUser);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.name, role, entity?.type, entity?.id]);

  return {
    online,
    isOnline: (userId: string) => online.some((u) => u.user_id === userId),
    viewersOf: (type: string, id: string) =>
      online.filter(
        (u) => u.entity_type === type && u.entity_id === id && u.user_id !== user?.id,
      ),
  };
}