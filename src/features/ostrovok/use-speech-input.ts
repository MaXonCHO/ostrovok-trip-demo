"use client";
import { useEffect, useRef, useState } from "react";

type SpeechResults = ArrayLike<ArrayLike<{ transcript: string }>>;
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: SpeechResults }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useSpeechInput(
  value: string,
  onChange: (value: string) => void,
) {
  const [phase, setPhase] = useState<"idle" | "listening" | "processing">(
    "idle",
  );
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  const callback = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    callback.current = onChange;
  }, [value, onChange]);
  useEffect(
    () => () => {
      const active = recognition.current;
      if (active) {
        active.onstart = null;
        active.onresult = null;
        active.onerror = null;
        active.onend = null;
        active.abort();
        recognition.current = null;
      }
    },
    [],
  );

  const start = () => {
    if (recognition.current) return;
    setError("");
    const browser = window as SpeechWindow;
    const Constructor =
      browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) {
      setError(
        "Этот браузер не поддерживает голосовой ввод. Можно написать пожелания или открыть страницу в Chrome.",
      );
      return;
    }
    const active = new Constructor();
    const prefix = valueRef.current.trim();
    active.lang = "ru-RU";
    active.continuous = true;
    active.interimResults = true;
    active.onstart = () => setPhase("listening");
    active.onresult = (event) => {
      const parts: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        const transcript = event.results[index]?.[0]?.transcript;
        if (transcript) parts.push(transcript);
      }
      const transcript = parts.join(" ").trim();
      if (transcript)
        callback.current(
          [prefix, transcript].filter(Boolean).join(" ").slice(0, 3000),
        );
    };
    active.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed":
          "Доступ к микрофону не разрешён. Разрешите его в браузере или напишите пожелания текстом.",
        "service-not-allowed":
          "Браузер не разрешил распознавание речи. Введите пожелания текстом.",
        "audio-capture":
          "Не удалось подключить микрофон. Проверьте его подключение и доступ в браузере.",
        network:
          "Не удалось распознать речь. Проверьте интернет-соединение или введите текст.",
        "no-speech":
          "Не удалось услышать речь. Попробуйте ещё раз или введите текст.",
      };
      if (event.error !== "aborted")
        setError(
          messages[event.error] ||
            "Голосовой ввод сейчас недоступен. Можно продолжить текстом.",
        );
      setPhase("idle");
      recognition.current = null;
      active.onresult = null;
      active.onend = null;
      active.onstart = null;
      active.onerror = null;
      try {
        active.abort();
      } catch {}
    };
    active.onend = () => {
      setPhase("idle");
      recognition.current = null;
    };
    recognition.current = active;
    try {
      active.start();
    } catch {
      recognition.current = null;
      setPhase("idle");
      setError(
        "Не удалось включить микрофон. Попробуйте ещё раз или введите текст.",
      );
    }
  };
  const stop = () => {
    const active = recognition.current;
    if (!active) return;
    setPhase("processing");
    try {
      active.stop();
    } catch {
      setPhase("idle");
      recognition.current = null;
      try {
        active.abort();
      } catch {}
    }
  };
  return { phase, error, start, stop, clearError: () => setError("") };
}
