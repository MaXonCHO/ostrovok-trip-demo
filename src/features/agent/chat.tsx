"use client";
import { Photo } from "@/components/ui/photo";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowRight,
  Check,
  ChatCircleText,
} from "@phosphor-icons/react";
import { useTrip } from "@/features/trips/context";
import {
  Button,
  Chip,
  Avatar,
  SectionHeading,
  ActionLink,
} from "@/components/ui/primitives";
import { cities, interestLabels } from "@/data/fixtures/lexicon";
export function Chat() {
  const { trip, command, busy } = useTrip();
  const router = useRouter();
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [trip?.me.messages.length]);
  if (!trip) return null;
  const root = `/trips/${trip.id}`;
  async function send() {
    if (!input.trim() || busy) return;
    const text = input;
    const ok = await command({ type: "message", text });
    if (ok) setInput("");
  }
  async function scenarios() {
    if (await command({ type: "generateScenarios" }))
      router.push(root + "/scenarios");
  }
  if (trip.selected || trip.me.role === "viewer")
    return (
      <div className="stack">
        <SectionHeading
          title="Решение сохранено"
          text="В поездке остались ваши пожелания, отель и план."
        />
        <ActionLink href={root}>
          Открыть поездку <ArrowRight size={19} />
        </ActionLink>
      </div>
    );
  return (
    <div className="chat-page">
      <SectionHeading
        title={`${trip.me.name}, каким будет ваш отдых?`}
        text="Расскажите, что хочется делать. Отель подберём после сценария."
      />
      <div className="agent-mode">
        <span className="agent-mark">
          <ChatCircleText size={20} />
        </span>
        <div>
          <strong>Помощник поездки</strong>
          <span>
            {trip.agentMode === "deepseek"
              ? "DeepSeek · личный диалог о вашей поездке"
              : "Демонстрационный диалог · понимает основные пожелания"}
          </span>
        </div>
      </div>
      {!trip.cityConfirmed && (
        <section className="direction-picker">
          <h2>Начнём с направления</h2>
          <p>
            Выберите город, чтобы сценарии и отели относились к одной поездке.
          </p>
          <div>
            {cities.map((c) => (
              <button
                disabled={busy || trip.me.id !== trip.organizerId}
                key={c.id}
                onClick={() =>
                  command({ type: "context", cityId: c.id as "sochi" })
                }
              >
                <Photo src={`/demo/${c.image}.jpg`} alt="" />
                <strong>{c.name}</strong>
                <span>{c.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div
        className="chat-log"
        role="log"
        aria-label="Личный диалог с помощником"
      >
        {trip.me.messages.map((m) => (
          <div key={m.id} className={`message message-${m.role}`}>
            {m.role === "agent" ? (
              <span className="message-icon">
                <ChatCircleText size={18} />
              </span>
            ) : (
              <Avatar name={trip.me.name} />
            )}
            <div>
              <span>{m.role === "agent" ? "Помощник" : trip.me.name}</span>
              <p>{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="chat-composer">
        <div className="suggestions">
          {[
            "Хочу море и гулять",
            "Тишина и природа",
            "Итальянская кухня",
            "Пока не знаю",
          ].map((s) => (
            <Chip
              key={s}
              onClick={() => setInput((v) => (v ? v + " " + s : s))}
            >
              {s}
            </Chip>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Ваши пожелания"
            placeholder="Например: гулять по центру, есть пасту и жить в тихом номере…"
            value={input}
            maxLength={3000}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Отправить пожелания"
          >
            <ArrowUp size={23} />
          </Button>
        </form>
        <span className="composer-hint">
          Enter отправить · Shift + Enter новая строка. Диалог виден только вам.
        </span>
      </div>
      {trip.me.preferences.some(
        (p) => p.key.startsWith("interest:") && p.value === true,
      ) && (
        <div className="preference-review">
          <h3>Как учитывать пожелания</h3>
          {trip.me.preferences
            .filter((p) => p.key.startsWith("interest:") && p.value === true)
            .map((p) => (
              <div key={p.id}>
                <span>
                  {
                    interestLabels[
                      p.key.slice(9) as keyof typeof interestLabels
                    ]
                  }
                </span>
                <button
                  disabled={busy}
                  className={
                    p.importance === "required"
                      ? "importance required"
                      : "importance"
                  }
                  onClick={() =>
                    command({
                      type: "preference",
                      id: p.id,
                      importance:
                        p.importance === "required" ? "preferred" : "required",
                    })
                  }
                >
                  {p.importance === "required" ? <Check size={15} /> : null}
                  {p.importance === "required"
                    ? "Обязательно"
                    : "Было бы хорошо"}
                </button>
              </div>
            ))}
        </div>
      )}
      <div className="chat-next">
        <p>
          {trip.blocked
            ? "Вы можете посмотреть предварительные сценарии, пока спутник отвечает."
            : "Можно начать с примеров и уточнить пожелания позже."}
        </p>
        <Button onClick={scenarios} disabled={busy || !trip.cityConfirmed}>
          Посмотреть сценарии <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  );
}
