import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RealtimeSubscription {
  /** table name in public schema */
  table: string;
  /** optional postgres_changes filter, e.g. `user_id=eq.<uuid>` */
  filter?: string;
  /** query keys to invalidate on any change */
  invalidate: (readonly unknown[])[];
  /** optional per-event callback for toasts / side effects */
  onEvent?: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: any;
    old: any;
  }) => void;
}

/**
 * Subscribe to postgres changes on a set of tables and invalidate matching
 * TanStack Query keys. Cleans up on unmount. Reconnection is handled by the
 * Supabase realtime client itself; connection status surfaces through
 * RealtimeProvider.
 */
export function useRealtimeTables(subs: RealtimeSubscription[]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (subs.length === 0) return;
    const channels: RealtimeChannel[] = [];

    for (const s of subs) {
      const chanName = `rt:${s.table}:${s.filter ?? "all"}:${Math.random().toString(36).slice(2, 8)}`;
      const chan = supabase
        .channel(chanName)
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table: s.table,
            ...(s.filter ? { filter: s.filter } : {}),
          },
          (payload: any) => {
            for (const key of s.invalidate) {
              qc.invalidateQueries({ queryKey: key as unknown[] });
            }
            s.onEvent?.({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            });
          },
        )
        .subscribe();
      channels.push(chan);
    }

    return () => {
      for (const c of channels) supabase.removeChannel(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(subs.map((s) => [s.table, s.filter]))]);
}