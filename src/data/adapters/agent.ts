import type { AgentProvider, AgentInput, AgentReply } from "@/data/contracts";
import { lexicon, interestLabels } from "@/data/fixtures/lexicon";
export class MockAgentProvider implements AgentProvider {
  async reply({ trip, participantId, text }: AgentInput): Promise<AgentReply> {
    const me = trip.participants.find((p) => p.id === participantId)!;
    const updates: AgentReply["updates"] = [];
    const add = (key: string, value: unknown, required = false) => {
      const previous = me.preferences.find((p) => p.key === key);
      const explicitlySoft =
        /необязатель|не обязатель|было бы хорошо|не принципиально/i.test(text);
      const importance = explicitlySoft
        ? "preferred"
        : required || previous?.importance === "required"
          ? "required"
          : "preferred";
      updates.push({
        key,
        value,
        importance,
        priority: importance === "required" ? 1 : 0.7,
      });
    };
    for (const [interest, pattern] of Object.entries(lexicon))
      if (pattern.test(text)) {
        const neg = new RegExp(
          `(?:не\\s+(?:хочу|нужн[аоы]?|интересу[ею]т)|без)\\s+[^.!?,]{0,12}(?:${pattern.source})`,
          "i",
        );
        const isNegative = neg.test(text) && interest !== "quiet";
        const removeQuiet =
          interest === "quiet" &&
          /тишина не|тишин[аы].{0,8}не (важ|нуж)|шум не (меш|важ)/i.test(text);
        add(
          "interest:" + interest,
          !isNegative && !removeQuiet,
          /обязатель|важно|непременно|только/.test(text),
        );
      }
    const budget = text.match(
      /(?:бюджет|до|не больше|не более|около)\s*(\d[\d\s]*(?:[.,]\d+)?)\s*(тыс|к|₽|руб)?/i,
    );
    if (budget && /бюджет|руб|₽|тыс|за ночь|проживан/i.test(text)) {
      let value = Number(budget[1].replace(/\s/g, "").replace(",", "."));
      if (budget[2] && /тыс|к/.test(budget[2])) value *= 1000;
      if (value > 0) {
        add("budget", value, /не больше|не более|до |обязатель/.test(text));
        add(
          "budgetBasis",
          /вс[её] прожив|всю поезд|за вс[её]/i.test(text)
            ? "stay"
            : "room_night",
        );
      }
    }
    const walking = text.match(
      /(?:ходить|пешком|прогулк[аиу]|до моря|до ресторан)[^.!?]{0,30}?(\d+)\s*мин/i,
    );
    if (walking)
      add(
        "maxWalk",
        Number(walking[1]),
        /не более|не больше|максимум|обязатель/.test(text),
      );
    const cityId = /сочи/i.test(text)
      ? "sochi"
      : /петербург|питер/i.test(text)
        ? "spb"
        : /казан/i.test(text)
          ? "kazan"
          : undefined;
    const keys = new Map(me.preferences.map((p) => [p.key, p.value]));
    updates.forEach((u) => keys.set(u.key, u.value));
    const interests = Object.keys(interestLabels).filter(
      (k) => keys.get("interest:" + k) === true,
    );
    let reply = updates.length
      ? `Записал: ${
          updates
            .filter((u) => u.key.startsWith("interest:") && u.value === true)
            .map(
              (u) =>
                interestLabels[u.key.slice(9) as keyof typeof interestLabels],
            )
            .join(", ") || "обновлённые ограничения"
        }. `
      : "";
    if (/не знаю|неважно|без предпочт|не определ|пока не/.test(text))
      reply = "Можно начать с примеров и выбрать по ощущениям. ";
    if (!trip.cityConfirmed && !cityId)
      reply +=
        "В каком городе хочется провести поездку? Можно выбрать направление ниже.";
    else if (!keys.has("budget"))
      reply +=
        "Какой бюджет на номер за ночь вам комфортен? Если пока не решили, можно сразу посмотреть сценарии.";
    else if (!keys.has("maxWalk"))
      reply +=
        "Сколько минут готовы идти пешком за один раз? Или уже посмотрим сценарии?";
    else
      reply +=
        "Контекст собран. Посмотрите сценарии и отметьте все, которые вам близки.";
    if (
      !updates.length &&
      interests.length === 0 &&
      !/не знаю|неважно|без предпочт|пока не|привет/i.test(text)
    )
      reply =
        "В этом демо я понимаю пожелания про еду, море, архитектуру, природу, тишину и прогулки. Опишите что-то из этого или начните с готовых сценариев.";
    return { text: reply, updates, cityId };
  }
}
