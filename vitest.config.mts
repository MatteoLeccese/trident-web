import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [ react() ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` exports only under Next's "react-server" condition, which
      // does not exist in Vitest. It is neutralised so the BFF's pure functions
      // can be tested; the guarantee itself still comes from the build.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [ "./vitest.setup.ts" ],
    include: [ "src/**/*.test.ts", "src/**/*.test.tsx" ],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: [ "src/domains/**", "src/lib/**" ],
      reporter: [ "text", "html" ],
    },
  },
});
