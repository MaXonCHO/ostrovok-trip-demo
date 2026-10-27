"use client";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { TripView } from "@/domain/models";
import type { TripCommand } from "@/data/contracts/commands";
interface State {
  trip: TripView | null;
  error: string;
  busy: boolean;
  persona: string;
  load: () => Promise<void>;
  command: (command: TripCommand) => Promise<boolean>;
  setPersona: (id: string) => void;
  notice: string;
  setNotice: (n: string) => void;
}
const Context = createContext<State | null>(null);
export const useTrip = () => {
  const c = useContext(Context);
  if (!c) throw new Error("Missing TripProvider");
  return c;
};
export function TripProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [trip, setTrip] = useState<TripView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [persona, setPersonaState] = useState("");
  const current = useRef<TripView | null>(null);
  const personaRef = useRef("");
  const inflight = useRef(false);
  const headers = (): Record<string, string> =>
    personaRef.current ? { "x-demo-persona": personaRef.current } : {};
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}`, {
        headers: personaRef.current
          ? { "x-demo-persona": personaRef.current }
          : {},
        cache: "no-store",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (
        !current.current ||
        d.version >= current.current.version ||
        d.me.id !== current.current.me.id
      ) {
        current.current = d;
        setTrip(d);
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden && !inflight.current) void load();
    }, 2500);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  const command = async (command: TripCommand) => {
    if (inflight.current || !current.current) return false;
    inflight.current = true;
    setBusy(true);
    setError("");
    const commandId = crypto.randomUUID();
    try {
      for (let i = 0; i < 4; i++) {
        const res = await fetch(`/api/trips/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({
            version: current.current!.version,
            commandId,
            command,
          }),
        });
        const d = await res.json();
        if (res.status === 409 && i < 3) {
          await load();
          continue;
        }
        if (!res.ok) throw new Error(d.error);
        if (d.left) {
          router.push("/");
          return true;
        }
        current.current = d;
        setTrip(d);
        return true;
      }
      return false;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };
  function setPersona(id: string) {
    personaRef.current = id;
    setPersonaState(id);
    current.current = null;
    setTrip(null);
    void load();
  }
  return (
    <Context.Provider
      value={{
        trip,
        error,
        busy,
        persona,
        load,
        command,
        setPersona,
        notice,
        setNotice,
      }}
    >
      {children}
    </Context.Provider>
  );
}
