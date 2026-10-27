"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  MapPin,
  Info,
  Heart,
} from "@phosphor-icons/react";
import { Photo } from "@/components/ui/photo";
import {
  Button,
  Dialog,
  EmptyState,
  ActionLink,
  Avatar,
} from "@/components/ui/primitives";
import { SwipeControls } from "@/components/ui/swipe-controls";
import { GestureSurface } from "@/features/hotels/gesture";
import { useTrip } from "@/features/trips/context";
import { decisionFor } from "@/domain/rules";
import type { Scenario, Trip } from "@/domain/models";
export function Scenarios() {
  const { trip, command, busy } = useTrip();
  const router = useRouter();
  const [detail, setDetail] = useState<Scenario | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [review, setReview] = useState<number | null>(null);
  if (!trip) return null;
  const root = `/trips/${trip.id}`;
  const t = trip as unknown as Trip;
  const frozen = trip.candidates.length > 0 || !!trip.selected;
  const selected = trip.scenarios.filter(
    (s) => decisionFor(t, trip.me.id, "scenario", s.id) === "liked",
  );
  const unseen = trip.scenarios.filter(
    (s) => decisionFor(t, trip.me.id, "scenario", s.id) === "unseen",
  );
  const current =
    review !== null
      ? trip.scenarios[review]
      : (unseen[0] ?? (frozen ? (selected[0] ?? trip.scenarios[0]) : null));
  const allConfirmed =
    !trip.blocked &&
    trip.participants
      .filter((p) => p.status !== "left" && p.role !== "viewer")
      .every((p) => p.scenariosConfirmed);
  const noCommon = allConfirmed && !trip.scenarioIds.length;
  const index = current
    ? trip.scenarios.findIndex((s) => s.id === current.id)
    : trip.scenarios.length;
  async function decide(direction: number) {
    if (!current || frozen) return;
    if (
      await command({
        type: "vote",
        entityType: "scenario",
        entityId: current.id,
        decision: direction > 0 ? "liked" : "rejected",
      })
    ) {
      setLast(current.id);
      setReview(
        review !== null && review < trip!.scenarios.length - 1
          ? review + 1
          : null,
      );
    }
  }
  async function hotels() {
    if (await command({ type: "openHotels" })) router.push(root + "/hotels");
  }
  if (!trip.scenarios.length)
    return (
      <EmptyState
        title="Как выглядит ваш хороший день?"
        text="Начнём с пожеланий, затем покажем сценарии отдыха по одному."
      >
        <ActionLink href={root + "/chat"}>
          Рассказать о поездке <ArrowRight size={18} />
        </ActionLink>
      </EmptyState>
    );
  return (
    <div className="choice-flow scenario-flow">
      <header className="choice-heading">
        <div>
          <span className="choice-eyebrow">
            <MapPin size={15} />
            {trip.cityId === "sochi" ? "Сочи" : "Ваша поездка"} · сначала
            впечатления
          </span>
          <h1>Представьте себя здесь.</h1>
          <p>
            Вправо, если хочется так. Влево, если не ваше. Можно сохранить все
            три.
          </p>
        </div>
        <span className="count-label">
          {trip.scenarios.length - unseen.length} / {trip.scenarios.length}
        </span>
      </header>
      {trip.blocked && (
        <p className="choice-status">
          Пока спутник отвечает, можно выбрать свои сценарии. Общий результат
          появится позже.
        </p>
      )}
      {current ? (
        <div className="deck-composition">
          <div className="deck-column">
            <div className="deck-stack">
              <div className="deck-behind deck-behind-two" />
              <div className="deck-behind" />
              <GestureSurface
                key={current.id}
                enabled={!busy && !frozen}
                onSwipe={decide}
              >
                <article className="scenario-card photo-deck-card">
                  <Photo
                    src={`/demo/${current.imageAssetId}.jpg`}
                    alt={`Сценарий «${current.title}»`}
                    fetchPriority="high"
                  />
                  <div className="deck-photo-shade" />
                  <div className="deck-photo-top">
                    <span>
                      Сценарий {index + 1} из {trip.scenarios.length}
                    </span>
                    <button
                      onClick={() => setDetail(current)}
                      aria-label="Подробнее о сценарии"
                    >
                      <ArrowUpRight size={21} />
                    </button>
                  </div>
                  <div className="deck-photo-copy">
                    <span className="deck-area">
                      <MapPin size={15} />
                      {current.suggestedAreaIds[0] === "center"
                        ? "В ритме города"
                        : current.suggestedAreaIds[0] === "sea"
                          ? "У самого моря"
                          : "Ближе к природе"}
                    </span>
                    <h2>{current.title}</h2>
                    <p>{current.summary}</p>
                    <div className="deck-tags">
                      {current.dayOutline.slice(0, 3).map((d, i) => (
                        <span key={d}>
                          {["Утро", "День", "Вечер"][i]}
                          <strong>{d}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              </GestureSurface>
            </div>
            {!frozen ? (
              <SwipeControls
                disabled={busy}
                onReject={() => decide(-1)}
                onLike={() => decide(1)}
                canUndo={!!last}
                onUndo={async () => {
                  if (
                    last &&
                    (await command({
                      type: "vote",
                      entityType: "scenario",
                      entityId: last,
                      decision: "unseen",
                    }))
                  ) {
                    setLast(null);
                    setReview(null);
                  }
                }}
                onDetails={() => setDetail(current)}
              />
            ) : (
              <div className="deck-review-nav">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setReview(
                      (index + trip.scenarios.length - 1) %
                        trip.scenarios.length,
                    )
                  }
                >
                  <ArrowLeft size={18} />
                  Назад
                </Button>
                <span>Ваш выбор сохранён</span>
                <Button
                  variant="ghost"
                  onClick={() => setReview((index + 1) % trip.scenarios.length)}
                >
                  Дальше
                  <ArrowRight size={18} />
                </Button>
              </div>
            )}
          </div>
          <aside className="deck-side-story">
            <span className="story-kicker">Один день из вашей поездки</span>
            <h2>
              Как это <br />
              может быть
            </h2>
            <ol>
              {current.dayOutline.map((d, i) => (
                <li key={d}>
                  <span>{["09:30", "14:00", "19:00"][i]}</span>
                  <div>
                    <strong>{d}</strong>
                    <span>
                      {
                        [
                          "Без спешки. Этот день начинается для вас.",
                          "Места, ради которых хочется выйти из номера.",
                          "Время, которое приятно оставить свободным.",
                        ][i]
                      }
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="story-tradeoff">
              <Info size={17} />
              {current.tradeoffs[0]}
            </p>
            {Object.entries(current.participantReasons).some(
              ([, rs]) => rs.length > 0,
            ) && (
              <div className="story-fit">
                <span>
                  <Heart size={17} />
                  Учитывает ваши пожелания
                </span>
                {Object.entries(current.participantReasons).map(
                  ([id, rs]) =>
                    rs.length > 0 && (
                      <p key={id}>
                        <strong>
                          {trip.participants.find((p) => p.id === id)?.name}:
                        </strong>{" "}
                        {rs[0].replace("Учитывает: ", "")}
                      </p>
                    ),
                )}
              </div>
            )}
            <button
              className="landing-text-cta"
              onClick={() => setDetail(current)}
            >
              Посмотреть подробнее <ArrowUpRight size={18} />
            </button>
          </aside>
        </div>
      ) : (
        <div className="deck-complete">
          <div className="complete-heart">
            <Heart size={32} weight="fill" />
          </div>
          <h2>
            {selected.length
              ? "Вот какой отдых вам близок."
              : "Значит, ищем другое настроение."}
          </h2>
          <p>
            {selected.length
              ? "Выбранные сценарии сохранены. Подтвердите их, чтобы перейти к отелям."
              : "Ничего страшного. Расскажите, чего не хватило, и уточним подбор."}
          </p>
          <div className="selected-scenario-list">
            {selected.map((s) => (
              <button key={s.id} onClick={() => setDetail(s)}>
                <Photo src={`/demo/${s.imageAssetId}.jpg`} alt="" />
                <span>{s.title}</span>
                <Check size={19} />
              </button>
            ))}
          </div>
          <div className="button-row">
            {selected.length > 0 && !trip.me.scenariosConfirmed && (
              <Button
                disabled={busy}
                onClick={() => command({ type: "confirmScenarios" })}
              >
                Подтвердить выбор <Check size={18} />
              </Button>
            )}
            <Button variant="secondary" onClick={() => setReview(0)}>
              Пересмотреть сценарии
            </Button>
            {selected.length === 0 && (
              <ActionLink href={root + "/chat"}>
                Уточнить пожелания <ArrowRight size={18} />
              </ActionLink>
            )}
          </div>
        </div>
      )}
      {selected.length > 0 && current && !frozen && (
        <div className="deck-progress-note">
          <Heart size={15} />
          {selected.length} сценарий сохранён · можно выбрать ещё
        </div>
      )}
      {trip.me.scenariosConfirmed && !allConfirmed && (
        <div className="waiting-panel">
          <div className="avatar-stack">
            {trip.participants
              .filter((p) => !p.scenariosConfirmed && p.status !== "left")
              .map((p, i) => (
                <Avatar key={p.id} name={p.name} index={i} />
              ))}
          </div>
          <div>
            <h3>Ваш выбор сохранён</h3>
            <p>Ждём спутников. Их пожелания так же важны.</p>
          </div>
        </div>
      )}
      {noCommon && (
        <EmptyState
          title="Пока выбрали разный отдых"
          text="Общего сценария нет. Обсудите, что хочется сохранить каждому."
        >
          <div className="compromise-options">
            {trip.participants
              .filter((p) => p.status !== "left")
              .map((p) => (
                <p key={p.id}>
                  <strong>{p.name}: </strong>
                  {trip.scenarios
                    .filter(
                      (s) => decisionFor(t, p.id, "scenario", s.id) === "liked",
                    )
                    .map((s) => s.title)
                    .join(", ") || "Все варианты отклонены"}
                </p>
              ))}
          </div>
          <Button variant="secondary" onClick={() => setReview(0)}>
            Пересмотреть свой выбор
          </Button>
          <ActionLink href={root + "/chat"}>
            Обсудить пожелания <ArrowRight size={18} />
          </ActionLink>
        </EmptyState>
      )}
      {trip.scenarioIds.length > 0 && (
        <div className="next-stage-strip">
          <div>
            <span>
              <Check size={18} />
              Общий сценарий найден
            </span>
            <h2>Теперь найдём место для этих дней.</h2>
          </div>
          <Button disabled={busy} onClick={hotels}>
            Рассмотреть отели <ArrowRight size={19} />
          </Button>
        </div>
      )}
      <Dialog
        title={detail?.title ?? "Пример дня"}
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        {detail && (
          <div className="stack">
            <Photo
              className="dialog-photo"
              src={`/demo/${detail.imageAssetId}.jpg`}
              alt={detail.title}
            />
            <p>{detail.summary}</p>
            <ol className="day-outline">
              {detail.dayOutline.map((s, i) => (
                <li key={s}>
                  <span>{["Утро", "День", "Вечер"][i]}</span>
                  <strong>{s}</strong>
                </li>
              ))}
            </ol>
            <p className="tradeoff">
              <Clock size={18} />
              {detail.tradeoffs.join(". ")}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
