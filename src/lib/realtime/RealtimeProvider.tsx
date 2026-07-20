import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "connecting" | "connected" | "disconnected";

const Ctx = createContext<{ status: Status }>({ status: "connecting" });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    // Heartbeat channel — reflects the underlying socket status
    const chan = supabase.channel("rt:heartbeat");
    chan.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        setStatus((prev) => {
          if (prev !== "connected") {
            // Reconnected — refetch everything active
            qc.invalidateQueries();
          }
          return "connected";
        });
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        setStatus("disconnected");
      }
    });

    const onOnline = () => {
      setStatus("connecting");
      supabase.realtime.connect();
    };
    const onOffline = () => setStatus("disconnected");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      supabase.removeChannel(chan);
    };
  }, [qc]);

  return (
    <Ctx.Provider value={{ status }}>
      {status !== "connected" && (
        <div
          className={cn(
            "fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur",
            status === "disconnected"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-warning/30 bg-warning/10 text-warning",
          )}
        >
          <WifiOff className="h-3 w-3" />
          {status === "disconnected" ? "Reconnecting to live updates…" : "Connecting…"}
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}

export function useRealtimeStatus() {
  return useContext(Ctx).status;
}