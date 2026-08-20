import { describe, expect, it } from "vitest";

import {
  AUTHENTICATED_HOME_PATH,
  PWA_LAUNCH_PARAM,
  PWA_LAUNCH_VALUE,
  PWA_START_URL,
  isPwaLaunch,
} from "@/lib/navigation/entry";
import manifest from "@/app/manifest";

describe("authenticated entry", () => {
  it("points authenticated visitors at the app home", () => {
    expect(AUTHENTICATED_HOME_PATH).toBe("/app");
  });
});

describe("PWA start behaviour", () => {
  it("does not cold-start the installed app on the marketing page", () => {
    const { start_url: startUrl } = manifest();

    // `/` alone was the defect: an installed app opened on marketing even for
    // a signed-in user. The launch marker makes `/` resolve to the app home
    // server-side while leaving the unauthenticated flow intact.
    expect(startUrl).not.toBe("/");
    expect(startUrl).toBe(PWA_START_URL);
    expect(startUrl).toContain(`${PWA_LAUNCH_PARAM}=${PWA_LAUNCH_VALUE}`);
  });

  it("starts inside the app scope so the install identity stays stable", () => {
    const result = manifest();

    expect(result.scope).toBe("/");
    expect(result.id).toBe("/");
    expect(result.display).toBe("standalone");
    // The start_url must be within scope, or the launch escapes the installed
    // window into a browser tab.
    expect(result.start_url ?? "").toMatch(
      new RegExp(`^${result.scope ?? "/"}`),
    );
  });

  it("detects an installed-app launch from search params", () => {
    expect(isPwaLaunch({ [PWA_LAUNCH_PARAM]: PWA_LAUNCH_VALUE })).toBe(true);
    expect(isPwaLaunch({ [PWA_LAUNCH_PARAM]: [PWA_LAUNCH_VALUE] })).toBe(true);
  });

  it("does not treat ordinary browser visits as installed launches", () => {
    expect(isPwaLaunch(undefined)).toBe(false);
    expect(isPwaLaunch({})).toBe(false);
    expect(isPwaLaunch({ [PWA_LAUNCH_PARAM]: "email" })).toBe(false);
    expect(isPwaLaunch({ utm_source: PWA_LAUNCH_VALUE })).toBe(false);
  });
});
