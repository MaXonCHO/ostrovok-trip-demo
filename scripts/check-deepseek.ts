import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { DeepSeekAgentProvider } from "../src/data/adapters/deepseek-agent";
import { participant } from "../src/application/trips";
import type { Trip } from "../src/domain/models";
async function check() {
  const me = participant("smoke", "Тест", true);
  const trip = {
    cityId: "sochi",
    cityConfirmed: true,
    nights: 4,
    rooms: 1,
    organizerId: me.id,
    participants: [me],
  } as Trip;
  const agent = new DeepSeekAgentProvider();
  const results = [];
  for (const text of [
    "Хочу жить у моря, обязательно тихо ночью. Бюджет не больше 8000 рублей за номер за ночь. Люблю итальянскую кухню.",
    "Море больше не интересует. Бюджет теперь 6000 рублей за номер за ночь. Тишина по-прежнему обязательна.",
  ]) {
    me.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      text,
      createdAt: new Date().toISOString(),
    });
    const start = Date.now();
    const reply = await agent.reply({ trip, participantId: me.id, text });
    for (const u of reply.updates) {
      const old = me.preferences.find((p) => p.key === u.key);
      if (old) Object.assign(old, u);
      else
        me.preferences.push({
          ...u,
          id: crypto.randomUUID(),
          participantId: me.id,
          updatedAt: new Date().toISOString(),
        });
    }
    me.messages.push({
      id: crypto.randomUUID(),
      role: "agent",
      text: reply.text,
      createdAt: new Date().toISOString(),
    });
    assert.equal(
      me.preferences.find((p) => p.key === "budget")?.value,
      results.length ? 6000 : 8000,
    );
    assert.equal(
      me.preferences.find((p) => p.key === "budgetBasis")?.value,
      "room_night",
    );
    assert.equal(
      me.preferences.find((p) => p.key === "interest:sea")?.value,
      results.length ? false : true,
    );
    assert.equal(
      me.preferences.find((p) => p.key === "interest:quiet")?.importance,
      "required",
    );
    results.push({
      input: text,
      reply: reply.text,
      updates: reply.updates,
      ms: Date.now() - start,
    });
  }
  const report = {
    at: new Date().toISOString(),
    provider: "deepseek",
    model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
    passed: true,
    results,
  };
  await writeFile(
    "docs/verification-deepseek.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
void check().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? "DeepSeek semantic assertion failed"
      : error.message,
  );
  process.exitCode = 1;
});
