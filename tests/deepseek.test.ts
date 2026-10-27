import test from "node:test";
import assert from "node:assert/strict";
import { DeepSeekAgentProvider } from "../src/data/adapters/deepseek-agent";
import { participant } from "../src/application/trips";
import type { Trip } from "../src/domain/models";
const input = () => {
  const me = participant("me", "Артём", true),
    other = participant("other", "Саша");
  me.messages.push({
    id: "u1",
    role: "user",
    text: "Хочу море",
    createdAt: "2026-10-27",
  });
  other.messages.push({
    id: "private",
    role: "user",
    text: "PRIVATE_OTHER_MESSAGE",
    createdAt: "2026-10-27",
  });
  return {
    trip: {
      cityId: "sochi",
      cityConfirmed: true,
      nights: 4,
      rooms: 1,
      organizerId: "me",
      participants: [me, other],
      inviteToken: "PRIVATE_INVITE",
      processedCommands: ["PRIVATE_COMMAND"],
    } as Trip,
    participantId: "me",
    text: "Хочу море",
  };
};
const output = (updates: unknown[] = []) => ({
  text: "Записал пожелания. Посмотрим сценарии?",
  updates,
  cityId: null,
});
const success = (reply: unknown) =>
  new Response(
    JSON.stringify({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(reply) } },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
const provider = (request: typeof fetch) =>
  new DeepSeekAgentProvider({
    apiKey: "test-secret",
    model: "deepseek-flash",
    fetchImpl: request,
  });

test("DeepSeek sends personal history once and excludes private companion chats and tokens", async () => {
  let body = "";
  const agent = provider(async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-secret",
    );
    body = String(init?.body);
    return success(
      output([
        {
          key: "interest:sea",
          value: true,
          importance: "preferred",
          priority: 0.7,
        },
      ]),
    );
  });
  const reply = await agent.reply(input());
  const sent = JSON.parse(body);
  assert.deepEqual(sent.response_format, { type: "json_object" });
  assert.equal(
    sent.messages.filter(
      (m: { role: string; content: string }) =>
        m.role === "user" && m.content === "Хочу море",
    ).length,
    1,
  );
  assert.ok(!body.includes("PRIVATE_OTHER_MESSAGE"));
  assert.ok(!body.includes("PRIVATE_INVITE"));
  assert.ok(!body.includes("PRIVATE_COMMAND"));
  assert.equal(reply.updates[0].key, "interest:sea");
  assert.ok(!("cityId" in reply));
});
test("DeepSeek cannot silently soften an existing required preference", async () => {
  const i = input();
  i.trip.participants[0].preferences = [
    {
      id: "p",
      participantId: "me",
      key: "interest:quiet",
      value: true,
      importance: "required",
      priority: 1,
      updatedAt: "2026-10-27",
    },
  ];
  const agent = provider(async () =>
    success(
      output([
        {
          key: "interest:quiet",
          value: true,
          importance: "preferred",
          priority: 0.7,
        },
      ]),
    ),
  );
  assert.equal((await agent.reply(i)).updates[0].importance, "required");
  i.text = "Тишина не обязательна";
  i.trip.participants[0].messages.push({
    id: "u2",
    role: "user",
    text: i.text,
    createdAt: "2026-10-27",
  });
  const relaxed = provider(async () =>
    success(
      output([
        {
          key: "interest:quiet",
          value: true,
          importance: "preferred",
          priority: 0.7,
          relaxationQuote: i.text,
        },
      ]),
    ),
  );
  assert.equal((await relaxed.reply(i)).updates[0].importance, "preferred");
});
test("Malformed structured values are retried once and never applied", async () => {
  for (const update of [
    { key: "budget", value: "5000", importance: "required", priority: 1 },
    {
      key: "interest:sea",
      value: "true",
      importance: "preferred",
      priority: 0.7,
    },
    { key: "maxWalk", value: 1000, importance: "preferred", priority: 0.7 },
    {
      key: "budget",
      value: 8000,
      importance: "required",
      priority: 1,
    },
    {
      key: "selectedHotel",
      value: "h1",
      importance: "preferred",
      priority: 0.7,
    },
  ]) {
    let calls = 0;
    const i = input();
    const original = JSON.stringify(i.trip);
    const agent = provider(async () => {
      calls++;
      return success(output([update]));
    });
    await assert.rejects(agent.reply(i), /неполный ответ/);
    assert.equal(calls, 2);
    assert.equal(JSON.stringify(i.trip), original);
  }
});
test("Incomplete or empty completions cannot masquerade as successful replies", async () => {
  for (const response of [
    {
      choices: [{ finish_reason: "length", message: { content: '{"text":' } }],
    },
    { choices: [{ finish_reason: "stop", message: { content: "" } }] },
  ]) {
    let calls = 0;
    const agent = provider(async () => {
      calls++;
      return new Response(JSON.stringify(response));
    });
    await assert.rejects(agent.reply(input()), /неполный ответ/);
    assert.equal(calls, 2);
  }
});
test("Transient upstream failures recover once; auth and balance failures do not retry or expose bodies", async () => {
  let calls = 0;
  const recovered = provider(async () =>
    ++calls === 1
      ? new Response("private provider error", { status: 503 })
      : success(output()),
  );
  assert.ok((await recovered.reply(input())).text);
  assert.equal(calls, 2);
  for (const status of [401, 402, 403]) {
    let attempts = 0;
    const agent = provider(async () => {
      attempts++;
      return new Response("test-secret PRIVATE_BODY", { status });
    });
    await assert.rejects(
      agent.reply(input()),
      (e: Error) =>
        !e.message.includes("test-secret") &&
        !e.message.includes("PRIVATE_BODY"),
    );
    assert.equal(attempts, 1);
  }
});
test("Network timeouts stay explicit and never fall back to the mock agent", async () => {
  let calls = 0;
  const agent = provider(async () => {
    calls++;
    throw new DOMException("private network detail", "TimeoutError");
  });
  await assert.rejects(agent.reply(input()), /не ответил вовремя/);
  assert.equal(calls, 2);
});
