"use client";
import { Photo } from "@/components/ui/photo";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "@phosphor-icons/react";
import {
  Input,
  Button,
  ErrorNotice,
  ActionLink,
  Skeleton,
} from "@/components/ui/primitives";
interface Invitation {
  id: string;
  title: string;
  organizerName: string;
  selected: boolean;
  joined: boolean;
}
export function Join({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    fetch("/api/join/" + token)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setInvitation(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/join/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.get("name") }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(`/trips/${d.id}/${invitation?.selected ? "" : "chat"}`);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }
  return (
    <div className="page-width join-page">
      <div className="join-photo">
        <Photo src="/demo/coast.jpg" alt="Иллюстрация совместной поездки" />
      </div>
      <div className="join-card">
        <span className="join-icon">
          <Users size={32} />
        </span>
        {!invitation && !error ? (
          <Skeleton />
        ) : invitation ? (
          <>
            <span className="small-label">Приглашение в поездку</span>
            <h1>{invitation.title}</h1>
            <p>
              {invitation.organizerName} приглашает вас{" "}
              {invitation.selected
                ? "присоединиться к планированию. Отель уже выбран, сначала вы получите просмотр."
                : "выбрать отдых вместе. Расскажите о своих пожеланиях, чтобы найти общий сценарий."}
            </p>
            {invitation.joined ? (
              <ActionLink href={`/trips/${invitation.id}`}>
                Вы уже в поездке <ArrowRight size={20} />
              </ActionLink>
            ) : (
              <form onSubmit={join} className="stack">
                <Input
                  name="name"
                  label="Как вас зовут?"
                  required
                  maxLength={40}
                  autoComplete="given-name"
                />
                <Button type="submit" disabled={pending}>
                  Присоединиться <ArrowRight size={20} />
                </Button>
              </form>
            )}
            <small>
              Ваш диалог будет личным. В общем контексте появятся только
              пожелания с вашим именем.
            </small>
          </>
        ) : null}
        {error && <ErrorNotice message={error} />}
      </div>
    </div>
  );
}
