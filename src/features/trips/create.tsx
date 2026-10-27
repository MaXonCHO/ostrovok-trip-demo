"use client";
import { Photo } from "@/components/ui/photo";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  User,
  Users,
  Check,
  ArrowLeft,
} from "@phosphor-icons/react";
import {
  Input,
  Button,
  ErrorNotice,
  ActionLink,
} from "@/components/ui/primitives";
import { cities } from "@/data/fixtures/lexicon";
export function CreateTrip() {
  const router = useRouter();
  const [group, setGroup] = useState(false);
  const [city, setCity] = useState("sochi");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [wish, setWish] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("group")) setGroup(p.get("group") === "1");
    if (p.has("city")) setCity(p.get("city") ?? "");
    setWish(p.get("wish") ?? "");
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          cityId: city || null,
          group,
          expectedParticipants: group ? Number(f.get("people")) : 1,
          nights: Number(f.get("nights")),
          rooms: Number(f.get("rooms")),
          start: f.get("start") || undefined,
          end: f.get("end") || undefined,
          prompt: f.get("prompt") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/trips/${data.id}/chat`);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }
  return (
    <div className="page-width creation-page">
      <ActionLink href="/" variant="ghost">
        <ArrowLeft size={18} />
        На главную
      </ActionLink>
      <div className="creation-grid">
        <aside className="creation-visual">
          <Photo
            src="/demo/sea.jpg"
            alt="Море и открытый песчаный берег, иллюстрация"
          />
          <div>
            <span>Ваша следующая поездка</span>
            <h1>
              Хорошо там,
              <br />
              где хорошо вам.
            </h1>
            <p>Начнём с простого. Остальное обсудим в диалоге.</p>
          </div>
        </aside>
        <form onSubmit={submit} className="creation-form">
          <div>
            <span className="small-label">Начало поездки</span>
            <h2>С кем отправляемся?</h2>
            <p className="muted">У каждого будет свой голос в выборе.</p>
          </div>
          <div className="segmented composition">
            <button
              type="button"
              aria-pressed={!group}
              onClick={() => setGroup(false)}
            >
              <User size={22} />
              Один{!group && <Check size={18} />}
            </button>
            <button
              type="button"
              aria-pressed={group}
              onClick={() => setGroup(true)}
            >
              <Users size={22} />
              Вместе{group && <Check size={18} />}
            </button>
          </div>
          <Input
            label="Как вас зовут?"
            name="name"
            placeholder="Артём"
            required
            maxLength={40}
            autoComplete="given-name"
          />
          {group && (
            <Input
              label="Сколько участников, включая вас?"
              type="number"
              name="people"
              defaultValue={2}
              min={2}
              max={12}
            />
          )}
          <label className="field">
            <span>Куда хочется поехать?</span>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.id !== "sochi" ? " · краткое демо" : ""}
                </option>
              ))}
              <option value="">Пока не знаю</option>
            </select>
          </label>
          <div className="form-row">
            <Input
              label="Ночей"
              type="number"
              name="nights"
              defaultValue={4}
              min={1}
              max={60}
              required
            />
            <Input
              label="Номеров"
              type="number"
              name="rooms"
              defaultValue={1}
              min={1}
              max={8}
              required
            />
          </div>
          <details className="date-disclosure">
            <summary>Указать даты, если уже известны</summary>
            <div className="form-row">
              <Input label="Заезд" name="start" type="date" />
              <Input label="Выезд" name="end" type="date" />
            </div>
          </details>
          <label className="field">
            <span>
              Что хочется от отдыха?{" "}
              <span className="optional">Необязательно</span>
            </span>
            <textarea
              name="prompt"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              rows={2}
              placeholder="Море, итальянская еда и много гулять. Или пока не знаю."
              maxLength={3000}
            />
          </label>
          {error && <ErrorNotice message={error} />}
          <Button type="submit" disabled={pending}>
            {pending ? "Создаём поездку…" : "Перейти к пожеланиям"}
            <ArrowRight size={20} />
          </Button>
          <small className="muted">
            Без регистрации. Поездка сохранится в этом браузере.
          </small>
        </form>
      </div>
    </div>
  );
}
