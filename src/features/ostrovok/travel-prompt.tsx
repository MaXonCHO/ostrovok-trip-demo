"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Bed,
  Car,
  Microphone,
  SlidersHorizontal,
  Stop,
} from "@phosphor-icons/react";
import { buildNaturalSearch } from "./natural-search";
import { defaults, type SearchState } from "./search-state";
import { Modal, SearchForm } from "./shared";
import { useSpeechInput } from "./use-speech-input";
import { navigateToTrip } from "./trip-navigation";
import { blogDraftKey, blogInterestEvent } from "@/features/blog/articles";

const examples = [
  "Выходные в Петербурге",
  "Тихий отель в центре",
  "Петербург с питомцем",
];
export function TravelPrompt() {
  const router = useRouter();
  const [wish, setWish] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [filters, setFilters] = useState<SearchState>(defaults);
  const [apartmentsOnly, setApartmentsOnly] = useState(false);
  const [explicitCity, setExplicitCity] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const filterTitle = useRef<HTMLHeadingElement>(null);
  const speech = useSpeechInput(wish, setWish);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(blogDraftKey, wish.slice(0, 3000));
        window.dispatchEvent(new Event(blogInterestEvent));
      } catch {}
    }, 300);
    return () => window.clearTimeout(timer);
  }, [wish]);
  const changeMode = (open: boolean) => {
    setFiltersOpen(open);
  };
  const focusRequest = () => {
    const element = input.current;
    element?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    element?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const focus = () => {
      setFiltersOpen(false);
      window.requestAnimationFrame(focusRequest);
    };
    window.addEventListener("ov:focus-request", focus);
    if (window.location.hash === "#trip-request-heading") focus();
    return () => window.removeEventListener("ov:focus-request", focus);
  }, []);
  useEffect(() => {
    if (filtersOpen) filterTitle.current?.focus({ preventScroll: true });
  }, [filtersOpen]);
  const returnToRequest = () => {
    changeMode(false);
    window.requestAnimationFrame(() =>
      input.current?.focus({ preventScroll: true }),
    );
  };
  const startSearch = (
    state: SearchState = filters,
    preferFilters = explicitCity,
  ) => {
    if (speech.phase !== "idle" || leaving) return;
    const params = buildNaturalSearch(wish, state, {
      apartmentsOnly,
      preferFilters,
    });
    params.set("source", filtersOpen ? "filters" : "wish");
    params.set(
      "new",
      globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    setLeaving(true);
    navigateToTrip(`/my-trip?${params}`, (url) => router.push(url));
  };
  return (
    <>
      <section
        className="ov-trip-composer"
        aria-labelledby="trip-request-heading"
      >
        <h2
          className="ov-prompt-label"
          id="trip-request-heading"
          ref={filterTitle}
          tabIndex={-1}
        >
          Расскажите, куда хотите отправиться
        </h2>
        <div className="ov-trip-panels">
          <section
            className="ov-inline-filters ov-trip-panel"
            aria-label="Фильтры поездки"
            aria-hidden={!filtersOpen}
            inert={!filtersOpen}
            data-active={filtersOpen}
          >
            <div className="ov-hero-form">
              <nav
                className="ov-search-service-tabs"
                aria-label="Услуги для поездки"
              >
                <div className="ov-search-service-group">
                  <button
                    className="is-active"
                    aria-pressed="true"
                    type="button"
                  >
                    <Bed size={23} weight="fill" />
                    Жильё
                  </button>
                  <button type="button" onClick={() => setTransfersOpen(true)}>
                    <Car size={23} weight="fill" />
                    Трансферы
                  </button>
                </div>
                <a
                  href="https://corp.ostrovok.ru/?ref=corplanding-button-home"
                  target="_blank"
                  rel="noreferrer"
                >
                  Для командировок <ArrowSquareOut size={18} />
                </a>
              </nav>
              <SearchForm
                id="trip-filters-form"
                externalSubmit
                original
                initial={filters}
                apartmentsOnly={apartmentsOnly}
                onStateChange={(state) => {
                  if (state.city !== filters.city) setExplicitCity(true);
                  setFilters(state);
                }}
                onSearch={(state) => startSearch(state, true)}
              />
              <div className="ov-filter-dialog-bottom">
                <label className="ov-apartments-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={apartmentsOnly}
                    onChange={(event) =>
                      setApartmentsOnly(event.target.checked)
                    }
                  />
                  <span className="ov-switch-track" aria-hidden="true" />
                  <span>Только квартиры</span>
                </label>
              </div>
            </div>
          </section>
          <form
            id="trip-wish-form"
            className="ov-travel-prompt ov-trip-panel"
            aria-hidden={filtersOpen}
            inert={filtersOpen}
            data-active={!filtersOpen}
            aria-label="Поиск по пожеланиям"
            onSubmit={(event) => {
              event.preventDefault();
              startSearch();
            }}
          >
            <div
              className={`ov-prompt-input ${speech.phase === "listening" ? "is-listening" : ""}`}
            >
              <input
                type="text"
                id="trip-request"
                ref={input}
                aria-labelledby="trip-request-heading"
                aria-describedby="voice-status"
                value={wish}
                maxLength={3000}
                autoComplete="off"
                placeholder="Например: в Петербург, в тихий отель с завтраком…"
                readOnly={speech.phase !== "idle"}
                onChange={(event) => {
                  setWish(event.target.value);
                  speech.clearError();
                }}
              />
              <div className="ov-prompt-toolbar">
                <button
                  className={`ov-voice-button ${speech.phase === "listening" ? "is-recording" : ""}`}
                  type="button"
                  disabled={speech.phase === "processing"}
                  aria-label={
                    speech.phase === "listening"
                      ? "Остановить голосовой ввод"
                      : "Ввести голосом"
                  }
                  title="Голос распознаётся сервисом браузера; может потребоваться интернет."
                  aria-pressed={speech.phase === "listening"}
                  onClick={
                    speech.phase === "listening" ? speech.stop : speech.start
                  }
                >
                  {speech.phase === "listening" ? (
                    <Stop size={22} weight="fill" />
                  ) : (
                    <Microphone size={24} />
                  )}
                </button>
              </div>
            </div>
            <div className="ov-prompt-examples" aria-label="Примеры пожеланий">
              {examples.map((example) => (
                <button
                  type="button"
                  key={example}
                  disabled={speech.phase !== "idle" || leaving}
                  onClick={() => {
                    setWish(example);
                    input.current?.focus();
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
            <div
              className="ov-prompt-status"
              id="voice-status"
              role="status"
              aria-live="polite"
            >
              {speech.error ||
                (speech.phase === "listening"
                  ? "Микрофон включён. Остановите запись, чтобы отредактировать текст."
                  : "")}
            </div>
          </form>
        </div>
        <div className="ov-prompt-bottom">
          {filtersOpen ? (
            <button
              type="button"
              className="ov-prompt-filters"
              aria-label="К пожеланиям"
              onClick={returnToRequest}
            >
              <ArrowLeft size={20} />
              <span className="ov-mode-back-long">К пожеланиям</span>
              <span className="ov-mode-back-short">Назад</span>
            </button>
          ) : (
            <button
              type="button"
              className="ov-prompt-filters"
              disabled={speech.phase !== "idle" || leaving}
              onClick={() => changeMode(true)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal size={20} />
              Фильтры
            </button>
          )}
          <button
            className="ov-button ov-prompt-submit"
            type="submit"
            form={filtersOpen ? "trip-filters-form" : "trip-wish-form"}
            disabled={speech.phase !== "idle" || leaving}
          >
            Подобрать отели <ArrowRight size={20} />
          </button>
        </div>
      </section>
      <Modal
        title="Трансферы"
        open={transfersOpen}
        onOpenChange={setTransfersOpen}
      >
        <p>
          Трансферы в этом прототипе пока не подключены. Подобрать поездку из
          аэропорта можно на Островке.
        </p>
        <a
          className="ov-button"
          href="https://ostrovok.ru/"
          target="_blank"
          rel="noreferrer"
        >
          Открыть Островок <ArrowRight size={17} />
        </a>
      </Modal>
    </>
  );
}
