"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  SlidersHorizontal,
  Info,
} from "@phosphor-icons/react";
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
  const [showUnknown, setShowUnknown] = useState(false);
  const [busy, setBusy] = useState(false);
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
    ? showUnknown
      ? current.needsCheck
      : current.results
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
        includeUnverified: showUnknown,
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
            <span className="ov-selection-caption">
              <SlidersHorizontal size={17} />
              Подбор меняется вместе с вашими ответами
            </span>
            <h2>Отели под ваши планы</h2>
            <p>
              Изучаем 300 карточек Петербурга и сведения об окружении.
              Обязательные условия отделены от пожеланий.
            </p>
          </div>
          <span className="ov-update-status" role="status" aria-live="polite">
            {pending
              ? "Уточняем пожелания…"
              : current
                ? `${current.matchingCount} по данным · ${current.unverifiedCount} требуют проверки`
                : "Загружаем базу…"}
          </span>
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
        <div
          className="ov-selection-tabs"
          role="group"
          aria-label="Проверенность условий"
        >
          <button
            className={!showUnknown ? "is-active" : ""}
            aria-pressed={!showUnknown}
            onClick={() => setShowUnknown(false)}
          >
            По данным архива ({current?.matchingCount ?? 0})
          </button>
          <button
            className={showUnknown ? "is-active" : ""}
            aria-pressed={showUnknown}
            onClick={() => setShowUnknown(true)}
          >
            Нужна проверка ({current?.unverifiedCount ?? 0})
          </button>
        </div>
        {showUnknown && (
          <p className="ov-selection-explanation">
            <Info size={18} />
            Эти варианты не подтверждают все обязательные условия. Лимит бюджета
            сохраняется, но актуальных цен в базе нет. Их можно сохранить
            отдельно для проверки.
          </p>
        )}
        {current && current.matchingCount < 3 && (
          <div className="ov-selection-compromise">
            <strong>
              {current.matchingCount
                ? "Под все условия пока мало вариантов"
                : "Все обязательные условия пока не подтверждены"}
            </strong>
            <p>
              Не ослабляем запрос автоматически. Можно уточнить данные,
              посмотреть варианты для проверки или изменить конкретное
              требование.
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
        )}
        {!current ? (
          <div
            className="ov-planner-skeleton"
            aria-label="Загружаем подборку"
          />
        ) : shown.length ? (
          <div className="ov-live-hotels" aria-busy={pending}>
            {shown.map((h) => (
              <RecommendationCard key={h.hotel.id} item={h} />
            ))}
          </div>
        ) : (
          <div className="ov-planner-empty">
            <BuildingsMessage />
            <p>
              {showUnknown
                ? "Даже для проверки не осталось вариантов. Измените условия в диалоге."
                : "Откройте список «Нужна проверка», чтобы видеть варианты с отсутствующими сведениями. Они не считаются подтверждённым совпадением."}
            </p>
          </div>
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
        <p className="ov-selection-caption">
          Все расстояния в источнике по прямой. Пешие маршруты и актуальные цены
          нужно подтвердить отдельно.
        </p>
      </div>
    </section>
  );
}
function BuildingsMessage() {
  return <h3>Подтверждённых вариантов пока нет</h3>;
}
