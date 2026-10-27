"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChatCircleText,
  MapTrifold,
  Buildings,
  Checks,
  ArrowLeft,
  Users,
  Check,
} from "@phosphor-icons/react";
import { useTrip } from "./context";
import {
  Skeleton,
  ErrorNotice,
  Avatar,
  Button,
} from "@/components/ui/primitives";
import { TripSummary, Participants } from "@/features/collaboration/summary";
export function TripLayout({ children }: { children: React.ReactNode }) {
  const { trip, error, load, notice, setNotice, setPersona, persona } =
    useTrip();
  const pathname = usePathname();
  if (!trip)
    return (
      <div className="page-width">
        {error ? <ErrorNotice message={error} onRetry={load} /> : <Skeleton />}
      </div>
    );
  const root = `/trips/${trip.id}`;
  const links = [
    { href: "/chat", label: "Пожелания", icon: ChatCircleText },
    { href: "/scenarios", label: "Сценарии", icon: MapTrifold },
    { href: "/hotels", label: "Отели", icon: Buildings },
    { href: "/matches", label: "Общий выбор", icon: Checks },
  ];
  const isWorkspace = pathname === root;
  const isChoice =
    pathname === root + "/scenarios" || pathname === root + "/hotels";
  return (
    <div className={`page-width trip-page ${isChoice ? "choice-page" : ""}`}>
      <div className="trip-topline">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} />
          Мои поездки
        </Link>
        <div className="trip-top-people">
          <div className="avatar-stack">
            {trip.participants
              .filter((p) => p.status !== "left")
              .map((p, i) => (
                <Avatar name={p.name} index={i} key={p.id} />
              ))}
          </div>
          <span>
            {trip.participants.filter((p) => p.status !== "left").length}{" "}
            {trip.group ? "в поездке" : "путешественник"}
          </span>
        </div>
      </div>
      <div className="trip-title">
        <Link href={root}>{trip.title}</Link>
        <span>
          {trip.nights} ночи · {trip.rooms} номер{trip.rooms > 1 ? "а" : ""}
          {trip.dates
            ? ` · ${trip.dates.start} - ${trip.dates.end}`
            : " · даты пока открыты"}
        </span>
      </div>
      {trip.isDemo && (
        <div className="demo-personas">
          <Users size={18} />
          <span>Демонстрация участников</span>
          <select
            aria-label="Демонстрация участников"
            value={persona || trip.organizerId}
            onChange={(e) => setPersona(e.target.value)}
          >
            {trip.participants
              .filter((p) => p.status !== "left")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === trip.me.id ? " (вы)" : ""}
                </option>
              ))}
          </select>
          <span className="muted">Только в этой демо-сцене</span>
        </div>
      )}
      <nav className="stage-nav" aria-label="Этапы выбора">
        {links.map((l, i) => {
          const active = pathname.startsWith(root + l.href);
          const done =
            (i === 0 && trip.scenarios.length > 0) ||
            (i === 1 && trip.candidates.length > 0) ||
            !!trip.selected;
          return (
            <Link
              key={l.href}
              href={root + l.href}
              className={active ? "active" : ""}
              aria-current={active ? "step" : undefined}
            >
              <span className={`stage-icon ${done ? "done" : ""}`}>
                {done && !active ? <Check size={19} /> : <l.icon size={20} />}
              </span>
              <span>{l.label}</span>
              <span className="stage-number">{i + 1}</span>
            </Link>
          );
        })}
      </nav>
      {trip.lastChange && <div className="notice">{trip.lastChange}</div>}
      {error && <ErrorNotice message={error} onRetry={load} />}
      <div
        className={
          isWorkspace
            ? "workspace-body"
            : isChoice
              ? "choice-body"
              : "trip-body"
        }
      >
        {!isWorkspace && !isChoice && (
          <aside className="trip-sidebar">
            <TripSummary />
            <div className="desktop-participants">
              <Participants />
            </div>
            <details className="mobile-participants">
              <summary>Участники и приглашение</summary>
              <Participants />
            </details>
          </aside>
        )}
        <section className="trip-content">{children}</section>
      </div>
      {isChoice && (
        <details className="choice-context">
          <summary>
            Пожелания и участники{" "}
            <span>
              {trip.participants.filter((p) => p.status !== "left").length} в
              поездке
            </span>
          </summary>
          <div>
            <TripSummary />
            <Participants />
          </div>
        </details>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={20} />
          {notice}
          <Button variant="ghost" onClick={() => setNotice("")}>
            Закрыть
          </Button>
        </div>
      )}
    </div>
  );
}
