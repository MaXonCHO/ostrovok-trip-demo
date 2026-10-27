import { z } from "zod";
export const createTripSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    cityId: z.enum(["sochi", "spb", "kazan"]).nullable(),
    group: z.boolean(),
    nights: z.number().int().min(1).max(60),
    rooms: z.number().int().min(1).max(8),
    expectedParticipants: z.number().int().min(1).max(12),
    start: z.iso.date().or(z.literal("")).optional(),
    end: z.iso.date().or(z.literal("")).optional(),
    prompt: z.string().max(3000).optional(),
  })
  .refine((v) => !!v.start === !!v.end, {
    message: "Укажите обе даты или оставьте их открытыми",
    path: ["end"],
  })
  .refine(
    (v) =>
      !v.start ||
      !v.end ||
      (v.end > v.start &&
        (Date.parse(v.end) - Date.parse(v.start)) / 86400000 <= 60),
    {
      message: "Выезд должен быть после заезда, не более 60 ночей",
      path: ["end"],
    },
  );
const context = z.object({
  cityId: z.enum(["sochi", "spb", "kazan"]).optional(),
  nights: z.number().int().min(1).max(60).optional(),
  rooms: z.number().int().min(1).max(8).optional(),
  budget: z.number().positive().max(10000000).nullable().optional(),
  budgetBasis: z.enum(["room_night", "stay"]).optional(),
  maxWalk: z.number().int().min(1).max(180).nullable().optional(),
  required: z.boolean().optional(),
  start: z.iso.date().or(z.literal("")).optional(),
  end: z.iso.date().or(z.literal("")).optional(),
});
export const commandSchema = z.object({
  version: z.number().int().nonnegative(),
  commandId: z.string().uuid(),
  command: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("message"),
      text: z.string().trim().min(1).max(3000),
    }),
    z.object({ type: z.literal("context"), ...context.shape }),
    z.object({
      type: z.literal("preference"),
      id: z.string(),
      importance: z.enum(["required", "preferred"]),
      value: z.boolean().optional(),
    }),
    z.object({ type: z.literal("generateScenarios") }),
    z.object({ type: z.literal("confirmScenarios") }),
    z.object({ type: z.literal("openHotels") }),
    z.object({
      type: z.literal("vote"),
      entityType: z.enum(["scenario", "hotel"]),
      entityId: z.string(),
      decision: z.enum(["liked", "rejected", "unseen"]),
      reason: z
        .object({
          code: z.string().max(30),
          text: z.string().max(300).optional(),
        })
        .optional(),
    }),
    z.object({ type: z.literal("finishHotels") }),
    z.object({ type: z.literal("propose"), hotelId: z.string() }),
    z.object({ type: z.literal("confirmFinal") }),
    z.object({ type: z.literal("reopen") }),
    z.object({ type: z.literal("revokeInvite") }),
    z.object({
      type: z.literal("removeParticipant"),
      participantId: z.string(),
    }),
    z.object({ type: z.literal("leave") }),
    z.object({
      type: z.literal("material"),
      title: z.string().trim().min(1).max(100),
      materialType: z.enum(["link", "note", "ticket"]),
      text: z.string().max(3000).optional(),
      url: z
        .url()
        .refine((s) => /^https?:\/\//.test(s))
        .optional(),
    }),
    z.object({ type: z.literal("savePlace"), placeId: z.string() }),
    z.object({
      type: z.literal("customPlace"),
      name: z.string().trim().min(1).max(100),
      note: z.string().max(1000),
    }),
  ]),
});
export type TripCommand = z.infer<typeof commandSchema>["command"];
