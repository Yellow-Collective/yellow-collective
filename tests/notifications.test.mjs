import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const moduleCache = new Map();

const resolveTsPath = (specifier, parentFile) => {
  if (specifier.startsWith("@/")) {
    return resolve(root, `${specifier.slice(2)}.ts`);
  }
  if (specifier.startsWith("data/") || specifier.startsWith("constants/")) {
    return resolve(root, `${specifier}.ts`);
  }
  if (specifier.startsWith(".")) {
    return resolve(dirname(parentFile), `${specifier}.ts`);
  }
  return null;
};

const loadTsModule = (path, mocks = {}) => {
  const filename = resolve(root, path);
  const useCache = Object.keys(mocks).length === 0;
  if (useCache && moduleCache.has(filename)) {
    return moduleCache.get(filename).exports;
  }

  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  if (useCache) moduleCache.set(filename, module);

  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(mocks, specifier)) {
      return mocks[specifier];
    }
    const tsPath = resolveTsPath(specifier, filename);
    return tsPath ? loadTsModule(tsPath, mocks) : require(specifier);
  };

  vm.runInNewContext(output, {
    require: localRequire,
    module,
    exports: module.exports,
    console,
    process,
    Buffer,
    Date,
    URL,
    crypto,
    fetch,
  });

  return module.exports;
};

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("mini app manifest includes Neynar webhookUrl on the miniapp config", () => {
  const manifest = JSON.parse(read("public/.well-known/farcaster.json"));
  assert.match(
    manifest.miniapp.webhookUrl,
    /^https:\/\/api\.neynar\.com\/f\/app\/c6ba551a-2844-41d9-8b0b-fe3011e3b212\/event$/
  );
  assert.equal(manifest.miniapp.canonicalDomain, "yellowcollective.art");
});

test("admin permissions include notifications", () => {
  const permissions = loadTsModule("utils/admin-permissions.ts");
  assert.equal(permissions.isAdminPermission("notifications"), true);
  assert.equal(
    permissions.ADMIN_PERMISSION_DEFINITIONS.some(
      (permission) => permission.id === "notifications"
    ),
    true
  );
});

test("notification settings sanitize unknown keys and validate rendered copy length", () => {
  const settings = loadTsModule("utils/notifications/settings.ts");
  const sanitized = settings.normalizeNotificationSettings({
    enabled: true,
    dryRun: false,
    pollIntervalHours: 4,
    alerts: {
      round_published: {
        enabled: false,
        titleTemplate: "Round: {roundTitle}",
        bodyTemplate: "Submit to {roundTitle}",
      },
      unknown_key: {
        enabled: true,
        titleTemplate: "Bad",
        bodyTemplate: "Bad",
      },
    },
  });

  assert.equal(sanitized.alerts.round_published.enabled, false);
  assert.equal(sanitized.alerts.unknown_key, undefined);
  assert.equal(sanitized.alerts.auction_started.enabled, true);
  assert.equal(sanitized.pollIntervalHours, 4);
  assert.equal(
    settings.normalizeNotificationSettings({ pollIntervalHours: 3 })
      .pollIntervalHours,
    settings.DEFAULT_NOTIFICATION_SETTINGS.pollIntervalHours
  );
  assert.equal(
    JSON.stringify(settings.NOTIFICATION_POLL_INTERVAL_HOUR_OPTIONS),
    JSON.stringify([1, 2, 4, 12, 24])
  );

  assert.equal(
    JSON.stringify(settings.validateNotificationCopy({
      title: "A".repeat(33),
      body: "ok",
      targetUrl: "https://yellowcollective.art/rounds",
    })),
    JSON.stringify(["Notification title must be 32 characters or fewer."])
  );
  assert.equal(
    JSON.stringify(settings.validateNotificationCopy({
      title: "ok",
      body: "B".repeat(129),
      targetUrl: "https://yellowcollective.art/rounds",
    })),
    JSON.stringify(["Notification body must be 128 characters or fewer."])
  );
});

test("notification sender rejects non-canonical target URLs", async () => {
  const sender = loadTsModule("utils/notifications/neynar.ts");
  assert.throws(
    () => sender.normalizeNotificationTargetUrl("https://www.yellowcollective.art/rounds"),
    /yellowcollective\.art/
  );
  assert.equal(
    sender.normalizeNotificationTargetUrl("/rounds/demo"),
    "https://yellowcollective.art/rounds/demo"
  );
});

