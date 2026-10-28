import test from "node:test";
import assert from "node:assert/strict";
import { plannerAgent } from "../src/server/planner-agent";
import { rankHotels } from "../src/server/recommendations";
import { emptyExpectations } from "../src/features/planner/types";
import { emptyTripChatProfile } from "../src/features/ostrovok/trip-chat-contract";
import { HttpError } from "../src/server/http";

process.env.DATABASE_PATH = ":memory:";
const profile = emptyTripChatProfile();
const expectations = emptyExpectations();
const selection = rankHotels(profile, expectations);
const messages = [
  { role: "user" as const, content: "Петербург, до 10 000 рублей за ночь" },
];
const payload = {
  message: "На какие даты планируете поездку?",
  profile: { ...profile, city: "saint-petersburg", budgetMax: 10000 },
  suggestions: ["Даты пока не выбраны"],
  criteriaUpdates: [],
  purpose: null,
  shoppingDetail: null,
  brandNames: [],
};
const plain = (content: string, finish_reason = "stop") => ({
  choices: [{ finish_reason, message: { content } }],
});
const tool = (
  argumentsValue = JSON.stringify(payload),
  name = "submit_planner_reply",
) => ({
  choices: [
    {
      finish_reason: "tool_calls",
      message: {
        content: null,
        tool_calls: [
          { type: "function", function: { name, arguments: argumentsValue } },
        ],
      },
    },
  ],
});
async function mocked(
  responses: unknown[],
  check: (bodies: Record<string, unknown>[]) => Promise<void>,
) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const bodies: Record<string, unknown>[] = [];
  process.env.DEEPSEEK_API_KEY = "test-only-not-a-real-credential";
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    assert.ok(bodies.length <= responses.length, "Unexpected provider retry");
    const response = responses[bodies.length - 1];
    return response instanceof Response ? response : Response.json(response);
  };
  try {
    await check(bodies);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  }
}

test("planner uses database evidence and accepts complete JSON without retry", async () => {
  await mocked([plain(JSON.stringify(payload))], async (bodies) => {
    const result = await plannerAgent(
      messages,
      profile,
      expectations,
      selection,
    );
    assert.equal(result.reply.profile.budgetMax, 10000);
    assert.equal(bodies.length, 1);
    const sent = bodies[0].messages as { role: string; content: string }[];
    const context = JSON.parse(sent[1].content);
    assert.equal(context.selectionSummary.matching, selection.matchingCount);
    assert.equal(context.catalogEvidence.length, 6);
    assert.equal(
      context.catalogEvidence[0].name,
      selection.results[0].hotel.name,
    );
    assert.equal(context.catalogEvidence[0].price, null);
    assert.deepEqual(
      context.catalogEvidence[0].amenitiesSnapshot,
      selection.results[0].hotel.amenities.slice(0, 24),
    );
    assert.ok(context.catalogEvidence[0].source);
    assert.deepEqual(sent.slice(-messages.length), messages);
  });
});

test("empty, truncated and incomplete planner replies recover using one forced schema call", async () => {
  for (const first of [
    plain("   "),
    plain('{"message":', "length"),
    plain(JSON.stringify({ message: "Уточните даты" })),
  ]) {
    await mocked([first, tool()], async (bodies) => {
      const result = await plannerAgent(
        messages,
        profile,
        expectations,
        selection,
      );
      assert.equal(result.reply.message, payload.message);
      assert.equal(bodies.length, 2);
      assert.deepEqual(bodies[0].response_format, { type: "json_object" });
      assert.equal(bodies[1].response_format, undefined);
      assert.deepEqual(bodies[1].tool_choice, {
        type: "function",
        function: { name: "submit_planner_reply" },
      });
      const tools = bodies[1].tools as {
        function: {
          parameters: { properties: { profile: { required: string[] } } };
        };
      }[];
      assert.ok(
        tools[0].function.parameters.properties.profile.required.includes(
          "budgetFlexible",
        ),
      );
      assert.deepEqual(
        (bodies[1].messages as unknown[]).slice(-messages.length),
        messages,
      );
    });
  }
});

test("a complete fenced or BOM JSON response needs no provider retry", async () => {
  for (const content of [
    "\uFEFF" + JSON.stringify(payload),
    "```json\n" + JSON.stringify(payload) + "\n```",
  ])
    await mocked([plain(content)], async (bodies) => {
      assert.equal(
        (await plannerAgent(messages, profile, expectations, selection)).reply
          .message,
        payload.message,
      );
      assert.equal(bodies.length, 1);
    });
});

test("fallback never executes unknown tools or accepts invented criteria or malformed arguments", async () => {
  for (const second of [
    tool("{}", "run_sql"),
    tool("{"),
    tool(
      JSON.stringify({
        ...payload,
        criteriaUpdates: [
          { key: "invented", value: true, importance: "required" },
        ],
      }),
    ),
    plain(JSON.stringify(payload)),
    {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            tool_calls: [
              ...tool().choices[0].message.tool_calls,
              ...tool().choices[0].message.tool_calls,
            ],
          },
        },
      ],
    },
  ])
    await mocked([plain(""), second], async (bodies) => {
      await assert.rejects(
        () => plannerAgent(messages, profile, expectations, selection),
        (e: unknown) => e instanceof HttpError && e.status === 502,
      );
      assert.equal(bodies.length, 2);
    });
});

test("rejected credentials are not retried and cancellation prevents a second provider call", async () => {
  await mocked(
    [new Response("private provider error", { status: 401 })],
    async (bodies) => {
      await assert.rejects(
        () => plannerAgent(messages, profile, expectations, selection),
        (e: unknown) =>
          e instanceof HttpError &&
          e.status === 503 &&
          !e.message.includes("private"),
      );
      assert.equal(bodies.length, 1);
    },
  );
  const controller = new AbortController();
  controller.abort();
  await mocked([], async (bodies) => {
    await assert.rejects(
      () =>
        plannerAgent(
          messages,
          profile,
          expectations,
          selection,
          controller.signal,
        ),
      (e: unknown) => e instanceof HttpError && e.status === 504,
    );
    assert.equal(bodies.length, 0);
  });
});
