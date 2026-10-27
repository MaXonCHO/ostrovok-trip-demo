"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, Info } from "@phosphor-icons/react";
import { Dialog } from "./primitives";
export function Shell({ children }: { children: React.ReactNode }) {
  const home = usePathname() === "/";
  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <header className={`app-header ${home ? "landing-header" : ""}`}>
        <div className="header-inner">
          <Link
            href="/"
            className="wordmark"
            aria-label="Островок! Моя поездка"
          >
            островок<span>!</span>
          </Link>
          <span className="product-name">Моя поездка</span>
          <nav className="header-links" aria-label="Главная навигация">
            <Link href="/#how">Как это работает</Link>
            <Link href="/#inspiration">Найти вдохновение</Link>
          </nav>
          <nav className="header-actions">
            <Dialog
              title="О прототипе"
              trigger={
                <button className="demo-label">
                  <Info size={15} />
                  Демо
                </button>
              }
            >
              <p>
                Реальные отели и фотографии из их официальных галерей. Цены,
                маршруты и логика рекомендаций пока демонстрационные.
              </p>
              <p>
                Можно пройти весь путь и сохранить выбор. Реальное бронирование
                появится после подключения каталога команды.
              </p>
              <Link href="/demo" className="text-link">
                Готовые сцены <ArrowUpRight size={16} />
              </Link>
            </Dialog>
            <Link href="/trips/new" className="header-start">
              Создать поездку <ArrowRight size={17} />
            </Link>
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="app-footer">
        <Link href="/" className="footer-brand">
          островок!
        </Link>
        <span>Моя поездка · концепт для хакатона</span>
        <div>
          <Link href="/demo">Посмотреть демо</Link>
          <Link href="/host/demo">
            Для отельеров <ArrowUpRight size={14} />
          </Link>
        </div>
      </footer>
    </>
  );
}
