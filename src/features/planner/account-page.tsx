"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, SignOut, Suitcase } from "@phosphor-icons/react";
import { useAccount } from "./account-provider";
export function AccountPage() {
  const router = useRouter();
  const auth = useAccount();
  const [trips, setTrips] = useState<
    { id: string; title: string; status: string; updatedAt: string }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!auth.ready) return;
    let live = true;
    void fetch("/api/planner/trips", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) setTrips(d.trips);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [auth.ready, auth.user?.id]);
  return (
    <div className="ov-container ov-profile-page">
      <header className="ov-profile-heading">
        <div>
          <span className="ov-selection-caption">
            <Suitcase size={18} />
            Личный кабинет
          </span>
          <h1>
            {auth.user?.authenticated
              ? auth.user.name + ", ваши поездки"
              : "Сохраните планы на поездку"}
          </h1>
          <p>
            {auth.user?.authenticated
              ? `Демо-аккаунт · ${auth.user.phone}`
              : "Войдите по телефону и коду 0000. Текущий черновик сохранится в аккаунте."}
          </p>
        </div>
        {auth.user?.authenticated ? (
          <button className="ov-inline-button" onClick={auth.logout}>
            <SignOut size={18} />
            Выйти
          </button>
        ) : (
          <button className="ov-button" onClick={auth.openLogin}>
            Войти в демо-аккаунт <ArrowRight size={18} />
          </button>
        )}
      </header>
      {error && auth.user?.authenticated && (
        <p className="ov-planner-error">{error}</p>
      )}
      <div className="ov-account-trips">
        {trips.map((t) => (
          <Link
            key={t.id}
            href={
              t.status === "profile"
                ? "/trips/" + t.id
                : "/my-trip?trip=" + t.id
            }
          >
            <span className="ov-account-trip-icon">
              <Suitcase size={24} />
            </span>
            <div>
              <h2>{t.title}</h2>
              <p>
                {t.status === "profile"
                  ? "Профиль и совместный выбор"
                  : "Продолжить диалог"}{" "}
                · {new Date(t.updatedAt).toLocaleDateString("ru-RU")}
              </p>
            </div>
            <ArrowRight size={22} />
          </Link>
        ))}
      </div>
      {auth.ready && !trips.length && (
        <div className="ov-planner-empty">
          <h2>Здесь будут ваши поездки</h2>
          <p>
            Начните с пожеланий. После входа профиль можно открыть в другом
            браузере по тому же демо-телефону.
          </p>
        </div>
      )}
      <button
        type="button"
        className="ov-button"
        onClick={() => router.push("/my-trip?new=" + crypto.randomUUID())}
      >
        <Plus size={18} />
        Новая поездка
      </button>
    </div>
  );
}
