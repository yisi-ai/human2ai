import type { Config } from "tailwindcss";

export default { content: ["./app/**/*.{ts,tsx}", "../design-system/surfaces/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] } satisfies Config;
