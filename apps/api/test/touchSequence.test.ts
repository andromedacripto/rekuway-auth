import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { saveTouchSequence, checkTouchSequence } from "../src/lib/touchSequence.js";

const prisma = new PrismaClient();

describe("Touch sequence (3-Touch UX layer)", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "touchtest+" } } });
    await prisma.$disconnect();
  });

  it("stores only a bcrypt hash, never the plaintext sequence", async () => {
    const user = await prisma.user.create({ data: { email: "touchtest+1@example.com" } });
    await saveTouchSequence(prisma, user.id, ["circle", "square", "triangle"]);

    const record = await prisma.touchSequence.findUnique({ where: { userId: user.id } });
    expect(record?.sequenceHash).toBeDefined();
    expect(record?.sequenceHash).not.toContain("circle");
    expect(record?.sequenceHash).not.toContain("square");
  });

  it("verifies a correct sequence and rejects an incorrect one", async () => {
    const user = await prisma.user.create({ data: { email: "touchtest+2@example.com" } });
    await saveTouchSequence(prisma, user.id, ["star", "cross", "diamond"]);

    const correct = await checkTouchSequence(prisma, user.id, ["star", "cross", "diamond"]);
    expect(correct).toBe(true);

    const wrongOrder = await checkTouchSequence(prisma, user.id, ["cross", "star", "diamond"]);
    expect(wrongOrder).toBe(false);

    const wrongSymbols = await checkTouchSequence(prisma, user.id, ["circle", "square", "triangle"]);
    expect(wrongSymbols).toBe(false);
  });

  it("returns false for a user with no enrolled sequence", async () => {
    const user = await prisma.user.create({ data: { email: "touchtest+3@example.com" } });
    const result = await checkTouchSequence(prisma, user.id, ["circle", "square", "triangle"]);
    expect(result).toBe(false);
  });
});
