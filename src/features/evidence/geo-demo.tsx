"use client";
import { Photo } from "@/components/ui/photo";
import { useState } from "react";
import { ArrowRight, Warning, Check, Footprints } from "@phosphor-icons/react";
import { useTrip } from "@/features/trips/context";
import { SectionHeading, Button, ActionLink } from "@/components/ui/primitives";
export function GeoDemo() {
  const { trip } = useTrip();
  const [after, setAfter] = useState(false);
  if (!trip) return null;
  return (
    <>
      <SectionHeading
        title="До моря близко. Но каким путём?"
        text="История о том, как новое знание меняет выбор проживания. Это подготовленная демонстрация."
      />
      <div className="geo-story">
        <div className="geo-visual">
          <Photo src="/demo/coast.jpg" alt="Иллюстративный берег моря" />
          <div className="geo-statement">
            <span>Отель А · Бриз на набережной</span>
            <strong>{after ? "1,9 км" : "420 м"}</strong>
            <span>{after ? "пешком с обходом" : "по прямой до пляжа"}</span>
          </div>
        </div>
        <div className="geo-explanation">
          <span className="small-label">
            {after ? "После уточнения пути" : "Первое впечатление"}
          </span>
          <h2>{after ? "Обход меняет обычный день" : "Кажется, море рядом"}</h2>
          <p>
            {after
              ? "Прямого прохода нет. Чтобы попасть на пляж, нужно обойти препятствие. Ежедневная прогулка займёт больше времени, чем ожидалось."
              : "Расстояние по прямой ещё не говорит, удобно ли ходить на пляж. Важно знать, где есть проход."}
          </p>
          {after ? (
            <>
              <div className="notice">
                <Warning size={22} />
                <span>
                  420 м по прямой → 1,9 км по маршруту → около 27 минут пешком.
                </span>
              </div>
              <div className="geo-alternative">
                <Check size={22} />
                <div>
                  <h3>Отель Б лучше для частых прогулок к морю</h3>
                  <p>
                    850 м по маршруту, около 12 минут. Дополнительное знание
                    подняло его в рекомендации.
                  </p>
                </div>
              </div>
            </>
          ) : null}
          <Button onClick={() => setAfter(!after)}>
            {after
              ? "Показать исходное впечатление"
              : "Показать уточнение маршрута"}
            <ArrowRight size={19} />
          </Button>
          <p className="data-caption">
            Числа и выводы синтетические. Переключатель показывает готовую
            историю, внешнего запроса не выполняет.
          </p>
        </div>
      </div>
      <div className="notice">
        <Footprints size={22} />
        <span>
          Для финальной сдачи команда должна подключить настоящий георасчёт. В
          прототипе подготовлен отдельный GeoProvider и контракт.
        </span>
      </div>
      <ActionLink href={`/trips/${trip.id}/hotels`} variant="secondary">
        Вернуться к отелям <ArrowRight size={18} />
      </ActionLink>
    </>
  );
}
