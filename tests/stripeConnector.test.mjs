import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadStripeConnectorModule() {
  const sourcePath = resolve(process.cwd(), "convex", "stripeConnector.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-stripe-connector-"));
  const outputPath = join(outputDir, "stripeConnector.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const stripe = await loadStripeConnectorModule();

test("stripe sync prepares queryable Library items and facts without raw API details", () => {
  const prepared = stripe.prepareStripeSync({
    syncedAt: 2000,
    dataset: {
      customers: [
        {
          id: "cus_123",
          name: "Acme Labs",
          email: "BILLING@ACME.example",
          created: 1700000000,
          delinquent: false,
        },
      ],
      products: [
        {
          id: "prod_123",
          name: "FounderOS Pro",
          active: true,
          description: "Workspace plan. Debug URL https://api.stripe.com/v1/products Bearer sk_live_secret",
          created: 1700000100,
        },
      ],
      prices: [
        {
          id: "price_123",
          active: true,
          currency: "usd",
          product: "prod_123",
          recurring: { interval: "month", interval_count: 1 },
          unit_amount: 4900,
        },
      ],
      invoices: [
        {
          id: "in_123",
          number: "FOS-0001",
          customer: "cus_123",
          status: "paid",
          paid: true,
          amount_due: 4900,
          amount_paid: 4900,
          currency: "usd",
          created: 1700000200,
        },
      ],
      subscriptions: [
        {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          items: {
            data: [
              {
                price: {
                  id: "price_123",
                  currency: "usd",
                  recurring: { interval: "month", interval_count: 1 },
                  unit_amount: 4900,
                },
                quantity: 2,
              },
            ],
          },
        },
      ],
      balanceTransactions: [
        {
          id: "txn_123",
          amount: 4900,
          fee: 172,
          net: 4728,
          currency: "usd",
          status: "available",
          type: "charge",
        },
      ],
    },
  });

  assert.equal(prepared.summary.counts.customers, 1);
  assert.equal(prepared.summary.counts.items, 6);
  assert.equal(prepared.items.some((item) => item.externalType === "revenue_summary"), true);
  assert.equal(prepared.facts.some((fact) => fact.predicate === "billing email"), true);
  assert.equal(prepared.facts.some((fact) => fact.predicate === "paid invoice total"), true);
  assert.equal(prepared.summary.safeSummary.includes("$49.00"), true);
  assert.equal(prepared.summary.safeSummary.includes("$98.00"), true);

  const serialized = JSON.stringify(prepared);
  assert.equal(serialized.includes("api.stripe.com"), false);
  assert.equal(serialized.includes("sk_live"), false);
  assert.equal(serialized.includes("Bearer"), false);
});

test("stripe fetch uses read-only list calls with cursor pagination", async () => {
  const calls = [];
  const fetchFn = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    assert.equal(url.origin, "https://api.stripe.com");
    assert.equal(init.method, "GET");
    assert.equal(init.headers.Authorization, "Bearer rk_test_readonly_123");

    if (url.pathname === "/v1/customers" && !url.searchParams.has("starting_after")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "cus_1", name: "First" }], has_more: true }),
      };
    }
    if (url.pathname === "/v1/customers" && url.searchParams.get("starting_after") === "cus_1") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "cus_2", name: "Second" }], has_more: false }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [], has_more: false }),
    };
  };

  const dataset = await stripe.fetchStripeReadOnlyDataset({
    apiKey: "rk_test_readonly_123",
    fetchFn,
    pageLimit: 2,
    pageSize: 1,
    now: 3000,
  });

  assert.deepEqual(dataset.customers.map((customer) => customer.id), ["cus_1", "cus_2"]);
  assert.equal(dataset.syncedAt, 3000);
  assert.equal(calls.some((call) => call.url.pathname === "/v1/prices" && call.url.searchParams.get("active") === "true"), true);
  assert.equal(calls.some((call) => call.url.pathname === "/v1/prices" && call.url.searchParams.get("active") === "false"), true);
  assert.equal(calls.every((call) => call.init.method === "GET"), true);
});

test("stripe fetch rejects broad secret credentials", async () => {
  await assert.rejects(
    stripe.fetchStripeReadOnlyDataset({
      apiKey: "sk_live_broad_secret",
      fetchFn: async () => {
        throw new Error("fetch should not run");
      },
    }),
    /read-only Stripe connection/,
  );
});
