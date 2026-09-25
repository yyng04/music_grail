import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/music_grail/",
  plugins: [react()],
  test: {
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
  },
});
