"use client";
import { Photo } from "@/components/ui/photo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  User,
  Users,
  ArrowsSplit,
  MapTrifold,
} from "@phosphor-icons/react";
import {
  Button,
  SectionHeading,
  ErrorNotice,
} from "@/components/ui/primitives";
export function Demo() {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function start(kind: string) {
    setPending(kind);
    setError("");
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(`/trips/${d.id}/${d.route}`);
    } catch (e) {
      setError((e as Error).message);
      setPending("");
    }
  }
  const scenes = [
    {
      id: "solo",
      icon: User,
      title: "Выбрать для себя",
      text: "Собранный контекст, три сценария и колода отелей. Пройдите от выбора до сохранённой поездки.",
      image: "coast",
    },
    {
      id: "group",
      icon: Users,
      title: "Найти общее вдвоём",
      text: "Артём и Саша уже выбрали сценарии. Сравните общие отели и подтвердите один от лица каждого.",
      image: "city",
    },
    {
      id: "conflict",
      icon: ArrowsSplit,
      title: "Договориться о разном",
      text: "Участники предпочли разные сценарии. Посмотрите расхождение и измените собственный выбор.",
      image: "nature",
    },
    {
      id: "geo",
      icon: MapTrifold,
      title: "Близко не всегда пешком",
      text: "По прямой пляж рядом. Уточнение пути обнаруживает обход и меняет рекомендацию.",
      image: "sea",
    },
  ];
  return (
    <div className="page-width demo-page">
      <SectionHeading
        title="Одна поездка. Разные истории выбора."
        text="Готовые сцены для показа. Каждая создаёт отдельную поездку и сохраняет ваши действия."
      />
      {error && <ErrorNotice message={error} />}
      <div className="demo-grid">
        {scenes.map((s) => (
          <article key={s.id}>
            <Photo
              src={`/demo/${s.image}.jpg`}
              alt="Иллюстрация демонстрационного сценария"
            />
            <div>
              <s.icon size={26} />
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <Button disabled={!!pending} onClick={() => start(s.id)}>
                {pending === s.id ? "Готовим сцену…" : "Открыть сцену"}
                <ArrowRight size={20} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      <p className="notice">
        В групповых демо есть явный переключатель участников. В настоящей
        поездке каждый входит по приглашению со своей сессией. Новая сцена не
        удаляет существующие поездки.
      </p>
    </div>
  );
}
