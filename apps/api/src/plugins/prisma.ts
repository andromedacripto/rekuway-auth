import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient({
    // Never log query params — they can contain PII / tokens depending on
    // the query. Only log errors and warnings.
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

  prisma.$on("error", (event: { message: string }) => {
    app.log.error({ msg: event.message }, "prisma error");
  });
  prisma.$on("warn", (event: { message: string }) => {
    app.log.warn({ msg: event.message }, "prisma warning");
  });

  await prisma.$connect();

  app.decorate("prisma", prisma);

  app.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
});
