import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const appDir = join(process.cwd(), "src", "app");
const routeFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry === "page.tsx" || entry === "route.ts") {
      routeFiles.push(fullPath);
    }
  }
}

function toRoute(file) {
  const parts = relative(appDir, file).split(sep);
  const leaf = parts.pop();
  const routeParts = parts
    .filter((part) => !part.startsWith("(") || !part.endsWith(")"))
    .map((part) => part.replace(/^\[(.+)\]$/, ":$1"));
  const route = `/${routeParts.join("/")}`.replace(/\/+/g, "/");
  return leaf === "route.ts" ? `${route === "/" ? "" : route} [route]` : route;
}

function classify(route) {
  const path = route.replace(" [route]", "") || "/";
  if (path.startsWith("/preview")) return "PREVIEW_DISABLED";
  if (path.startsWith("/admin")) return "ADMIN_ONLY";
  if (
    path.includes("/messages/:conversationId") ||
    path.includes("/deals/:dealId")
  ) {
    return "PARTICIPANT_ONLY";
  }
  if (path.includes("/profile/edit") || path.includes("/profile/setup")) {
    return "OWNER_ONLY";
  }
  if (path === "/app/opportunities" || path === "/opportunities") {
    return "OWNER_ONLY";
  }
  if (path === "/opportunities/new") {
    return "AUTHENTICATED";
  }
  if (
    [
      "/app/reviews",
      "/reviews",
    ].includes(path)
  ) {
    return "COMING_LATER";
  }
  if (
    path.startsWith("/app") ||
    [
      "/dashboard",
      "/deals",
      "/escrow",
      "/logistics",
      "/market",
      "/messages",
      "/network",
      "/notifications",
      "/profile/edit",
      "/profile/setup",
      "/proposals/received",
      "/proposals/sent",
      "/real-estate",
      "/reports",
      "/reviews",
      "/roles",
      "/saved",
      "/service-center",
      "/services",
      "/settings",
      "/settings/security",
      "/travel-stay",
      "/wallet",
    ].includes(path)
  ) {
    return "AUTHENTICATED";
  }
  return "PUBLIC";
}

walk(appDir);

console.log("| Route | Classification | Source |");
console.log("| --- | --- | --- |");
for (const file of routeFiles.sort()) {
  const route = toRoute(file);
  console.log(`| \`${route}\` | ${classify(route)} | \`${relative(process.cwd(), file)}\` |`);
}