test("disabled alert settings prevent send attempts", async () => {
  const service = loadTsModule("utils/notifications/service.ts", {
    "data/notifications": {
      getNotificationEvent: async () => null,
      upsertNotificationEventAttempt: async () => undefined,
      markNotificationEventSent: async () => undefined,
    },
  });

  let attempted = false;
  const result = await service.sendConfiguredNotification({
    eventType: "round_published",
    sourceId: "round-1",
    targetPath: "/rounds/demo",
    variables: { roundTitle: "Demo Round" },
    settings: {
      enabled: true,
      dryRun: false,
      alerts: {
        ...service.DEFAULT_NOTIFICATION_SETTINGS.alerts,
        round_published: {
          ...service.DEFAULT_NOTIFICATION_SETTINGS.alerts.round_published,
          enabled: false,
        },
      },
    },
    send: async () => {
      attempted = true;
    },
  });

  assert.equal(result.status, "disabled");
  assert.equal(attempted, false);
});

test("notification send attempts persist explicit target FIDs for the admin log", async () => {
  const attempts = [];
  const service = loadTsModule("utils/notifications/service.ts", {
    "data/notifications": {
      getNotificationEvent: async () => null,
      upsertNotificationEventAttempt: async (input) => attempts.push(input),
      markNotificationEventSent: async () => undefined,
    },
  });

  await service.sendConfiguredNotification({
    eventType: "round_published",
    sourceId: "round-2",
    targetPath: "/rounds/demo",
    variables: { roundTitle: "Demo Round" },
    settings: service.DEFAULT_NOTIFICATION_SETTINGS,
    targetFids: [13870],
    dryRun: true,
  });

  assert.equal(JSON.stringify(attempts[0].targetFids), JSON.stringify([13870]));
});

test("notification token sync fetches Neynar audience without exposing token secrets", async () => {
  const originalApiKey = process.env.NEYNAR_API_KEY;
  process.env.NEYNAR_API_KEY = "test-key";
  const requestedUrls = [];
  const sender = loadTsModule("utils/notifications/neynar.ts", {
    "@/utils/notifications/settings": loadTsModule(
      "utils/notifications/settings.ts"
    ),
    "@/utils/site": loadTsModule("utils/site.ts"),
  });

  const result = await sender.fetchNeynarNotificationTokens({
    fetchImpl: async (url, init) => {
      requestedUrls.push(String(url));
      assert.equal(init.headers["x-api-key"], "test-key");
      return {
        ok: true,
        json: async () => ({
          next: { cursor: requestedUrls.length === 1 ? "next-page" : null },
          notification_tokens: [
            {
              fid: requestedUrls.length === 1 ? 13870 : 42,
              token: "secret-token",
              url: "https://client.example/notify",
              created_at: "2026-06-01T00:00:00Z",
              updated_at: "2026-06-02T00:00:00Z",
            },
          ],
        }),
      };
    },
  });

  process.env.NEYNAR_API_KEY = originalApiKey;

  assert.equal(requestedUrls.length, 2);
  assert.equal(JSON.stringify(result.map((token) => token.fid)), "[13870,42]");
  assert.equal(Object.prototype.hasOwnProperty.call(result[0], "token"), false);
});

test("notification poll cadence is controlled by admin settings", () => {
  const poll = read("utils/notifications/poll.ts");
  assert.match(poll, /shouldRunNotificationPoll/);
  assert.match(poll, /getLastNotificationPollAt/);
  assert.match(poll, /setLastNotificationPollAt/);
  assert.match(poll, /pollIntervalHours/);
  assert.match(poll, /status: "skipped"/);

  const route = read("pages/api/notifications/poll.ts");
  assert.match(route, /force: req\.query\.force === "true"/);

  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /Poll every/);
  assert.match(dashboard, /NOTIFICATION_POLL_INTERVAL_HOUR_OPTIONS/);
});

test("notification test send preflights Neynar tokens before a real send", () => {
  const endpoint = read("pages/api/notifications/test.ts");
  assert.match(endpoint, /fetchNeynarNotificationTokens/);
  assert.match(endpoint, /fetchNeynarNotificationTokens\(\{\s*fids: targetFids\s*\}\)/s);
  assert.match(endpoint, /missingFids/);
  assert.match(endpoint, /NoNotificationTokens/);
  assert.match(endpoint, /status\(422\)/);
});

