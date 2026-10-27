import type { Interest } from "@/domain/models";
export const interestLabels: Record<Interest, string> = {
  food: "Местная еда",
  italian: "Итальянская кухня",
  sights: "Архитектура и достопримечательности",
  sea: "Море",
  quiet: "Тишина",
  walks: "Прогулки",
  nature: "Природа",
};
export const lexicon: Record<Interest, RegExp> = {
  food: /ед[аыу]|ресторан|кафе|кухн|гастро|завтрак|ужин/i,
  italian: /итал|паст[ауы]|пицц/i,
  sights: /достоприм|архитект|музе|стар[ыо].{0,5}город|истори|выстав/i,
  sea: /мор[еяю]|пляж|купат|побереж/i,
  quiet: /тишин|тих|спокой|шум/i,
  walks: /гуля|прогул|пешк|ходить/i,
  nature: /природ|зел[её]н|парк|лес|гор[ыау]/i,
};
export const cities = [
  {
    id: "sochi",
    name: "Сочи",
    description: "Море, прогулки и зелёные кварталы",
    image: "coast",
  },
  {
    id: "spb",
    name: "Санкт-Петербург",
    description: "Каналы, архитектура и маленькие бистро",
    image: "city",
  },
  {
    id: "kazan",
    name: "Казань",
    description: "Старый город и прогулки у воды",
    image: "city",
  },
];
