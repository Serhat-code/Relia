import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }];
const exclude = ["node_modules/**", ".next/**", ".next-dev/**"];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "logique",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        // La config PostCSS de Next (Tailwind) n'est pas lisible par Vite, et inutile aux tests.
        css: { postcss: { plugins: [] } },
        test: {
          name: "composants",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          exclude,
          setupFiles: ["./tests/setup-dom.ts"],
        },
      },
    ],
  },
});
