import { buildServer } from "./app.js";

const server = buildServer({ logger: true });
const port = Number(process.env.HUMAN2AI_PORT ?? 4179);

await server.listen({ host: "127.0.0.1", port });
