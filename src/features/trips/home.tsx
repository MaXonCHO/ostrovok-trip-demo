"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Heart,
  Users,
  Check,
  ArrowLeft,
  Plus,
  Sun,
  WaveSine,
  ChatCircleText,
} from "@phosphor-icons/react";
import { Photo } from "@/components/ui/photo";
import { Reveal } from "@/components/ui/reveal";
import { ActionLink } from "@/components/ui/primitives";
interface Recent {
  id: string;
  title: string;
  stage: string;
  isDemo: boolean;
}
const moods = [
  {
    id: "sea",
    title: "Море без спешки",
    text: "Солёный воздух, пляж и завтрак подольше.",
    image: "/demo/coast.jpg",
    interest: "Хочу жить у моря и встречать закаты",
    icon: WaveSine,
  },
  {
    id: "city",
    title: "Город на вкус",
    text: "Красивые улицы и ужин, который запомнится.",
    image: "/demo/city.jpg",
    interest: "Хочу гулять по городу и пробовать итальянскую кухню",
    icon: ChatCircleText,
  },
  {
    id: "quiet",
    title: "Побыть в тишине",
    text: "Зелень, хороший сон и никаких будильников.",
    image: "/demo/nature.jpg",
    interest: "Хочу тишину, природу и неспешные прогулки",
    icon: Sun,
  },
];
export function Home() {
  const router = useRouter();
  const [recent, setRecent] = useState<Recent[]>([]);
  const [city, setCity] = useState("sochi");
  const [group, setGroup] = useState(false);
  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then((d) => setRecent(d.trips ?? []))
      .catch(() => {});
  }, []);
  const start = (prompt?: string) =>
    router.push(
      "/trips/new?city=" +
        city +
        "&group=" +
        (group ? "1" : "0") +
        (prompt ? "&wish=" + encodeURIComponent(prompt) : ""),
    );
  return (
    <div className="landing">
      <section className="voyage-hero">
        <div className="hero-heading">
          <span className="hero-kicker">
            <span />
            Поездка, в которой всё по-вашему
          </span>
          <h1>
            Вам хочется отдыхать.
            <br />
            <span>Отель найдётся.</span>
          </h1>
          <p>
            Расскажите, как хотите провести эти дни.
            <br />
            Выберите свой сценарий, и мы найдём, где остановиться.
          </p>
        </div>
        <div className="voyage-scene">
          <Photo
            src="/demo/real/hero.jpg"
            alt="Настоящий отель на побережье Сочи"
            fetchPriority="high"
          />
          <div className="scene-shade" />
          <div className="scene-location">
            <MapPin size={16} />
            Сочи, Чёрное море
          </div>
          <div className="scene-quote">
            Хорошо, когда
            <br />
            всё сложилось.
          </div>
          <div className="hero-swipe-preview">
            <div className="preview-top">
              <span>Ваша следующая поездка</span>
              <Heart size={18} weight="fill" />
            </div>
            <Photo src="/demo/city.jpg" alt="Морской вокзал Сочи на закате" />
            <div className="preview-copy">
              <span>
                <MapPin size={12} />
                Прогулочный центр
              </span>
              <strong>
                Сначала кофе.
                <br />
                Потом куда глаза глядят.
              </strong>
              <div>
                <span>Гулять</span>
                <span>Пробовать</span>
                <span>Открывать</span>
              </div>
            </div>
            <div className="preview-gesture">
              <ArrowLeft size={16} />
              <span>Не моё</span>
              <span>Хочу так</span>
              <Heart size={16} weight="fill" />
            </div>
          </div>
        </div>
        <form
          className="trip-launcher"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <label>
            <MapPin size={20} />
            <span>
              <small>Куда отправимся?</small>
              <select
                aria-label="Город для поездки"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="sochi">Сочи</option>
                <option value="">Пока не знаю</option>
              </select>
            </span>
          </label>
          <button
            type="button"
            className="launcher-company"
            aria-pressed={group}
            onClick={() => setGroup(!group)}
          >
            <Users size={21} />
            <span>
              <small>С кем?</small>
              <strong>
                {group ? "Вместе со спутником" : "Пока планирую один"}
              </strong>
            </span>
            <Plus size={16} />
          </button>
          <button className="launcher-go" type="submit">
            Найти мой отдых <ArrowUpRight size={22} />
          </button>
        </form>
        <div className="hero-under">
          <span>
            <Check size={15} />
            Без регистрации и длинной анкеты
          </span>
          <Link href="/demo">
            Попробовать на примере <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      {recent.length > 0 && (
        <section className="landing-recent">
          <div>
            <h2>Ваши поездки уже ждут</h2>
            <span>Продолжите с того места, где остановились.</span>
          </div>
          <div>
            {recent
              .slice(-2)
              .reverse()
              .map((t) => (
                <Link href={`/trips/${t.id}`} key={t.id}>
                  <span>
                    <MapPin size={20} />
                    {t.title}
                  </span>
                  <ArrowUpRight size={20} />
                </Link>
              ))}
          </div>
        </section>
      )}
      <section className="mood-section" id="inspiration">
        <Reveal className="landing-section-title">
          <span>Начнём с ощущения</span>
          <h2>
            Как вам хочется
            <br />
            провести эти дни?
          </h2>
          <p>
            У каждого свой хороший отдых. Найдите тот, который хочется прожить.
          </p>
        </Reveal>
        <div className="mood-editorial">
          {moods.map((m, i) => (
            <Reveal key={m.id} delay={i * 0.06}>
              <button
                onClick={() => start(m.interest)}
                className={`mood-tile mood-${m.id}`}
              >
                <Photo src={m.image} alt={m.title} />
                <div className="mood-shade" />
                <span className="mood-symbol">
                  <m.icon size={23} />
                </span>
                <div className="mood-copy">
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                </div>
                <span className="mood-arrow">
                  <ArrowUpRight size={24} />
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="how-section" id="how">
        <Reveal className="how-photo">
          <Photo
            src="/demo/real/pullman-1.jpg"
            alt="Реальная фотография отеля Pullman Сочи Центр"
          />
          <div className="mini-match">
            <span>
              <Heart size={20} weight="fill" />
            </span>
            <div>
              <strong>Этот вариант нравится вам обоим</strong>
              <small>Можно переходить к планам.</small>
            </div>
          </div>
        </Reveal>
        <Reveal className="how-copy">
          <span className="hero-kicker">
            Меньше вкладок. Больше предвкушения.
          </span>
          <h2>
            Вы выбираете
            <br />
            впечатления.
            <br />
            Мы связываем детали.
          </h2>
          <div className="how-steps">
            <div>
              <span>01</span>
              <div>
                <h3>Расскажите о своих планах</h3>
                <p>
                  Паста в маленьком бистро? Море каждое утро? Помощник соберёт
                  ваши пожелания.
                </p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>Поймайте своё «хочу так»</h3>
                <p>
                  Смахивайте сценарии по одному. Затем выбирайте из отелей,
                  которые подходят под ваш отдых.
                </p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>Оставьте приятные заботы</h3>
                <p>Общий выбор, места и план поездки останутся под рукой.</p>
              </div>
            </div>
          </div>
          <button className="landing-text-cta" onClick={() => start()}>
            Хочу попробовать <ArrowUpRight size={22} />
          </button>
        </Reveal>
      </section>
      <section className="together-section">
        <Reveal>
          <span className="hero-kicker">
            <Users size={17} />
            Вместе, без бесконечных «ну реши ты»
          </span>
          <h2>
            Вы разные.
            <br />
            Поездка общая.
          </h2>
          <p>
            Отправьте ссылку спутнику. Каждый расскажет о своём, а в общий
            список попадёт то, что нравится всем.
          </p>
          <ActionLink href="/trips/new?group=1">
            Спланировать вместе <ArrowRight size={19} />
          </ActionLink>
        </Reveal>
        <div className="together-collage">
          <Photo
            src="/demo/real/together.jpg"
            alt="Реальная территория отеля в Сочи"
          />
          <div className="wish-note note-one">
            <span className="note-avatar">А</span>
            <span>
              Мне бы море рядом
              <WaveSine size={19} />
            </span>
          </div>
          <div className="wish-note note-two">
            <span className="note-avatar second">С</span>
            <span>
              А мне, красивые прогулки
              <MapPin size={18} />
            </span>
          </div>
          <div className="shared-note">
            <Check size={17} />
            Найдём то, что объединяет
          </div>
        </div>
      </section>
      <section className="last-invitation">
        <span>Где начнётся ваша следующая история?</span>
        <h2>
          Давайте ближе
          <br />к отпуску.
        </h2>
        <button onClick={() => start()}>
          Начать мою поездку <ArrowUpRight size={24} />
        </button>
        <small>
          Прототип: реальные отели и фото, демонстрационные цены и маршруты.
        </small>
      </section>
    </div>
  );
}
