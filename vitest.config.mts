import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [ react() ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` sólo exporta bajo la condición "react-server" de Next.
      // En Vitest no existe esa condición: se neutraliza para poder testear
      // las funciones puras del BFF. La garantía real la sigue dando el build.
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
