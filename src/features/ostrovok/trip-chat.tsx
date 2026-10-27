"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, CloudSun, Microphone, Stop } from "@phosphor-icons/react";
import { cities, filterHotels, getHotel, hotels } from "./catalog";
import {
  param,
  plural,
  readSearch,
  searchParams,
  shortDate,
  type Query,
} from "./search-state";
import {
  emptyTripChatProfile,
  parseTripChatReply,
  parseTripChatRequest,
  type TripChatContext,
  type TripChatMessage,
  type TripChatProfile,
  type TripChatStage,
} from "./trip-chat-contract";
import { useSpeechInput } from "./use-speech-input";
import { petersburgCollections } from "./petersburg-collections";
import { TripHotelCarousel } from "./trip-hotel-carousel";
import { TripTypeCards } from "./trip-type-cards";
import type { TripWeather } from "./trip-weather";

const storageKey = "ostrovok-trip-conversation-v1";
interface Conversation {
  version: 1;
  seed: string;
  context: TripChatContext;
  messages: TripChatMessage[];
  suggestions: string[];
  hotelSlugs: string[];
  collectionIds: string[];
  candidateHotelSlugs: string[];
  profile: TripChatProfile;
  stage: TripChatStage;
  ready: boolean;
  error?: string;
}
function initialCollections(wish: string): string[] {
  const text = wish.toLowerCase().replace(/без детей|без ребёнка/g, "");
  const topics: [RegExp, string][] = [
    [/роман|вдвоём|вдвоем|пара|свидан/, "spb-romance"],
    [/ребён|ребен|дет|семь/, "spb-family"],
    [/музе|культур|искусств/, "spb-museums"],
    [/ресторан|еда|кофе|завтрак|гастрон/, "spb-food"],
    [/гулять|прогул|пеш/, "spb-walks"],
    [/бюджет|недорог|эконом/, "spb-free"],
    [/осен|уют|спокой/, "spb-autumn"],
  ];
  const ids = topics
    .filter(([pattern]) => pattern.test(text))
    .map(([, id]) => id);
  return ids.length ? ids.slice(0, 3) : ["spb-weekend", "spb-walks"];
}