test("audience sync clears stale token fields and reports zero-token syncs clearly", () => {
  const data = read("data/notifications.ts");
  assert.match(data, /notification_url = null/);
  assert.match(data, /notification_token_created_at = null/);
  assert.match(data, /notification_token_updated_at = null/);
  assert.match(data, /last_synced_at = now\(\)/);

  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /Neynar returned 0 enabled notification tokens/);
  assert.match(dashboard, /no Neynar token/i);
});

test("admin dashboard exposes a notification log with recipient limitations", () => {
  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /<NotificationLogPanel/);
  assert.match(dashboard, /list of who received targeted notifications/i);
  assert.match(dashboard, /Broadcast recipient lists[\s\S]*are not returned by Neynar/i);
});

test("admin dashboard renders the notification log at the bottom of the notifications tab", () => {
  const dashboard = read("pages/admin/dashboard.tsx");
  const audienceIndex = dashboard.indexOf("<NotificationAudiencePanel");
  const testFidIndex = dashboard.indexOf("Test FID");
  const logIndex = dashboard.indexOf("<NotificationLogPanel");

  assert.ok(audienceIndex >= 0, "notification audience panel should render");
  assert.ok(testFidIndex >= 0, "notification test send block should render");
  assert.ok(logIndex >= 0, "notification log panel should render");
  assert.ok(
    logIndex > audienceIndex && logIndex > testFidIndex,
    "notification log should render after audience sync and test-send controls"
  );
});

test("admin dashboard exposes Mini App audience sync", () => {
  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /<NotificationAudiencePanel/);
  assert.match(dashboard, /Sync Neynar audience/);
  assert.match(dashboard, /notification tokens[\s\S]*not stored or shown/i);
});

test("admin notification lists are capped to five visible rows", () => {
  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /notificationLogScrollClass = "max-h-\[35rem\] overflow-y-auto/);
  assert.match(dashboard, /notificationAudienceScrollClass = "max-h-\[30rem\] overflow-y-auto/);
  assert.match(dashboard, /className="h-24 bg-\[#fff7bf\] align-top"/);
  assert.match(dashboard, /className="h-20 bg-\[#fff7bf\] align-top"/);
});

test("Mini App notification prompt persists a user response", () => {
  const prompt = read("components/MiniApp/MiniAppNotificationsPrompt.tsx");
  assert.match(prompt, /MINIAPP_NOTIFICATIONS_PROMPT_STORAGE_PREFIX/);
  assert.match(prompt, /localStorage\.getItem/);
  assert.match(prompt, /localStorage\.setItem/);
  assert.match(prompt, /markPromptResponded/);
  assert.match(prompt, /context\?\.user\?\.fid/);
});

test("Mini App passive saves do not downgrade synced notification status", () => {
  const endpoint = read("pages/api/miniapp/users.ts");
  assert.doesNotMatch(endpoint, /Boolean\(req\.body\?\.notificationsEnabled\)/);
  assert.match(
    endpoint,
    /typeof req\.body\?\.notificationsEnabled === "boolean"/
  );

  const data = read("data/notifications.ts");
  assert.match(
    data,
    /COALESCE\(\$6::boolean, miniapp_users\.notifications_enabled\)/
  );
  assert.doesNotMatch(data, /Boolean\(input\.notificationsEnabled\)/);
});

test("Mini App prompt treats notification details as optional context", () => {
  const prompt = read("components/MiniApp/MiniAppNotificationsPrompt.tsx");
  assert.match(prompt, /getNotificationDetails/);
  assert.match(prompt, /context\?\.client\?\.notificationDetails/);
  assert.doesNotMatch(prompt, /Boolean\(context\?\.notificationDetails\)/);
  assert.match(prompt, /notificationsEnabled: notificationDetails \? true : undefined/);
});

test("notification test sends use an admin-scoped endpoint", () => {
  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /"\/api\/admin\/notifications\/test"/);

  const endpoint = read("pages/api/admin/notifications/test.ts");
  assert.match(endpoint, /pages\/api\/notifications\/test/);
});

test("Vercel cron is configured for the authenticated notification poll route", () => {
  const vercelConfig = JSON.parse(read("vercel.json"));
  assert.deepEqual(vercelConfig.crons, [
    {
      path: "/api/notifications/poll",
      schedule: "0 * * * *",
    },
  ]);

  const pollRoute = read("pages/api/notifications/poll.ts");
  assert.match(pollRoute, /req\.method !== "GET"/);
  assert.match(pollRoute, /req\.method !== "POST"/);
  assert.match(pollRoute, /Authorization.*Bearer|hasNotificationCronAuth/s);
});

for (const { name, run } of tests) {
  await run();
  console.log(`ok - ${name}`);
}
