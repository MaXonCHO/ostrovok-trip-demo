import Link from "next/link";
import type { CSSProperties } from "react";

const linkGroups = [
  {
    title: "Компания",
    links: [
      [
        "Компания и команда",
        "https://career.ostrovok.ru/?utm_source=footer_header",
      ],
      ["Контакты", "https://ostrovok.ru/about/contacts/"],
      [
        "Вакансии",
        "https://career.ostrovok.ru/vacancy/?utm_source=main_page_footer",
      ],
      ["Для прессы", "https://ostrovok.ru/about/press/"],
    ],
  },
  {
    title: "Клиентам",
    links: [
      ["База знаний", "https://help.ostrovok.ru/ru"],
      ["Служба поддержки", "https://ostrovok.ru/feedback/"],
      ["Блог о путешествиях", "https://blog.ostrovok.ru/?ref=footer"],
      ["Популярные направления", "https://ostrovok.ru/hotel/"],
      ["Юридическая информация", "https://ostrovok.ru/about/legal/"],
      [
        "Правила бронирования",
        "https://ostrovok.ru/legal/order/agreement/bg/524/",
      ],
      [
        "Пользовательское соглашение сервиса Ostrovok.ru",
        "https://ostrovok.ru/legal/site/service-terms/",
      ],
      ["Программа лояльности GURU", "https://ostrovok.ru/about/guru/"],
      ["Подарочные сертификаты", "https://ostrovok.ru/journey/certificates/"],
    ],
  },
  {
    title: "Партнёрам",
    links: [
      [
        "Объектам размещения",
        "https://extranet.ostrovok.ru/?utm_medium=link&utm_source=ostrovok&utm_campaign=signup&utm_content=partnership",
      ],
      ["Турагентствам", "https://b2b.ostrovok.ru/"],
      [
        "Корпоративным клиентам",
        "https://b2b.ostrovok.ru/travel/corp_product/",
      ],
      ["Поиск отелей на вашем сайте", "https://b2b.ostrovok.ru/"],
      ["Рекламодателям", "https://ostrovok.ru/adv/"],
      ["Реклама и PR", "https://ostrovok.ru/adv/"],
      ["Партнерская программа", "https://ostrovok.ru/affiliate/"],
    ],
  },
];

const stores = [
  {
    name: "App Store",
    image: "app-store.svg",
    href: "https://apps.apple.com/us/app/ostrovok-book-a-hotel/id564204730",
  },
  {
    name: "Google Play",
    image: "google-play.svg",
    href: "https://play.google.com/store/apps/details?id=ru.ostrovok.android",
  },
  {
    name: "AppGallery",
    image: "app-gallery.svg",
    href: "https://appgallery.huawei.com/#/app/C102822437",
  },
];

const socials = [
  { name: "MAX", image: "social-max.svg", href: "https://max.ru/ostrovok" },
  {
    name: "Telegram",
    image: "social-telegram.svg",
    href: "https://t.me/ostrovok_travel",
  },
  {
    name: "Дзен",
    image: "social-dzen.svg",
    href: "https://dzen.ru/blog_ostrovok_ru",
  },
  {
    name: "ВКонтакте",
    image: "social-vk.svg",
    href: "https://vk.com/ostrovok_ru",
  },
  {
    name: "Одноклассники",
    image: "social-ok.svg",
    href: "https://ok.ru/ostrovok.ru/",
  },
];

const paymentSystems = [
  { name: "Visa Secure", image: "payment-visa-secure.svg", width: 39 },
  { name: "Mastercard", image: "payment-mastercard.svg", width: 51 },
  { name: "МИР", image: "payment-mir.svg", width: 65 },
  { name: "thawte", image: "payment-thawte.svg", width: 75 },
  { name: "PCI DSS", image: "payment-pci-dss.svg", width: 81 },
];

export function StorefrontFooter() {
  return (
    <footer className="ov-storefront-footer">
      <div className="ov-storefront-footer-inner">
        <div className="ov-storefront-footer-main">
          <div className="ov-storefront-footer-about">
            <Link
              href="/"
              className="ov-storefront-footer-logo"
              aria-label="Островок — главная"
            >
              <img
                src="/ostrovok/footer/logo.svg"
                width="137"
                height="42"
                alt="Островок"
              />
            </Link>
            <div
              className="ov-storefront-footer-apps"
              aria-label="Мобильное приложение Островок"
            >
              {stores.map((store) => (
                <a
                  key={store.name}
                  href={store.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Скачать Островок в ${store.name}`}
                >
                  <img
                    src={`/ostrovok/footer/${store.image}`}
                    width="130"
                    height="40"
                    alt=""
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
          <div className="ov-storefront-footer-links">
            {linkGroups.map((group) => (
              <nav
                className="ov-storefront-footer-group"
                aria-label={group.title}
                key={group.title}
              >
                <h2>{group.title}</h2>
                <ul>
                  {group.links.map(([text, href]) => (
                    <li key={text}>
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <nav
            className="ov-storefront-footer-socials"
            aria-label="Островок в социальных сетях"
          >
            {socials.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Островок в ${social.name}`}
              >
                <img
                  src={`/ostrovok/footer/${social.image}`}
                  width="20"
                  height="20"
                  alt=""
                  loading="lazy"
                />
              </a>
            ))}
          </nav>
        </div>
        <div className="ov-storefront-footer-bottom">
          <section
            className="ov-storefront-footer-security"
            aria-label="Безопасность платежей"
          >
            <div>
              <h2>Безопасность платежей</h2>
              <p>Надёжная защита данных от ведущих платёжных систем.</p>
            </div>
            <div className="ov-storefront-footer-payments">
              {paymentSystems.map((system) => (
                <img
                  key={system.name}
                  src={`/ostrovok/footer/${system.image}`}
                  width={system.width}
                  style={
                    {
                      "--ov-payment-width": `${system.width}px`,
                    } as CSSProperties
                  }
                  height="50"
                  alt={system.name}
                  loading="lazy"
                />
              ))}
            </div>
          </section>
          <div className="ov-storefront-footer-legal">
            <a
              href="https://ostrovok.ru/legal/site/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Политика хранения и обработки персональных данных
            </a>
            <a
              href="https://ostrovok.ru/legal/site/recommendation_technologies/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Применяются рекомендательные технологии
            </a>
          </div>
          <p className="ov-storefront-footer-company">
            ООО &quot;Бронирование Гостиниц&quot; <span>•</span> ОГРН:
            1157746695644 <span>•</span> ИНН: 7703389880 <span>•</span> Написать
            нам: <a href="mailto:hi@ostrovok.ru">hi@ostrovok.ru</a>
          </p>
          <details className="ov-storefront-footer-seo">
            <summary>
              Бронирование отелей и гостиниц
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m3.5 5.25 3.5 3.5 3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <div>
              <p>
                На Островке можно найти отели, гостиницы, хостелы и апартаменты
                для путешествий по России и другим странам. Сравните варианты
                размещения, фотографии и условия проживания, чтобы выбрать
                подходящий отель для своей поездки.
              </p>
              <p>
                Полный каталог и актуальные условия бронирования доступны на{" "}
                <a
                  href="https://ostrovok.ru/hotel/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  официальном сайте Островка
                </a>
                .
              </p>
            </div>
          </details>
        </div>
      </div>
    </footer>
  );
}
