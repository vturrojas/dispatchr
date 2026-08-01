import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/components/timeline/AttemptedTimeline.tsx",
        "src/components/jobs/JobsTable.tsx",
        "src/hooks/useJobStream.ts",
        "src/hooks/useJobTimeline.ts",
        "src/components/timeline/Timeline.tsx",
        "src/pages/JobDetailPage.tsx",
        "src/hooks/useJobs.ts",
        "src/api/jobs.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
      },
    },
  },
});
