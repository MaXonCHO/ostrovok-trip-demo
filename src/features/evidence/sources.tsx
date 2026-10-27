"use client";
import { useState } from "react";
import {
  Info,
  ArrowUpRight,
  Check,
  Warning,
  Clock,
} from "@phosphor-icons/react";
import { Button, Dialog, Input } from "@/components/ui/primitives";
import type { Evidence, Hotel } from "@/domain/models";
import { useTrip } from "@/features/trips/context";
import { features } from "@/data/contracts";
const statuses = {
  demo: "Демо-источник",
  supported: "Есть основание",
  uncertain: "Нужно уточнить",
  conflicting: "Конфликт источников",
  stale: "Сведения устарели",
};
export function SourceDetails({ hotel }: { hotel: Hotel }) {
  const { trip, setNotice, load } = useTrip();
  const [source, setSource] = useState<Evidence | null>(null);
  const [question, setQuestion] = useState(
    "В какую сторону выходят окна номера «Стандарт»?",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;
    setPending(true);
    try {
      const r = await fetch("/api/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ask",
          hotelId: hotel.id,
          tripId: trip.id,
          question,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNotice("Вопрос сохранён. Ответьте в демонстрации отельера.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section id="sources" className="sources-section">
      <h2>На чём основаны сведения</h2>
      <p className="muted">
        Это демонстрационные записи. Источники сохраняются отдельно,
        противоречия остаются видимыми.
      </p>
      <div className="evidence-list">
        {hotel.evidence.map((e) => (
          <button
            key={e.id}
            onClick={() => setSource(e)}
            className={`evidence-row status-${e.status}`}
          >
            <span>
              {e.status === "conflicting" ? (
                <Warning size={21} />
              ) : e.status === "stale" ? (
                <Clock size={21} />
              ) : (
                <Info size={21} />
              )}
            </span>
            <div>
              <strong>
                {features.find((f) => f.key === e.featureKey)?.label ??
                  (e.featureKey === "breakfast" ? "Завтрак" : e.featureKey)}
              </strong>
              <span>
                {e.value === null
                  ? "Нет подтверждённых сведений"
                  : typeof e.value === "boolean"
                    ? e.value
                      ? "Да"
                      : "Нет"
                    : String(e.value)}
                {e.featureKey === "seaWalk" ? " мин" : ""}
              </span>
              <small>
                {e.scope.roomTypeId
                  ? "Для номера «Стандарт»"
                  : "На уровне отеля"}{" "}
                · {statuses[e.status]}
              </small>
            </div>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      <div className="ask-host">
        <h3>Что-то осталось неясным?</h3>
        <p>
          Демонстрационный отельер может уточнить сторону окон или тишину. Ответ
          сначала проверяется, затем добавляется к источникам.
        </p>
        <form onSubmit={ask}>
          <Input
            label="Вопрос отельеру"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            required
          />
          <Button type="submit" disabled={pending || !question.trim()}>
            Задать вопрос
          </Button>
        </form>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <a href="/host/demo" className="text-link">
          Открыть демонстрацию отельера <ArrowUpRight size={16} />
        </a>
      </div>
      <Dialog
        title="Источник характеристики"
        open={!!source}
        onOpenChange={(v) => {
          if (!v) setSource(null);
        }}
      >
        {source && (
          <div className="stack">
            <span className={`status-label status-${source.status}`}>
              {statuses[source.status]}
            </span>
            <dl className="source-dl">
              <dt>Характеристика</dt>
              <dd>
                {features.find((f) => f.key === source.featureKey)?.label ??
                  source.featureKey}
              </dd>
              <dt>Значение</dt>
              <dd>
                {source.value === null ? "Неизвестно" : String(source.value)}
              </dd>
              <dt>Источник</dt>
              <dd>{source.source.name}</dd>
              <dt>Область</dt>
              <dd>
                {source.scope.roomTypeId
                  ? "Только номер «Стандарт»"
                  : "Отель в целом"}
              </dd>
              <dt>Получено</dt>
              <dd>{new Date(source.observedAt).toLocaleDateString("ru-RU")}</dd>
              {source.validUntil && (
                <>
                  <dt>Актуально до</dt>
                  <dd>
                    {new Date(source.validUntil).toLocaleDateString("ru-RU")}
                  </dd>
                </>
              )}
              <dt>Уверенность</dt>
              <dd>
                {source.confidence === null
                  ? "Источник не оценивал уверенность"
                  : `${source.confidence} · шкала источника${source.isSynthetic ? ", демо-оценка" : ""}`}
              </dd>
              <dt>Происхождение</dt>
              <dd>
                {source.isSynthetic
                  ? "Синтетические данные"
                  : "Внешний источник"}
              </dd>
              {source.method && (
                <>
                  <dt>Метод</dt>
                  <dd>{source.method}</dd>
                </>
              )}
            </dl>
            {source.conflictsWith?.length ? (
              <div className="notice">
                <Warning size={20} />
                Сведения расходятся с другими записями. Номер во двор и шум с
                улицы могут описывать разные условия. Нужна проверка области
                применимости.
              </div>
            ) : (
              <p>
                <Check size={18} />
                Другие источники не заменялись этой записью.
              </p>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
}
