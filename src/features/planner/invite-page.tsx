"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ArrowRight } from "@phosphor-icons/react";
import { useAccount, postPlanner } from "./account-provider";
export function InvitePage({ token }: { token: string }) {
  const auth = useAccount();
  const router = useRouter();
  const [preview, setPreview] = useState<{ title: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void fetch("/api/planner/invite/" + token, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) setPreview(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token]);
  async function join() {
    if (!auth.user?.authenticated) {
      auth.openLogin();
      return;
    }
    setBusy(true);
    try {
      const r = await postPlanner("invite/" + token, {});
      router.push("/trips/" + r.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="ov-container ov-invite-page">
      <div className="ov-invite-symbol">
        <Users size={42} />
      </div>
      <h1>{preview ? "Вас пригласили в поездку" : "Приглашение в поездку"}</h1>
      {preview && (
        <>
          <h2>{preview.title}</h2>
          <p>
            Смотрите одну подборку, обсуждайте конкретные отели и голосуйте
            вместе со спутниками. Личный диалог организатора остаётся приватным.
          </p>
          <button
            className="ov-button"
            disabled={busy || !auth.ready}
            onClick={join}
          >
            {busy
              ? "Присоединяемся…"
              : auth.user?.authenticated
                ? "Присоединиться к поездке"
                : "Войти и присоединиться"}{" "}
            <ArrowRight size={19} />
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="ov-planner-error">
          {error}
        </p>
      )}
    </div>
  );
}
