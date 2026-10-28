"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, Phone, User, X } from "@phosphor-icons/react";
import type { Account } from "./types";
interface AuthState {
  user: Account | null;
  ready: boolean;
  favorites: string[];
  openLogin: () => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}
const Context = createContext<AuthState | null>(null);
let initialRequest: Promise<{ user: Account; favorites: string[] }> | null =
  null;
export function ensureAccount(refresh = false) {
  if (refresh) initialRequest = null;
  return (initialRequest ??= fetch("/api/planner/auth/session", {
    cache: "no-store",
  })
    .then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      return d;
    })
    .catch((e) => {
      initialRequest = null;
      throw e;
    }));
}
export function useAccount() {
  const c = useContext(Context);
  if (!c) throw Error("Account provider missing");
  return c;
}
export async function postPlanner(path: string, body: unknown) {
  const r = await fetch("/api/planner/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Не удалось сохранить.");
  return d;
}
export function AccountProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const accept = useCallback((d: { user: Account; favorites?: string[] }) => {
    setUser(d.user);
    setFavorites(d.favorites ?? []);
    setReady(true);
  }, []);
  const refresh = useCallback(async () => {
    initialRequest = null;
    accept(await ensureAccount());
  }, [accept]);
  useEffect(() => {
    let live = true;
    void ensureAccount()
      .then((d) => {
        if (live) accept(d);
      })
      .catch(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [accept]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!challenge) {
        const d = await postPlanner("auth/request", { phone });
        setChallenge(d.challengeId);
      } else {
        await postPlanner("auth/verify", {
          challengeId: challenge,
          code,
          name,
        });
        await refresh();
        setOpen(false);
        setChallenge(null);
        setCode("");
        window.dispatchEvent(new Event("ov:account-changed"));
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await postPlanner("auth/logout", {});
    await refresh();
    window.dispatchEvent(new Event("ov:account-changed"));
    router.push("/");
    router.refresh();
  }
  async function toggleFavorite(id: string) {
    if (!user?.authenticated) return;
    const saved = !favorites.includes(id);
    setFavorites((v) => (saved ? [...v, id] : v.filter((x) => x !== id)));
    try {
      await postPlanner("favorites", { hotelId: id, saved });
    } catch {
      await refresh();
    }
  }
  return (
    <Context.Provider
      value={{
        user,
        ready,
        favorites,
        openLogin: () => {
          setError("");
          setOpen(true);
        },
        refresh,
        logout,
        toggleFavorite,
      }}
    >
      {children}
      <Dialog.Root
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="ov-modal-backdrop" />
          <Dialog.Content className="ov-modal ov-account-modal">
            <Dialog.Title className="ov-modal-title">
              {challenge ? "Введите код" : "Войдите, чтобы сохранить поездку"}
            </Dialog.Title>
            <Dialog.Description className="ov-account-description">
              Демонстрационный аккаунт. SMS не отправляется, код входа{" "}
              <strong>0000</strong>. Номер не подтверждает владение телефоном.
            </Dialog.Description>
            <Dialog.Close className="ov-modal-close" aria-label="Закрыть">
              <X size={23} />
            </Dialog.Close>
            <form onSubmit={submit} className="ov-account-form">
              {!challenge ? (
                <>
                  <label>
                    <span>
                      <Phone size={17} />
                      Телефон
                    </span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+7 900 123-45-67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      maxLength={25}
                    />
                  </label>
                  <label>
                    <span>
                      <User size={17} />
                      Как вас зовут?
                    </span>
                    <input
                      autoComplete="given-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Имя для спутников"
                      maxLength={50}
                    />
                  </label>
                  <p>
                    Можно использовать вымышленный номер подходящего формата.
                  </p>
                </>
              ) : (
                <>
                  <p>Телефон: {phone}</p>
                  <label>
                    <span>Демо-код</span>
                    <input
                      autoFocus
                      aria-label="Демо-код"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="0000"
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="ov-inline-button"
                    disabled={busy}
                    onClick={() => {
                      setChallenge(null);
                      setError("");
                      setCode("");
                    }}
                  >
                    Другой номер
                  </button>
                </>
              )}
              {error && (
                <p role="alert" className="ov-planner-error">
                  {error}
                </p>
              )}
              <button
                className="ov-button"
                disabled={busy || (!!challenge && code.length !== 4)}
              >
                {busy
                  ? "Подождите…"
                  : challenge
                    ? "Войти"
                    : "Получить демо-код"}
                {challenge ? <Check size={18} /> : <ArrowRight size={18} />}
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Context.Provider>
  );
}