function createConversation(query: Query, seed: string): Conversation {
  const search = { ...readSearch(query), city: "saint-petersburg" };
  const wish = param(query, "wish").slice(0, 3000).trim();
  const budget = Number(param(query, "maxPrice"));
  const knownAmenities = new Set(hotels.flatMap((h) => h.amenities));
  const context: TripChatContext = {
    search,
    wish,
    amenities: param(query, "amenities")
      .split(",")
      .filter((a) => knownAmenities.has(a)),
    ...(budget > 0 && budget <= 1000000 ? { maxPrice: budget } : {}),
    apartmentsOnly: param(query, "property") === "apartments",
    source: param(query, "source") === "filters" ? "filters" : "wish",
  };
  const city = cities.find((c) => c.slug === search.city)!;
  const initial =
    context.source === "filters"
      ? `Подберите ${context.apartmentsOnly ? "апартаменты" : "отель"} ${city.preposition}. ${shortDate(search.checkin)} — ${shortDate(search.checkout)}, ${search.adults} ${plural(search.adults, ["взрослый", "взрослых", "взрослых"])}${search.children ? ` и ${search.children} ${plural(search.children, ["ребёнок", "ребёнка", "детей"])}` : ""}, ${search.rooms} ${plural(search.rooms, ["номер", "номера", "номеров"])}.${wish ? ` Пожелания: ${wish}` : ""}`
      : wish ||
        "Хочу найти подходящий отель в Санкт-Петербурге. Помогите определиться с пожеланиями.";
  return {
    version: 1,
    seed,
    context,
    messages: [{ role: "user", content: initial.slice(0, 3000) }],
    suggestions: [],
    hotelSlugs: [],
    collectionIds: initialCollections(wish),
    candidateHotelSlugs: context.apartmentsOnly
      ? []
      : filterHotels({
          city: "saint-petersburg",
          maxPrice: context.maxPrice,
          amenities: context.amenities,
        }).map((h) => h.slug),
    ready: false,
    stage: "basics",
    profile: {
      ...emptyTripChatProfile(),
      budgetMax: context.maxPrice ?? null,
      adults: context.source === "filters" ? search.adults : null,
      children: context.source === "filters" ? search.children : null,
      rooms: context.source === "filters" ? search.rooms : null,
      city:
        context.source === "filters" || /петербург|питер|spb/i.test(wish)
          ? "saint-petersburg"
          : null,
      checkin: context.source === "filters" ? search.checkin : null,
      checkout: context.source === "filters" ? search.checkout : null,
      tripType: null,
    },
  };
}
function readSaved(): Conversation | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(storageKey) || "null",
    );
    if (!value || typeof value !== "object") return null;
    const s = value as Conversation;
    if (
      s.version !== 1 ||
      typeof s.seed !== "string" ||
      !Array.isArray(s.messages) ||
      s.messages.length > 200 ||
      !s.messages.length ||
      !s.messages.every(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.length <= 3000,
      )
    )
      return null;
    parseTripChatRequest({
      context: s.context,
      messages: [{ role: "user", content: "Проверка параметров" }],
    });
    parseTripChatReply({
      message: "Проверка ответа",
      suggestions: s.suggestions,
      hotelSlugs: s.hotelSlugs,
      collectionIds: s.collectionIds || [],
      profile: { ...emptyTripChatProfile(), ...s.profile },
      stage: s.stage || "basics",
      candidateHotelSlugs:
        s.candidateHotelSlugs ||
        hotels
          .filter((h) => h.citySlug === "saint-petersburg")
          .map((h) => h.slug),
      ready: s.ready,
    });
    if (s.error !== undefined && typeof s.error !== "string") return null;
    return {
      ...s,
      profile: { ...emptyTripChatProfile(), ...s.profile },
      stage: s.stage || "basics",
      collectionIds: s.collectionIds || [],
      candidateHotelSlugs:
        s.candidateHotelSlugs ||
        hotels
          .filter((h) => h.citySlug === "saint-petersburg")
          .map((h) => h.slug),
    };
  } catch {
    return null;
  }
}
function recentMessages(messages: TripChatMessage[]) {
  const result: TripChatMessage[] = [];
  let length = 0;
  for (const m of [...messages].reverse()) {
    if (result.length >= 24 || length + m.content.length > 16000) break;
    result.unshift(m);
    length += m.content.length;
  }
  return result;
}

function AssistantText({
  text,
  animate,
  onComplete,
}: {
  text: string;
  animate: boolean;
  onComplete: () => void;
}) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (
      !animate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(text.length);
      if (animate) onComplete();
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = Math.min(6000, Math.max(500, text.length * 14));
    const tick = (now: number) => {
      const count = Math.min(
        text.length,
        Math.floor(((now - start) / duration) * text.length),
      );
      setShown(count);
      if (count < text.length) frame = requestAnimationFrame(tick);
      else onComplete();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, text, onComplete]);
  return (
    <p className="ov-ai-text" data-typing={animate && shown < text.length}>
      <span className="ov-ai-text-space" aria-hidden="true">
        {text}
      </span>
      <span className="ov-ai-text-visible" aria-hidden="true">
        {text.slice(0, shown)}
      </span>
      <span className="ov-sr-only">{text}</span>
    </p>
  );
}

