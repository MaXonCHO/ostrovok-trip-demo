"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Info } from "@phosphor-icons/react";
import { useAccount, postPlanner } from "./account-provider";
import type { Selection, TripWorkspace } from "./types";
import { RecommendationCard } from "./recommendation-card";
export function LiveSelection({
  selection,
  tripId,
  version,
  pending,
  ready,
  onUpdate,
}: {
  selection?: Selection;
  tripId?: string;
  version?: number;
  pending: boolean;
  ready: boolean;
  onUpdate: (data: TripWorkspace) => void;
}) {
  const { user, openLogin } = useAccount();
  const router = useRouter();
  const [initial, setInitial] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(4);
  const [error, setError] = useState("");
  useEffect(() => {
    if (selection) return;
    let live = true;
    void fetch("/api/planner/catalog/search")
      .then((r) => r.json())
      .then((d) => {
        if (live) setInitial(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [selection]);
  const current = selection ?? initial;
  const shown = current
    ? [...current.results, ...current.needsCheck].filter(
        (hotel, index, hotels) =>
          hotels.findIndex((item) => item.hotel.id === hotel.hotel.id) ===
          index,
      )
    : [];
  async function finalize() {
    if (!user?.authenticated) {
      openLogin();
      return;
    }
    if (!tripId) return;
    setBusy(true);
    setError("");
    try {
      await postPlanner("trips/" + tripId, {
        type: "finalize",
        version,
        includeUnverified: true,
      });
      router.push("/trips/" + tripId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function relax(key: string) {
    if (!user?.authenticated) {
      openLogin();
      return;
    }
    if (!tripId) return;
    setBusy(true);
    setError("");
    try {
      const w = await postPlanner("trips/" + tripId, {
        type: "relax",
        version,
        key,
      });
      onUpdate(w);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="ov-trip-collections ov-live-selection"
      aria-label="Подбор отелей из базы"
    >
      <div className="ov-container">
        <header className="ov-live-heading">
          <div>
            <h2>Отели под ваши планы</h2>
            <p>
              Отели Петербурга с учётом того, что важно именно вам. Подбор
              обновляется после каждого ответа.
            </p>
          </div>
          {(pending || !current) && (
            <span className="ov-update-status" role="status" aria-live="polite">
              {pending ? "Уточняем пожелания…" : "Загружаем отели…"}
            </span>
          )}
        </header>
        {current?.applied.length ? (
          <div className="ov-criteria-row">
            {current.applied.map((c) => (
              <span
                key={c.key}
                className={c.importance === "required" ? "is-required" : ""}
              >
                <Check size={13} />
                {!c.value ? "Без: " : ""}
                {c.label}
                <small>
                  {c.importance === "required" ? "Обязательно" : "Пожелание"}
                </small>
              </span>
            ))}
          </div>
        ) : null}
        {current && shown.length < 3 && (
          <details className="ov-selection-compromise">
            <summary>
              <Info size={17} />
              Как получить больше подходящих вариантов <span>+</span>
            </summary>
            <div>
              <strong>
                {shown.length
                  ? "Под все условия пока мало вариантов"
                  : "Подходящих вариантов пока нет"}
              </strong>
              <p>
                Можно изменить конкретное требование, чтобы расширить подборку.
              </p>
              {current.suggestions.map((s) => (
                <button
                  key={s.key}
                  className="ov-inline-button"
                  disabled={busy || pending}
                  onClick={() => relax(s.key)}
                >
                  {s.label} <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </details>
        )}
        {!current ? (
          <div
            className="ov-planner-skeleton"
            aria-label="Загружаем подборку"
          />
        ) : shown.length ? (
          <div className="ov-live-hotels" aria-busy={pending}>
            {shown.slice(0, visibleCount).map((h) => (
              <RecommendationCard key={h.hotel.id} item={h} />
            ))}
          </div>
        ) : (
          <div className="ov-planner-empty">
            <BuildingsMessage />
            <p>Измените пожелания в диалоге, чтобы расширить подборку.</p>
          </div>
        )}
        {shown.length > visibleCount && (
          <button
            className="ov-inline-button ov-show-more"
            onClick={() => setVisibleCount(shown.length)}
          >
            Показать ещё {shown.length - visibleCount} варианта{" "}
            <ArrowRight size={16} />
          </button>
        )}
        <div className="ov-selection-finish">
          <div>
            <h3>Всё важное уже обсудили?</h3>
            <p>
              Сохраните профиль, затем пригласите спутников и выберите отель
              вместе.
            </p>
          </div>
          <button
            className="ov-button"
            disabled={busy || pending || !tripId || !ready}
            onClick={finalize}
          >
            {busy ? "Сохраняем…" : "Создать профиль поездки"}{" "}
            <ArrowRight size={18} />
          </button>
        </div>
        {error && (
          <p role="alert" className="ov-planner-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
function BuildingsMessage() {
  return <h3>Подходящих вариантов пока нет</h3>;
}
