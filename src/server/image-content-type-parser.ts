import type { FastifyInstance } from "fastify";

import { MAX_IMAGE_ASSET_BYTES } from "../database/image-input.ts";

export function registerImageContentTypeParser(server: FastifyInstance): void {
  server.addContentTypeParser(
    ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/octet-stream"],
    { parseAs: "buffer", bodyLimit: MAX_IMAGE_ASSET_BYTES },
    (_request, body, done) => done(null, body),
  );
}
