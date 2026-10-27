"use client";
import { Photo } from "@/components/ui/photo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CalendarBlank,
  MapPin,
  Plus,
  Link as LinkIcon,
  Note,
  ArrowUpRight,
  ArrowCounterClockwise,
  BookmarkSimple,
} from "@phosphor-icons/react";
import { useTrip } from "./context";
import {
  ActionLink,
  Button,
  Input,
  Textarea,
  Dialog,
  SectionHeading,
  EmptyState,
} from "@/components/ui/primitives";
import { TripSummary, Participants } from "@/features/collaboration/summary";
import { money } from "@/features/hotels/hotels";
export function Workspace() {
  const { trip, command, busy, setNotice } = useTrip();
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [material, setMaterial] = useState(false);
  const [place, setPlace] = useState(false);
  const [reopen, setReopen] = useState(false);
  if (!trip) return null;
  const root = `/trips/${trip.id}`;
  const hotel = trip.catalog.find((h) => h.id === trip.selected?.hotelId);
  async function saveMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await command({
        type: "material",
        title: String(f.get("title")),
        materialType: String(f.get("type")) as "note" | "link" | "ticket",
        url: f.get("url") ? String(f.get("url")) : undefined,
        text: String(f.get("text") || ""),
      })
    ) {
      setMaterial(false);
      setNotice("Материал добавлен");
    }
  }
  async function savePlace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await command({
        type: "customPlace",
        name: String(f.get("name")),
        note: String(f.get("note") || ""),
      })
    ) {
      setPlace(false);
      setNotice("Место сохранено");
    }
  }
  return (
    <>
      <nav className="workspace-tabs" aria-label="Разделы поездки">
        {[
          ["overview", "Обзор"],
          ["plan", "План и места"],
          ["people", "Участники"],
          ["materials", "Материалы"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          {hotel ? (
            <>
              <div className="workspace-hero">
                <Photo
                  src={hotel.image.path}
                  alt={`Иллюстрация отеля «${hotel.name}»`}
                />
                <div>
                  <span>
                    <Check size={19} />
                    Ваш общий выбор сохранён
                  </span>
                  <h1>{hotel.name}</h1>
                  <p>
                    {hotel.area} · {hotel.room.name}
                  </p>
                  <strong>
                    {money(hotel.price)} <small>за ночь за номер, демо</small>
                  </strong>
                  <ActionLink
                    href={`${root}/hotels/${hotel.id}`}
                    variant="secondary"
                  >
                    Отель и основания выбора <ArrowUpRight size={18} />
                  </ActionLink>
                </div>
              </div>
              <p className="notice">
                <Check size={19} />
                Решение сохранено. Это план поездки, номер ещё не забронирован.
              </p>
              <div className="workspace-overview-grid">
                <div>
                  <SectionHeading
                    title="Дальше, приятные планы"
                    text="Места, идеи и материалы теперь живут в одной поездке."
                  />
                  <ol className="day-outline">
                    {trip.places
                      .filter((p) => trip.savedPlaces.includes(p.id))
                      .slice(0, 3)
                      .map((p, i) => (
                        <li key={p.id}>
                          <span>День {i + 1}</span>
                          <strong>{p.name}</strong>
                          <p>{p.description}</p>
                        </li>
                      ))}
                  </ol>
                  <Button variant="secondary" onClick={() => setTab("plan")}>
                    Открыть план <ArrowRight size={18} />
                  </Button>
                </div>
                <div>
                  <TripSummary />
                  <Participants />
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title="Поездка уже началась с ваших идей"
              text="Продолжите выбор. После финального подтверждения здесь появится отель и план."
            >
              <ActionLink
                href={
                  root +
                  "/" +
                  (trip.stage === "chat"
                    ? "chat"
                    : trip.stage === "scenarios"
                      ? "scenarios"
                      : "hotels")
                }
              >
                Продолжить подбор <ArrowRight size={18} />
              </ActionLink>
            </EmptyState>
          )}
          <div className="workspace-history">
            <h3>История выбора</h3>
            <p>
              Версия подбора {trip.selectionRevision}. Предыдущих версий:{" "}
              {trip.history.length}.
            </p>
            {trip.history.map((h, i) => (
              <p key={i}>
                Версия {h.revision}: {h.reason}
                {h.selected
                  ? ` Выбранный отель: ${trip.catalog.find((c) => c.id === h.selected?.hotelId)?.name ?? h.selected.hotelId}.`
                  : ""}
              </p>
            ))}
            {trip.selected && trip.me.id === trip.organizerId && (
              <Button variant="ghost" onClick={() => setReopen(true)}>
                <ArrowCounterClockwise size={18} />
                Вернуться к подбору
              </Button>
            )}
          </div>
        </>
      )}
      {tab === "plan" && (
        <>
          <SectionHeading
            title="План и места"
            text="Сохраните понравившиеся точки или добавьте своё место. План можно менять без пересчёта отеля."
            aside={
              <Button onClick={() => setPlace(true)}>
                <Plus size={19} />
                Своё место
              </Button>
            }
          />
          <div className="places-grid">
            {trip.places.map((p) => (
              <article key={p.id}>
                <Photo
                  src={`/demo/${p.imageAssetId}.jpg`}
                  alt="Иллюстрация места"
                />
                <div>
                  <span className="small-label">
                    <MapPin size={15} />
                    Демонстрационная точка
                  </span>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <Button
                    variant={
                      trip.savedPlaces.includes(p.id)
                        ? "turquoise"
                        : "secondary"
                    }
                    disabled={busy}
                    onClick={() =>
                      command({ type: "savePlace", placeId: p.id })
                    }
                  >
                    <BookmarkSimple size={18} />
                    {trip.savedPlaces.includes(p.id) ? "Сохранено" : "В план"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {trip.customPlaces.length > 0 && (
            <div className="custom-places">
              <h2>Ваши места</h2>
              {trip.customPlaces.map((p) => (
                <div key={p.id}>
                  <MapPin size={22} />
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "people" && (
        <div className="workspace-people">
          <Participants />
          <section>
            <h2>Что важно каждому</h2>
            {trip.participants
              .filter((p) => p.status !== "left")
              .map((p) => (
                <div className="person-preferences" key={p.id}>
                  <h3>{p.name}</h3>
                  {p.preferences
                    .filter(
                      (pr) =>
                        pr.value === true && pr.key.startsWith("interest:"),
                    )
                    .map((pr) => (
                      <p key={pr.id}>
                        {
                          (
                            {
                              food: "Местная еда",
                              italian: "Итальянская кухня",
                              quiet: "Тишина",
                              nature: "Природа",
                              sea: "Море",
                              walks: "Прогулки",
                              sights: "Достопримечательности",
                            } as Record<string, string>
                          )[pr.key.slice(9)]
                        }{" "}
                        ·{" "}
                        {pr.importance === "required"
                          ? "Обязательно"
                          : "Было бы хорошо"}
                      </p>
                    ))}
                  <p className="muted">
                    Личная история диалога доступна только участнику.
                  </p>
                </div>
              ))}
            {!trip.selected && (
              <ActionLink href={root + "/chat"} variant="secondary">
                Мой диалог и пожелания <ArrowRight size={18} />
              </ActionLink>
            )}
          </section>
        </div>
      )}
      {tab === "materials" && (
        <>
          <SectionHeading
            title="Всё нужное для поездки"
            text="Билеты, полезные ссылки и заметки. Личные файлы в этом прототипе не загружаются."
            aside={
              <Button onClick={() => setMaterial(true)}>
                <Plus size={19} />
                Добавить материал
              </Button>
            }
          />
          {trip.materials.length ? (
            <div className="materials-list">
              {trip.materials.map((m) => (
                <article key={m.id}>
                  {m.type === "note" ? (
                    <Note size={25} />
                  ) : m.type === "ticket" ? (
                    <CalendarBlank size={25} />
                  ) : (
                    <LinkIcon size={25} />
                  )}
                  <div>
                    <span className="small-label">
                      {m.type === "note"
                        ? "Заметка"
                        : m.type === "ticket"
                          ? "Ссылка на билет"
                          : "Ссылка"}
                    </span>
                    <h3>{m.title}</h3>
                    {m.text && <p>{m.text}</p>}
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        Открыть ссылку <ArrowUpRight size={17} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Материалы будут здесь"
              text="Добавьте ссылку на билет, статью о городе или заметку с адресом встречи."
            >
              <Button onClick={() => setMaterial(true)}>
                <Plus size={18} />
                Добавить первый материал
              </Button>
            </EmptyState>
          )}
        </>
      )}
      <Dialog
        title="Добавить материал"
        open={material}
        onOpenChange={setMaterial}
      >
        <form onSubmit={saveMaterial} className="stack">
          <Input label="Название" name="title" maxLength={100} required />
          <label className="field">
            <span>Тип</span>
            <select name="type">
              <option value="note">Заметка</option>
              <option value="link">Полезная ссылка</option>
              <option value="ticket">Ссылка на билет</option>
            </select>
          </label>
          <Input
            label="Ссылка, если есть"
            name="url"
            type="url"
            placeholder="https://"
          />
          <Textarea label="Заметка" name="text" rows={3} maxLength={3000} />
          <Button type="submit" disabled={busy}>
            Сохранить материал
          </Button>
        </form>
      </Dialog>
      <Dialog title="Ваше место" open={place} onOpenChange={setPlace}>
        <form className="stack" onSubmit={savePlace}>
          <Input
            name="name"
            label="Название или адрес"
            maxLength={100}
            required
          />
          <Textarea
            name="note"
            label="Что хочется сделать"
            rows={3}
            maxLength={1000}
          />
          <Button type="submit" disabled={busy}>
            Сохранить место
          </Button>
        </form>
      </Dialog>
      <Dialog title="Переоткрыть выбор?" open={reopen} onOpenChange={setReopen}>
        <p>
          Предыдущее решение останется в истории. Все активные участники заново
          выберут сценарии и отели. Приглашённые после выбора смогут голосовать.
        </p>
        <Button
          disabled={busy}
          onClick={async () => {
            if (await command({ type: "reopen" })) {
              setReopen(false);
              router.push(root + "/chat");
            }
          }}
        >
          Переоткрыть подбор
        </Button>
      </Dialog>
    </>
  );
}
