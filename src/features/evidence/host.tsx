"use client";
import { useEffect, useState } from "react";
import {
  Check,
  ChatCircleText,
  ArrowRight,
  Warning,
  Buildings,
} from "@phosphor-icons/react";
import {
  Button,
  Textarea,
  SectionHeading,
  ErrorNotice,
  EmptyState,
  ActionLink,
} from "@/components/ui/primitives";
import type { HostQuestion } from "@/domain/models";
export function HostDemo() {
  const [questions, setQuestions] = useState<HostQuestion[]>([]);
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/host")
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) setQuestions(d.questions);
      })
      .catch(() => {});
  }, []);
  async function act(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setQuestions(d.questions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-width host-page">
      <SectionHeading
        title="Уточнить у тех, кто знает отель"
        text="Демонстрационный кабинет отельера. Вопрос, свободный ответ, проверка извлечённого значения и новый источник."
      />
      {error && <ErrorNotice message={error} />}
      <div className="notice">
        <Buildings size={22} />
        <span>
          Кабинет имитирует отельера и показывает вопросы, созданные из этой
          браузерной сессии. Ответы остаются демо-данными.
        </span>
      </div>
      {questions.length ? (
        <div className="host-questions">
          {questions.map((q) => (
            <article key={q.id}>
              <div className="host-question">
                <ChatCircleText size={25} />
                <div>
                  <span className="small-label">
                    Вопрос об отеле · {q.hotelId}
                  </span>
                  <h2>{q.question}</h2>
                  <p>
                    Область уточнения: категория «Стандарт». Ответ о номере не
                    переносится на весь отель.
                  </p>
                </div>
              </div>
              {q.status !== "confirmed" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act({
                      action: "answer",
                      id: q.id,
                      answer: answer[q.id] ?? q.answer ?? "",
                    });
                  }}
                >
                  <Textarea
                    label="Свободный ответ отельера"
                    value={answer[q.id] ?? q.answer ?? ""}
                    onChange={(e) =>
                      setAnswer((a) => ({ ...a, [q.id]: e.target.value }))
                    }
                    placeholder="Например: окна стандартных номеров выходят во двор."
                    rows={3}
                    maxLength={2000}
                    required
                  />
                  <Button type="submit" disabled={busy}>
                    Извлечь характеристику <ArrowRight size={18} />
                  </Button>
                </form>
              )}
              {q.suggestion && (
                <div className="extracted-feature">
                  <span className="small-label">Предложенное значение</span>
                  <h3>
                    {q.suggestion.featureKey === "windowSide"
                      ? "Сторона окон"
                      : "Тишина ночью"}
                    :{" "}
                    {typeof q.suggestion.value === "boolean"
                      ? q.suggestion.value
                        ? "да"
                        : "нет"
                      : q.suggestion.value}
                  </h3>
                  <p>
                    Область:{" "}
                    {q.suggestion.scope === "room"
                      ? "номер «Стандарт»"
                      : "отель"}
                    .
                  </p>
                  <p className="tradeoff">
                    <Warning size={18} />
                    Прежние записи сохраняются. Расхождение отмечается
                    конфликтом, а не скрывается.
                  </p>
                  {q.status === "confirmed" ? (
                    <p className="confirmation-line">
                      <Check size={20} />
                      Источник добавлен. Откройте карточку отеля, чтобы увидеть
                      обновлённые сведения.
                    </p>
                  ) : (
                    <Button
                      disabled={busy}
                      onClick={() => act({ action: "confirm", id: q.id })}
                    >
                      Подтвердить и сохранить источник <Check size={19} />
                    </Button>
                  )}
                </div>
              )}
              {q.answer && !q.suggestion && (
                <p className="notice">
                  Не удалось выделить поддерживаемую характеристику. Уточните
                  сторону окон или наличие шума. Непонятный ответ не
                  превращается в новое свойство.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Пока нет вопросов"
          text="Откройте отель из поездки и задайте вопрос в разделе источников. Он появится здесь."
        >
          <ActionLink href="/demo">
            Открыть демонстрационную поездку <ArrowRight size={18} />
          </ActionLink>
        </EmptyState>
      )}
    </div>
  );
}
