import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function resolveBasePath() {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }

  if (!process.env.GITHUB_ACTIONS) {
    return "/";
  }

  const repoFullName = process.env.GITHUB_REPOSITORY ?? "";
  const repoName = repoFullName.split("/")[1] ?? "";
  if (!repoName) {
    return "/";
  }

  if (repoName.toLowerCase().endsWith(".github.io")) {
    return "/";
  }

  return `/${repoName}/`;
}

export default defineConfig({
  plugins: [react()],
  base: resolveBasePath(),
});
