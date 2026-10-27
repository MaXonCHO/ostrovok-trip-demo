"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-width empty-state">
      <h1>Не получилось открыть страницу</h1>
      <p>
        Ваши сохранённые поездки останутся на сервере. Попробуйте открыть
        страницу ещё раз.
      </p>
      <button className="button primary" onClick={reset}>
        Повторить
      </button>
    </div>
  );
}
