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
    /^https:\/\/api\.neynar\.com\/f\/app\/[^/]+\/event$/
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

test("admin dashboard exposes a notification log with recipient limitations", () => {
  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /<NotificationLogPanel/);
  assert.match(dashboard, /list of who received targeted notifications/i);
  assert.match(dashboard, /Broadcast recipient lists[\s\S]*are not returned by Neynar/i);
});

test("admin dashboard exposes Mini App audience sync", () => {
  const dashboard = read("pages/admin/dashboard.tsx");
  assert.match(dashboard, /<NotificationAudiencePanel/);
  assert.match(dashboard, /Sync Neynar audience/);
  assert.match(dashboard, /notification tokens[\s\S]*not stored or shown/i);
});

test("Vercel cron is configured for the authenticated notification poll route", () => {
  const vercelConfig = JSON.parse(read("vercel.json"));
  assert.deepEqual(vercelConfig.crons, [
    {
      path: "/api/notifications/poll",
      schedule: "0 14 * * *",
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
