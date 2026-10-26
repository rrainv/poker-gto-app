import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createAccountIdentityRepository,
  createMemoryAccountIdentityDatabase,
} from "../app/src/account-identity/index.mjs";
import { createAccountIdentityService } from "../app/src/application/account-identity-service.mjs";
import { installAuthenticationBridge } from "../app/src/application/authentication-bootstrap.mjs";

const indexHtml = fs.readFileSync(path.resolve("app/index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve("app/styles.css"), "utf8");

test("CLEANUP-PREP-001: index.html does not unconditionally load unbundled Supabase UMD script", () => {
  assert.equal(
    indexHtml.includes("node_modules/@supabase/supabase-js/dist/umd/supabase.js"),
    false,
    "index.html should not unconditionally load the unbundled Supabase UMD script on a fresh checkout"
  );
});

test("CLEANUP-PREP-001: authentication bootstrap only probes Supabase UMD script when auth config is present", async () => {
  const repository = createAccountIdentityRepository({
    database: createMemoryAccountIdentityDatabase(),
  });
  const fakeAccountIdentity = createAccountIdentityService({ repository });

  const appendedScriptsNoConfig = [];
  const fakeWindowNoConfig = {
    RiverlineAccountIdentity: fakeAccountIdentity,
    dispatchEvent: () => {},
    document: {
      readyState: "loading",
      addEventListener: () => {},
      querySelector: () => null,
      head: {
        appendChild(node) {
          appendedScriptsNoConfig.push(node.src);
          node.onerror?.();
        },
      },
      createElement() {
        return {};
      },
    },
  };

  const apiNoConfig = await installAuthenticationBridge(fakeWindowNoConfig, { config: null });
  await apiNoConfig.ready();
  assert.equal(
    appendedScriptsNoConfig.some((src) => String(src).includes("supabase.js")),
    false,
    "Without auth config, Supabase UMD script must not be requested"
  );
  assert.equal(apiNoConfig.getState().noticeCode, "provider_not_configured");

  const appendedScriptsWithConfig = [];
  const fakeWindowWithConfig = {
    RiverlineAccountIdentity: fakeAccountIdentity,
    dispatchEvent: () => {},
    document: {
      readyState: "loading",
      addEventListener: () => {},
      querySelector: () => null,
      head: {
        appendChild(node) {
          appendedScriptsWithConfig.push(node.src);
          node.onerror?.();
        },
      },
      createElement() {
        return {};
      },
    },
  };

  const apiWithConfig = await installAuthenticationBridge(fakeWindowWithConfig, {
    config: {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key-placeholder",
    },
  });
  await apiWithConfig.ready();
  assert.equal(
    appendedScriptsWithConfig.some((src) => String(src).includes("supabase.js")),
    true,
    "With auth config and no existing window.supabase client, Supabase UMD script is requested on demand"
  );
  assert.equal(apiWithConfig.getState().noticeCode, "provider_client_unavailable");
});

test("CLEANUP-PREP-001 F04: <=1100px Hand private-cards rail order is not defeated by a higher-specificity non-setup selector", () => {
  // MERGE-001: the live-stage rule keeps [data-hand-stage] (a Hand without a
  // stage yet keeps the setup order) and excludes the rail-first stages, so it
  // no longer competes with them on specificity. Effective order is asserted
  // in premium_layout001, core_flow001b_hand_stage and design006.
  for (const element of ["playbook-decision-workspace", "playbook-context-rail"]) {
    assert.ok(
      stylesCss.includes(`#gtoMode[data-product-destination="hand"][data-hand-stage]:not([data-hand-stage="setup"], [data-hand-stage="private-cards"], [data-hand-stage="reveal"]) .${element}`),
      `the <=1100px live-stage ${element} rule excludes the private-cards and reveal stages`
    );
  }
});

test("CLEANUP-PREP-001 F06: Analyze dead-card header grid rule matches .playbook-cards-panel .section-head specificity", () => {
  const sectionHeadFlexIdx = stylesCss.indexOf(
    'html[data-layout-preset] #gtoMode[data-product-destination="analyze"] .playbook-cards-panel .section-head'
  );
  const deadCardGridIdx = stylesCss.indexOf(
    'html[data-layout-preset] #gtoMode[data-product-destination="analyze"] .playbook-cards-panel .playbook-dead-card-header'
  );
  assert.ok(sectionHeadFlexIdx > 0, ".playbook-cards-panel .section-head rule exists");
  assert.ok(
    deadCardGridIdx > sectionHeadFlexIdx,
    ".playbook-cards-panel .playbook-dead-card-header grid rule appears after .section-head flex rule with equal specificity"
  );
});
