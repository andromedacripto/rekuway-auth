import { buildServer } from "./server.js";
import { loadEnv } from "@rekuway/config";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer(env);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Rekuway Auth API listening on port ${port}`);
}

main().catch((err: unknown) => {
  console.error("Fatal startup error:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
