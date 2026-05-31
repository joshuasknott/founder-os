# Stripe Connector Safety Boundary

FounderOS treats Stripe as a read-only finance context source. The connector can sync customers, products, prices, invoices, subscriptions, balance activity, revenue summaries, and derived facts into Library. It must not move money, mutate Stripe records, expose raw request details, or show private credentials in the product UI.

## Allowed Behavior

- Settings may show Stripe as a connected service and let the founder run a read-only sync.
- Sync uses server-side credentials only. The browser never receives a Stripe credential, endpoint URL, request payload, response payload, or permission name.
- Sync calls only Stripe list endpoints with `GET` requests:
  - customers
  - products
  - prices
  - invoices
  - subscriptions
  - balance transactions
- Sync follows Stripe cursor pagination using `limit` and `starting_after`.
- Stored Library items are sanitized summaries, not raw Stripe objects.
- Stored facts are founder-queryable finance facts such as invoice status, amount paid, active subscription count, customer billing email, and estimated monthly recurring revenue.
- Audit history is stored in `connectorActionLogs` with safe summaries only.

## Credential Boundary

The Settings setup flow requires a Stripe restricted key (`rk_test_...` or `rk_live_...`). Broad secret keys (`sk_test_...` or `sk_live_...`) are rejected because they can carry write privileges.

The key is stored through the encrypted connector credential path only. Do not store it in React state, connection settings, Library items, facts, logs, source code, or founder-facing docs.

## Blocked Behavior

These actions are explicitly blocked in `connectorRuntime.ts` for the Stripe connector:

- creating charges
- issuing refunds
- canceling subscriptions
- updating Stripe records
- deleting Stripe records

Approval cannot override these blocked actions. Adding any Stripe write behavior later requires a new policy, a dedicated approval flow, tests that prove the approval gate runs before execution, safe audit summaries, and a separate implementation path from the read-only sync.

## Data Minimization

The sync intentionally omits:

- payment methods, card details, bank account details, mandates, sources, and default payment method fields
- raw Stripe metadata
- hosted invoice URLs and invoice PDFs
- API endpoint URLs
- raw object payloads
- request and response bodies
- credential fingerprints or vault references in Library content

Stripe object IDs may remain in internal metadata and `externalId` fields so repeated syncs can update the same Library records. They should not be rendered as primary founder-facing content.

## Files

- `convex/stripeConnector.ts`: read-only Stripe fetcher and sanitizer.
- `convex/connectorRuntime.ts`: connector registry, allowed sync actions, and blocked write policy.
- `convex/connectors.ts`: Settings-triggered sync action, Library/fact persistence, and safe audit logging.
- `components/settings/connected-services-settings.tsx`: Settings connection card, Stripe sync action, and safe activity history.
- `tests/stripeConnector.test.mjs`: mock Stripe fetch and sanitizer tests.
- `tests/connectorRuntime.test.mjs`: policy tests proving Stripe writes are blocked.

## Stripe References

- Authentication and server-side key handling: https://docs.stripe.com/api/authentication
- Key safety and restricted keys: https://docs.stripe.com/keys-best-practices
- Cursor pagination: https://docs.stripe.com/api/pagination
- List endpoints: https://docs.stripe.com/api/customers/list, https://docs.stripe.com/api/products/list, https://docs.stripe.com/api/prices/list, https://docs.stripe.com/api/invoices/list, https://docs.stripe.com/api/subscriptions/list, https://docs.stripe.com/api/balance_transactions/list