export function TripChat({ query }: { query: Query }) {
  const seed = JSON.stringify(query);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [pending, setPending] = useState(false);
  const [typingIndex, setTypingIndex] = useState<number | null>(null);
  const finishTyping = useCallback(() => setTypingIndex(null), []);
  const [draft, setDraft] = useState("");
  const [weather, setWeather] = useState<TripWeather | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [weatherRetry, setWeatherRetry] = useState(0);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const speech = useSpeechInput(draft, setDraft);
  useEffect(() => {
    const saved = readSaved();
    const next =
      saved && (saved.seed === seed || !Object.keys(query).length)
        ? saved
        : createConversation(query, seed);
    setConversation(next);
    setPending(next.messages.at(-1)?.role === "user" && !next.error);
    // The route is keyed by query, so each new request gets its own initial session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
  useEffect(() => {
    if (!conversation) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversation));
    } catch {
      /* Keep the current conversation usable without storage. */
    }
  }, [conversation]);
  useEffect(() => {
    if (!pending || !conversation) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort("timeout"), 35000);
    let mounted = true;
    const request = async () => {
      try {
        const response = await fetch("/api/trip-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: conversation.context,
            messages: recentMessages(conversation.messages),
          }),
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok) {
          const message =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Помощник пока не ответил. Попробуйте ещё раз.";
          throw new Error(message);
        }
        const reply = parseTripChatReply(data);
        if (mounted) setTypingIndex(conversation.messages.length);
        if (mounted)
          setConversation((current) =>
            current
              ? {
                  ...current,
                  messages: [
                    ...current.messages,
                    { role: "assistant", content: reply.message },
                  ],
                  suggestions: reply.suggestions,
                  hotelSlugs: reply.hotelSlugs,
                  collectionIds: reply.collectionIds.length
                    ? reply.collectionIds
                    : current.collectionIds,
                  candidateHotelSlugs: reply.candidateHotelSlugs,
                  ready: reply.ready,
                  profile: reply.profile,
                  stage: reply.stage,
                  error: undefined,
                }
              : current,
          );
      } catch (error) {
        if (mounted)
          setConversation((current) =>
            current
              ? {
                  ...current,
                  error: controller.signal.aborted
                    ? "Ответ занимает больше времени, чем обычно. Попробуйте ещё раз."
                    : error instanceof Error
                      ? error.message
                      : "Не удалось получить ответ. Попробуйте ещё раз.",
                }
              : current,
          );
      } finally {
        window.clearTimeout(timer);
        if (mounted) setPending(false);
      }
    };
    void request();
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pending, conversation]);
  useEffect(() => {
    const log = end.current?.parentElement;
    if (log && log.scrollHeight > log.clientHeight)
      log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [conversation?.messages.length, pending]);
  useEffect(() => {
    if (conversation) window.dispatchEvent(new Event("ov:trip-ready"));
  }, [conversation]);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.max(48, Math.min(160, element.scrollHeight))}px`;
  }, [draft]);
  const city = conversation?.profile.city;
  const checkin = conversation?.profile.checkin;
  const checkout = conversation?.profile.checkout;
  useEffect(() => {
    setWeather(null);
    setWeatherError(false);
    if (!city || !checkin || !checkout) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ city, checkin, checkout });
    void fetch(`/api/trip-weather?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Weather unavailable");
        const data: TripWeather = await response.json();
        if (
          !Number.isFinite(data.temperatureMin) ||
          !Number.isFinite(data.temperatureMax)
        )
          throw new Error("Invalid weather");
        setWeather(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setWeatherError(true);
      });
    return () => controller.abort();
  }, [city, checkin, checkout, weatherRetry]);
  const send = (value = draft) => {
    const content = value.trim().slice(0, 3000);
    if (
      !content ||
      !conversation ||
      pending ||
      conversation.error ||
      speech.phase !== "idle"
    )
      return;
    setConversation({
      ...conversation,
      messages: [...conversation.messages, { role: "user", content }],
      suggestions: [],
      error: undefined,
    });
    setDraft("");
    setTypingIndex(null);
    speech.clearError();
    setPending(true);
  };
  const context = conversation?.context;
  const catalogQuery = context
    ? searchParams({
        ...context.search,
        ...(checkin && checkout ? { checkin, checkout } : {}),
        ...(conversation?.profile.adults
          ? { adults: conversation.profile.adults }
          : {}),
        ...(conversation?.profile.children !== null &&
        conversation?.profile.children !== undefined
          ? { children: conversation.profile.children }
          : {}),
        ...(conversation?.profile.rooms
          ? { rooms: conversation.profile.rooms }
          : {}),
      })
    : new URLSearchParams({ city: "saint-petersburg" });
  if (context?.wish) catalogQuery.set("wish", context.wish);
  if (context?.amenities.length)
    catalogQuery.set("amenities", context.amenities.join(","));
  if (context?.maxPrice) catalogQuery.set("maxPrice", String(context.maxPrice));
  if (context?.apartmentsOnly) catalogQuery.set("property", "apartments");
  const visibleCollections = conversation?.collectionIds.length
    ? conversation.collectionIds
    : initialCollections(conversation?.context.wish || "");
  return (
    <div className="ov-trip-page">
      <div
        className="ov-trip-backdrop"
        data-city={conversation?.profile.city || "landscape"}
        aria-hidden="true"
      />
      <div className="ov-trip-layout">
        <header className="ov-trip-heading">
          <h1>Моя поездка</h1>
        </header>
        {city && checkin && checkout && (
          <section
            className="ov-trip-weather"
            aria-label="Погода на даты поездки"
            data-open={weatherOpen}
          >
            <button
              className="ov-weather-badge"
              type="button"
              aria-expanded={weatherOpen}
              aria-describedby="trip-weather-details"
              onClick={() => setWeatherOpen((open) => !open)}
            >
              <CloudSun size={20} />
              <span>
                {weather
                  ? `${weather.temperatureMin > 0 ? "+" : ""}${weather.temperatureMin}…${weather.temperatureMax > 0 ? "+" : ""}${weather.temperatureMax}°`
                  : weatherError
                    ? "—°"
                    : "…°"}
              </span>
            </button>
            <div
              className="ov-weather-tooltip"
              id="trip-weather-details"
              role="tooltip"
            >
              <strong>
                {shortDate(checkin)} — {shortDate(checkout)} · Санкт-Петербург
              </strong>
              <p>
                {weather
                  ? `${weather.label}. ${weather.description}`
                  : weatherError
                    ? "Не удалось получить погоду."
                    : "Уточняем погоду…"}
              </p>
              {weather && (
                <a href={weather.sourceUrl} target="_blank" rel="noreferrer">
                  Open-Meteo ↗
                </a>
              )}
              {weatherError && (
                <button
                  type="button"
                  onClick={() => setWeatherRetry((n) => n + 1)}
                >
                  Обновить погоду
                </button>
              )}
            </div>
          </section>
        )}
        <div className="ov-trip-columns">
          <section
            className="ov-chat"
            aria-label="Диалог о поездке"
            aria-busy={pending || typingIndex !== null}
          >
            <div
              className="ov-chat-messages"
              role="log"
              aria-label="Сообщения диалога"
              aria-live="polite"
              aria-relevant="additions"
            >
              {conversation?.messages.map((message, i) => (
                <article
                  className={`ov-chat-message is-${message.role}`}
                  key={i}
                  style={
                    i === 0
                      ? { viewTransitionName: "trip-user-message" }
                      : undefined
                  }
                >
                  <span className="ov-chat-author">
                    {message.role === "user" ? "Вы" : "Островок"}
                  </span>
                  {message.role === "assistant" ? (
                    <AssistantText
                      text={message.content}
                      animate={typingIndex === i}
                      onComplete={finishTyping}
                    />
                  ) : (
                    <p>{message.content}</p>
                  )}
                </article>
              ))}
              {(pending || !conversation) && (
                <div className="ov-chat-loading" role="status">
                  <span />
                  <span />
                  <span />
                  Уточняем детали поездки…
                </div>
              )}
              {conversation?.error && (
                <div className="ov-chat-error" role="alert">
                  <p>{conversation.error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setConversation({ ...conversation, error: undefined });
                      setPending(true);
                    }}
                  >
                    Повторить
                  </button>
                </div>
              )}
              <div ref={end} />
            </div>
            <div className="ov-chat-suggestions" aria-label="Варианты ответа">
              {conversation?.stage === "trip-types" &&
                !pending &&
                typingIndex === null && (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .querySelector('[aria-label="Тип отдыха"]')
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    Выбрать тип отдыха ↓
                  </button>
                )}
              {!pending &&
                typingIndex === null &&
                !conversation?.error &&
                conversation?.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={speech.phase !== "idle"}
                    onClick={() => send(s)}
                  >
                    {s}
                  </button>
                ))}
            </div>
            <form
              className="ov-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <label htmlFor="trip-message">Сообщение</label>
              <textarea
                id="trip-message"
                ref={input}
                rows={1}
                maxLength={3000}
                placeholder="Например: хочется тишины и завтрака с видом"
                value={draft}
                readOnly={
                  pending || speech.phase !== "idle" || !!conversation?.error
                }
                onChange={(event) => {
                  setDraft(event.target.value);
                  speech.clearError();
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
                aria-describedby="trip-voice-status"
              />
              <div className="ov-chat-composer-actions">
                <span id="trip-voice-status" role="status">
                  {speech.error ||
                    (speech.phase === "listening"
                      ? "Слушаем… Нажмите ещё раз, чтобы остановить."
                      : "Напишите или расскажите голосом")}
                </span>
                <button
                  type="button"
                  className="ov-chat-mic"
                  aria-label={
                    speech.phase === "listening"
                      ? "Остановить голосовой ввод"
                      : "Ввести голосом"
                  }
                  aria-pressed={speech.phase === "listening"}
                  disabled={
                    pending ||
                    speech.phase === "processing" ||
                    !!conversation?.error
                  }
                  onClick={
                    speech.phase === "listening" ? speech.stop : speech.start
                  }
                >
                  {speech.phase === "listening" ? (
                    <Stop size={20} />
                  ) : (
                    <Microphone size={22} />
                  )}
                </button>
                <button
                  type="submit"
                  className="ov-button ov-chat-send"
                  disabled={
                    !draft.trim() ||
                    pending ||
                    speech.phase !== "idle" ||
                    !!conversation?.error
                  }
                >
                  Отправить <ArrowUp size={18} />
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
      {!!conversation && (
        <section
          className="ov-trip-collections"
          aria-label="Подборки по вашему запросу"
        >
          <div className="ov-container">
            {conversation.stage === "trip-types" && (
              <section className="ov-trip-type-stage" aria-label="Тип отдыха">
                <TripTypeCards
                  disabled={pending || speech.phase !== "idle"}
                  onSelect={(ids) => {
                    send(
                      `Выбираю тип отдыха: ${ids
                        .map(
                          (id) =>
                            petersburgCollections.find((c) => c.id === id)
                              ?.title,
                        )
                        .filter(Boolean)
                        .join(", ")}.`,
                    );
                    window.scrollTo({
                      top: 0,
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    });
                  }}
                />
              </section>
            )}

            <div className="ov-trip-collections-heading">
              <h2>Идеи для вашей поездки</h2>
              <span>
                {visibleCollections.length}{" "}
                {plural(visibleCollections.length, [
                  "подборка",
                  "подборки",
                  "подборок",
                ])}
              </span>
            </div>
            {visibleCollections.flatMap((id) => {
              const collection = petersburgCollections.find((c) => c.id === id);
              if (!collection) return [];
              const options = conversation.candidateHotelSlugs.flatMap(
                (slug) => {
                  const h = getHotel(slug);
                  return h ? [h] : [];
                },
              );
              return [
                <section
                  key={id}
                  className="ov-trip-collection"
                  data-collection-id={id}
                  aria-labelledby={`title-${id}`}
                >
                  <div className="ov-trip-collection-heading">
                    <div>
                      <h3 id={`title-${id}`}>{collection.title}</h3>
                      <p>{collection.description}</p>
                    </div>
                  </div>
                  <TripHotelCarousel
                    options={options}
                    query={catalogQuery.toString()}
                    label={collection.title}
                  />
                  <a
                    className="ov-trip-editorial-source"
                    href={collection.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Идея для поездки — О!Блог ↗
                  </a>
                </section>,
              ];
            })}
            <p className="ov-trip-collection-note">
              Цены и удобства демонстрационные. Особые пожелания нужно
              подтвердить у отеля.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
