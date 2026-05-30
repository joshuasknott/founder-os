export type StripeObjectRef = string | { id?: string; name?: string | null } | null | undefined;

export type StripeCustomerRecord = {
  id?: string;
  object?: string;
  name?: string | null;
  email?: string | null;
  created?: number;
  currency?: string | null;
  balance?: number | null;
  delinquent?: boolean | null;
  deleted?: boolean | null;
};

export type StripeProductRecord = {
  id?: string;
  object?: string;
  name?: string | null;
  description?: string | null;
  active?: boolean | null;
  created?: number;
  updated?: number;
  default_price?: StripeObjectRef;
};

export type StripePriceRecord = {
  id?: string;
  object?: string;
  active?: boolean | null;
  billing_scheme?: string | null;
  created?: number;
  currency?: string | null;
  nickname?: string | null;
  product?: StripeObjectRef;
  recurring?: {
    interval?: string | null;
    interval_count?: number | null;
    usage_type?: string | null;
  } | null;
  type?: string | null;
  unit_amount?: number | null;
  unit_amount_decimal?: string | null;
};

export type StripeInvoiceRecord = {
  id?: string;
  object?: string;
  amount_due?: number | null;
  amount_paid?: number | null;
  amount_remaining?: number | null;
  created?: number;
  currency?: string | null;
  customer?: StripeObjectRef;
  due_date?: number | null;
  number?: string | null;
  paid?: boolean | null;
  status?: string | null;
  subscription?: StripeObjectRef;
  total?: number | null;
};

export type StripeSubscriptionItemRecord = {
  id?: string;
  price?: StripePriceRecord | null;
  quantity?: number | null;
};

export type StripeSubscriptionRecord = {
  id?: string;
  object?: string;
  created?: number;
  currency?: string | null;
  current_period_end?: number | null;
  current_period_start?: number | null;
  customer?: StripeObjectRef;
  ended_at?: number | null;
  items?: {
    data?: StripeSubscriptionItemRecord[];
  } | null;
  status?: string | null;
};

export type StripeBalanceTransactionRecord = {
  id?: string;
  object?: string;
  amount?: number | null;
  created?: number;
  currency?: string | null;
  fee?: number | null;
  net?: number | null;
  reporting_category?: string | null;
  status?: string | null;
  type?: string | null;
};

export type StripeSyncDataset = {
  customers?: StripeCustomerRecord[];
  products?: StripeProductRecord[];
  prices?: StripePriceRecord[];
  invoices?: StripeInvoiceRecord[];
  subscriptions?: StripeSubscriptionRecord[];
  balanceTransactions?: StripeBalanceTransactionRecord[];
  syncedAt?: number;
};

export type PreparedStripeItem = {
  externalId: string;
  externalType: string;
  title: string;
  summary: string;
  content: string;
  kind: "record" | "brief";
  format: "markdown";
  tags: string[];
  sourceName: string;
  externalCreatedAt?: number;
  externalUpdatedAt?: number;
};

export type PreparedStripeFact = {
  itemExternalId: string;
  subject: string;
  predicate: string;
  object: string;
  value?: unknown;
  confidence: number;
  status: "observed";
  validFrom?: number;
  metadata: {
    connectorId: "stripe";
    objectType: string;
    externalId?: string;
    syncedAt: number;
  };
};

export type PreparedStripeSync = {
  items: PreparedStripeItem[];
  facts: PreparedStripeFact[];
  summary: {
    safeSummary: string;
    syncedAt: number;
    counts: {
      customers: number;
      products: number;
      prices: number;
      invoices: number;
      subscriptions: number;
      balanceTransactions: number;
      items: number;
      facts: number;
    };
    totals: StripeRevenueTotals;
  };
};

export type StripeFetch = (
  input: string,
  init?: {
    method?: "GET";
    headers?: Record<string, string>;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type StripeRevenueTotals = {
  paidInvoicesByCurrency: Record<string, number>;
  openInvoicesByCurrency: Record<string, number>;
  estimatedMrrByCurrency: Record<string, number>;
  balanceNetByCurrency: Record<string, number>;
  balanceFeesByCurrency: Record<string, number>;
  activeSubscriptions: number;
};

type StripeListResponse<T> = {
  object?: string;
  data?: T[];
  has_more?: boolean;
};

const STRIPE_API_BASE = "https://api.stripe.com";
const STRIPE_SOURCE = "Stripe";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_PAGE_LIMIT = 5;

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

function cleanString(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/https?:\/\/api\.stripe\.com\/\S+/gi, "the payment service")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private detail")
    .replace(/\b[rs]k_(test|live)_[A-Za-z0-9_]{6,}\b/gi, "private detail")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function cleanEmail(value: unknown) {
  const cleaned = cleanString(value, 180);
  if (!cleaned || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) return undefined;
  return cleaned.toLowerCase();
}

function cleanId(value: unknown) {
  const cleaned = cleanString(value, 160);
  return cleaned?.replace(/[^A-Za-z0-9_:-]/g, "");
}

function unixToMs(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value * 1000)
    : undefined;
}

function stripeRefId(value: StripeObjectRef) {
  if (typeof value === "string") return cleanId(value);
  if (value && typeof value === "object") return cleanId(value.id);
  return undefined;
}

function stripeRefName(value: StripeObjectRef) {
  if (value && typeof value === "object") return cleanString(value.name, 120);
  return undefined;
}

function normalizeCurrency(value: unknown) {
  const cleaned = cleanString(value, 12)?.toLowerCase();
  return cleaned && /^[a-z]{3}$/.test(cleaned) ? cleaned : "usd";
}

function currencyDivisor(currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
}

function toMajorAmount(minorAmount: number, currency: string) {
  return minorAmount / currencyDivisor(currency);
}

function formatMoney(minorAmount: number | null | undefined, currencyValue: unknown) {
  if (typeof minorAmount !== "number" || !Number.isFinite(minorAmount)) return undefined;
  const currency = normalizeCurrency(currencyValue);
  const major = toMajorAmount(minorAmount, currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function addMoney(total: Record<string, number>, amount: number | null | undefined, currencyValue: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return;
  const currency = normalizeCurrency(currencyValue);
  total[currency] = (total[currency] ?? 0) + amount;
}

function moneyMapText(values: Record<string, number>) {
  const parts = Object.entries(values)
    .filter(([, value]) => value !== 0)
    .map(([currency, amount]) => formatMoney(Math.round(amount), currency))
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function markdown(lines: Array<string | undefined | false>) {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function displayCustomer(customer?: StripeCustomerRecord) {
  if (!customer) return "customer";
  return cleanString(customer.name, 120) ?? cleanEmail(customer.email) ?? "customer";
}

function priceInterval(price: StripePriceRecord) {
  const recurring = price.recurring;
  if (!recurring?.interval) return undefined;
  const interval = cleanString(recurring.interval, 24);
  if (!interval) return undefined;
  const count = recurring.interval_count && recurring.interval_count > 1
    ? `${recurring.interval_count} `
    : "";
  return `${count}${interval}`;
}

function priceAmountLabel(price: StripePriceRecord) {
  const amount = formatMoney(price.unit_amount ?? undefined, price.currency);
  const interval = priceInterval(price);
  if (amount && interval) return `${amount} / ${interval}`;
  return amount ?? "custom amount";
}

function subscriptionMonthlyAmountByCurrency(subscription: StripeSubscriptionRecord) {
  const totals: Record<string, number> = {};
  const items = Array.isArray(subscription.items?.data) ? subscription.items?.data ?? [] : [];

  for (const item of items) {
    const price = item.price;
    if (!price || typeof price.unit_amount !== "number") continue;
    const recurring = price.recurring;
    if (!recurring?.interval) continue;

    const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    const intervalCount = recurring.interval_count && recurring.interval_count > 0
      ? recurring.interval_count
      : 1;
    const currency = normalizeCurrency(price.currency ?? subscription.currency);
    const lineAmount = price.unit_amount * quantity;
    let monthly = lineAmount;

    if (recurring.interval === "year") monthly = lineAmount / (12 * intervalCount);
    if (recurring.interval === "month") monthly = lineAmount / intervalCount;
    if (recurring.interval === "week") monthly = (lineAmount * 52) / (12 * intervalCount);
    if (recurring.interval === "day") monthly = (lineAmount * 365) / (12 * intervalCount);

    totals[currency] = (totals[currency] ?? 0) + monthly;
  }

  return totals;
}

function buildFact(args: {
  itemExternalId: string;
  subject: string;
  predicate: string;
  object: string | undefined;
  value?: unknown;
  objectType: string;
  externalId?: string;
  syncedAt: number;
  validFrom?: number;
}): PreparedStripeFact | undefined {
  const subject = cleanString(args.subject, 180);
  const predicate = cleanString(args.predicate, 120);
  const object = cleanString(args.object, 260);
  if (!subject || !predicate || !object) return undefined;

  return {
    itemExternalId: args.itemExternalId,
    subject,
    predicate,
    object,
    value: args.value,
    confidence: 0.97,
    status: "observed",
    validFrom: args.validFrom,
    metadata: {
      connectorId: "stripe",
      objectType: args.objectType,
      externalId: args.externalId,
      syncedAt: args.syncedAt,
    },
  };
}

function appendFact(facts: PreparedStripeFact[], fact: PreparedStripeFact | undefined) {
  if (fact) facts.push(fact);
}

function itemTags(...tags: string[]) {
  return Array.from(new Set(["finance", "stripe", ...tags].map((tag) => tag.toLowerCase()))).slice(0, 10);
}

function activeStatus(value: boolean | null | undefined) {
  if (value === true) return "active";
  if (value === false) return "inactive";
  return "unknown";
}

function calculateRevenueTotals(dataset: Required<Pick<
  StripeSyncDataset,
  "invoices" | "subscriptions" | "balanceTransactions"
>>) {
  const totals: StripeRevenueTotals = {
    paidInvoicesByCurrency: {},
    openInvoicesByCurrency: {},
    estimatedMrrByCurrency: {},
    balanceNetByCurrency: {},
    balanceFeesByCurrency: {},
    activeSubscriptions: 0,
  };

  for (const invoice of dataset.invoices) {
    if (invoice.status === "paid" || invoice.paid) {
      addMoney(totals.paidInvoicesByCurrency, invoice.amount_paid ?? invoice.total, invoice.currency);
    }
    if (invoice.status === "open") {
      addMoney(totals.openInvoicesByCurrency, invoice.amount_remaining ?? invoice.amount_due, invoice.currency);
    }
  }

  for (const subscription of dataset.subscriptions) {
    if (subscription.status !== "active" && subscription.status !== "trialing") continue;
    totals.activeSubscriptions += 1;
    const mrr = subscriptionMonthlyAmountByCurrency(subscription);
    for (const [currency, amount] of Object.entries(mrr)) {
      totals.estimatedMrrByCurrency[currency] = (totals.estimatedMrrByCurrency[currency] ?? 0) + amount;
    }
  }

  for (const transaction of dataset.balanceTransactions) {
    addMoney(totals.balanceNetByCurrency, transaction.net, transaction.currency);
    addMoney(totals.balanceFeesByCurrency, transaction.fee, transaction.currency);
  }

  return totals;
}

export function isStripeReadOnlyCredential(value: unknown) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return /^rk_(test|live)_[A-Za-z0-9_]+$/.test(cleaned);
}

export function prepareStripeSync(args: {
  dataset: StripeSyncDataset;
  syncedAt?: number;
  maxItemsPerType?: number;
}): PreparedStripeSync {
  const syncedAt = args.syncedAt ?? args.dataset.syncedAt ?? Date.now();
  const limit = Math.max(1, Math.min(args.maxItemsPerType ?? 500, 1000));
  const customers = (args.dataset.customers ?? []).filter((customer) => !customer.deleted).slice(0, limit);
  const products = (args.dataset.products ?? []).slice(0, limit);
  const prices = (args.dataset.prices ?? []).slice(0, limit);
  const invoices = (args.dataset.invoices ?? []).slice(0, limit);
  const subscriptions = (args.dataset.subscriptions ?? []).slice(0, limit);
  const balanceTransactions = (args.dataset.balanceTransactions ?? []).slice(0, limit);
  const customersById = new Map(customers.map((customer) => [cleanId(customer.id), customer]));
  const productsById = new Map(products.map((product) => [cleanId(product.id), product]));
  const items: PreparedStripeItem[] = [];
  const facts: PreparedStripeFact[] = [];

  for (const customer of customers) {
    const id = cleanId(customer.id);
    if (!id) continue;
    const name = displayCustomer(customer);
    const email = cleanEmail(customer.email);
    const externalId = `customer:${id}`;
    const subject = `Stripe customer ${name}`;
    const balance = formatMoney(customer.balance ?? undefined, customer.currency);

    items.push({
      externalId,
      externalType: "customer",
      title: `Stripe customer: ${name}`,
      summary: email ? `${name} is a synced Stripe customer with billing email ${email}.` : `${name} is a synced Stripe customer.`,
      content: markdown([
        `# Stripe customer: ${name}`,
        "",
        "Synced as read-only customer context.",
        email && `Billing email: ${email}`,
        balance && `Customer balance: ${balance}`,
        typeof customer.delinquent === "boolean" && `Payment status: ${customer.delinquent ? "needs attention" : "current"}`,
      ]),
      kind: "record",
      format: "markdown",
      tags: itemTags("customer"),
      sourceName: STRIPE_SOURCE,
      externalCreatedAt: unixToMs(customer.created),
    });

    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "is a Stripe customer",
      object: name,
      objectType: "customer",
      externalId: id,
      syncedAt,
      validFrom: unixToMs(customer.created),
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "billing email",
      object: email,
      objectType: "customer",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "payment status",
      object: typeof customer.delinquent === "boolean" ? (customer.delinquent ? "needs attention" : "current") : undefined,
      value: { delinquent: Boolean(customer.delinquent) },
      objectType: "customer",
      externalId: id,
      syncedAt,
    }));
  }

  for (const product of products) {
    const id = cleanId(product.id);
    if (!id) continue;
    const name = cleanString(product.name, 140) ?? "Unnamed product";
    const description = cleanString(product.description, 260);
    const status = activeStatus(product.active);
    const externalId = `product:${id}`;
    const subject = `Stripe product ${name}`;

    items.push({
      externalId,
      externalType: "product",
      title: `Stripe product: ${name}`,
      summary: description ?? `${name} is a ${status} Stripe product.`,
      content: markdown([
        `# Stripe product: ${name}`,
        "",
        `Status: ${status}`,
        description && `Description: ${description}`,
      ]),
      kind: "record",
      format: "markdown",
      tags: itemTags("product", status),
      sourceName: STRIPE_SOURCE,
      externalCreatedAt: unixToMs(product.created),
      externalUpdatedAt: unixToMs(product.updated),
    });

    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "product status",
      object: status,
      value: { active: Boolean(product.active) },
      objectType: "product",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "product description",
      object: description,
      objectType: "product",
      externalId: id,
      syncedAt,
    }));
  }

  for (const price of prices) {
    const id = cleanId(price.id);
    if (!id) continue;
    const productId = stripeRefId(price.product);
    const productName = stripeRefName(price.product) ?? (productId ? cleanString(productsById.get(productId)?.name, 120) : undefined);
    const amount = priceAmountLabel(price);
    const label = cleanString(price.nickname, 120) ?? productName ?? amount;
    const status = activeStatus(price.active);
    const externalId = `price:${id}`;
    const subject = `Stripe price ${label}`;
    const interval = priceInterval(price);

    items.push({
      externalId,
      externalType: "price",
      title: `Stripe price: ${label}`,
      summary: `${label} is ${amount}${interval ? "" : ""} and ${status}.`,
      content: markdown([
        `# Stripe price: ${label}`,
        "",
        `Amount: ${amount}`,
        interval && `Billing interval: ${interval}`,
        productName && `Product: ${productName}`,
        `Status: ${status}`,
      ]),
      kind: "record",
      format: "markdown",
      tags: itemTags("price", price.type ?? "price", status),
      sourceName: STRIPE_SOURCE,
      externalCreatedAt: unixToMs(price.created),
    });

    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "price amount",
      object: amount,
      value: {
        amountMinor: price.unit_amount,
        currency: normalizeCurrency(price.currency),
        recurringInterval: interval,
      },
      objectType: "price",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "price status",
      object: status,
      objectType: "price",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "belongs to product",
      object: productName,
      value: productId ? { productId } : undefined,
      objectType: "price",
      externalId: id,
      syncedAt,
    }));
  }

  for (const invoice of invoices) {
    const id = cleanId(invoice.id);
    if (!id) continue;
    const customerId = stripeRefId(invoice.customer);
    const customerName = displayCustomer(customersById.get(customerId));
    const status = cleanString(invoice.status, 40) ?? (invoice.paid ? "paid" : "unknown");
    const amountPaid = formatMoney(invoice.amount_paid ?? undefined, invoice.currency);
    const amountDue = formatMoney(invoice.amount_due ?? invoice.total ?? undefined, invoice.currency);
    const number = cleanString(invoice.number, 80);
    const externalId = `invoice:${id}`;
    const titleLabel = number ? `${number} (${status})` : `${customerName} invoice (${status})`;
    const subject = `Stripe invoice ${number ?? id}`;

    items.push({
      externalId,
      externalType: "invoice",
      title: `Stripe invoice: ${titleLabel}`,
      summary: `Invoice for ${customerName} is ${status}${amountPaid ? ` with ${amountPaid} paid` : ""}.`,
      content: markdown([
        `# Stripe invoice: ${titleLabel}`,
        "",
        `Status: ${status}`,
        amountDue && `Amount due: ${amountDue}`,
        amountPaid && `Amount paid: ${amountPaid}`,
        customerName !== "customer" && `Customer: ${customerName}`,
        typeof invoice.due_date === "number" ? `Due date: ${new Date(invoice.due_date * 1000).toISOString().slice(0, 10)}` : undefined,
      ]),
      kind: "record",
      format: "markdown",
      tags: itemTags("invoice", status),
      sourceName: STRIPE_SOURCE,
      externalCreatedAt: unixToMs(invoice.created),
      externalUpdatedAt: unixToMs(invoice.due_date ?? undefined),
    });

    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "invoice status",
      object: status,
      objectType: "invoice",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "amount paid",
      object: amountPaid,
      value: { amountMinor: invoice.amount_paid, currency: normalizeCurrency(invoice.currency) },
      objectType: "invoice",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "customer",
      object: customerName !== "customer" ? customerName : undefined,
      value: customerId ? { customerId } : undefined,
      objectType: "invoice",
      externalId: id,
      syncedAt,
    }));
  }

  for (const subscription of subscriptions) {
    const id = cleanId(subscription.id);
    if (!id) continue;
    const customerId = stripeRefId(subscription.customer);
    const customerName = displayCustomer(customersById.get(customerId));
    const status = cleanString(subscription.status, 40) ?? "unknown";
    const mrr = subscriptionMonthlyAmountByCurrency(subscription);
    const mrrText = moneyMapText(mrr);
    const externalId = `subscription:${id}`;
    const subject = `Stripe subscription for ${customerName}`;

    items.push({
      externalId,
      externalType: "subscription",
      title: `Stripe subscription: ${customerName} (${status})`,
      summary: `${customerName} has a ${status} subscription${mrrText ? ` with estimated monthly recurring revenue of ${mrrText}` : ""}.`,
      content: markdown([
        `# Stripe subscription: ${customerName}`,
        "",
        `Status: ${status}`,
        mrrText && `Estimated monthly recurring revenue: ${mrrText}`,
        typeof subscription.current_period_start === "number" ? `Current period start: ${new Date(subscription.current_period_start * 1000).toISOString().slice(0, 10)}` : undefined,
        typeof subscription.current_period_end === "number" ? `Current period end: ${new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10)}` : undefined,
      ]),
      kind: "record",
      format: "markdown",
      tags: itemTags("subscription", status),
      sourceName: STRIPE_SOURCE,
      externalCreatedAt: unixToMs(subscription.created),
      externalUpdatedAt: unixToMs(subscription.current_period_end ?? undefined),
    });

    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "subscription status",
      object: status,
      objectType: "subscription",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "estimated monthly recurring revenue",
      object: mrrText,
      value: mrr,
      objectType: "subscription",
      externalId: id,
      syncedAt,
    }));
    appendFact(facts, buildFact({
      itemExternalId: externalId,
      subject,
      predicate: "customer",
      object: customerName !== "customer" ? customerName : undefined,
      value: customerId ? { customerId } : undefined,
      objectType: "subscription",
      externalId: id,
      syncedAt,
    }));
  }

  const totals = calculateRevenueTotals({ invoices, subscriptions, balanceTransactions });
  const paidText = moneyMapText(totals.paidInvoicesByCurrency);
  const openText = moneyMapText(totals.openInvoicesByCurrency);
  const mrrText = moneyMapText(totals.estimatedMrrByCurrency);
  const netText = moneyMapText(totals.balanceNetByCurrency);
  const summaryExternalId = "revenue:summary";

  items.push({
    externalId: summaryExternalId,
    externalType: "revenue_summary",
    title: "Stripe revenue summary",
    summary: `Synced ${customers.length} customers, ${products.length} products, ${prices.length} prices, ${invoices.length} invoices, and ${subscriptions.length} subscriptions.`,
    content: markdown([
      "# Stripe revenue summary",
      "",
      `Customers: ${customers.length}`,
      `Products: ${products.length}`,
      `Prices: ${prices.length}`,
      `Invoices: ${invoices.length}`,
      `Subscriptions: ${subscriptions.length}`,
      `Active subscriptions: ${totals.activeSubscriptions}`,
      paidText && `Paid invoices: ${paidText}`,
      openText && `Open invoices: ${openText}`,
      mrrText && `Estimated monthly recurring revenue: ${mrrText}`,
      netText && `Recent balance net: ${netText}`,
    ]),
    kind: "brief",
    format: "markdown",
    tags: itemTags("revenue", "summary"),
    sourceName: STRIPE_SOURCE,
    externalCreatedAt: syncedAt,
    externalUpdatedAt: syncedAt,
  });

  appendFact(facts, buildFact({
    itemExternalId: summaryExternalId,
    subject: "Stripe revenue summary",
    predicate: "customer count",
    object: String(customers.length),
    value: customers.length,
    objectType: "revenue_summary",
    syncedAt,
  }));
  appendFact(facts, buildFact({
    itemExternalId: summaryExternalId,
    subject: "Stripe revenue summary",
    predicate: "active subscription count",
    object: String(totals.activeSubscriptions),
    value: totals.activeSubscriptions,
    objectType: "revenue_summary",
    syncedAt,
  }));
  appendFact(facts, buildFact({
    itemExternalId: summaryExternalId,
    subject: "Stripe revenue summary",
    predicate: "paid invoice total",
    object: paidText,
    value: totals.paidInvoicesByCurrency,
    objectType: "revenue_summary",
    syncedAt,
  }));
  appendFact(facts, buildFact({
    itemExternalId: summaryExternalId,
    subject: "Stripe revenue summary",
    predicate: "open invoice total",
    object: openText,
    value: totals.openInvoicesByCurrency,
    objectType: "revenue_summary",
    syncedAt,
  }));
  appendFact(facts, buildFact({
    itemExternalId: summaryExternalId,
    subject: "Stripe revenue summary",
    predicate: "estimated monthly recurring revenue",
    object: mrrText,
    value: totals.estimatedMrrByCurrency,
    objectType: "revenue_summary",
    syncedAt,
  }));
  appendFact(facts, buildFact({
    itemExternalId: summaryExternalId,
    subject: "Stripe revenue summary",
    predicate: "recent balance net",
    object: netText,
    value: totals.balanceNetByCurrency,
    objectType: "revenue_summary",
    syncedAt,
  }));

  const safeSummary = [
    `Synced Stripe finance context: ${items.length} records and ${facts.length} facts.`,
    paidText ? `Paid invoices: ${paidText}.` : undefined,
    mrrText ? `Estimated monthly recurring revenue: ${mrrText}.` : undefined,
  ].filter(Boolean).join(" ");

  return {
    items,
    facts,
    summary: {
      safeSummary,
      syncedAt,
      counts: {
        customers: customers.length,
        products: products.length,
        prices: prices.length,
        invoices: invoices.length,
        subscriptions: subscriptions.length,
        balanceTransactions: balanceTransactions.length,
        items: items.length,
        facts: facts.length,
      },
      totals,
    },
  };
}

async function listStripeResource<T>(args: {
  apiKey: string;
  fetchFn: StripeFetch;
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  pageSize: number;
  pageLimit: number;
}) {
  const results: T[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < args.pageLimit; page += 1) {
    const url = new URL(`${STRIPE_API_BASE}${args.path}`);
    url.searchParams.set("limit", String(args.pageSize));
    for (const [key, value] of Object.entries(args.params ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const response = await args.fetchFn(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error("The Stripe read-only sync could not finish.");
    }

    const payload = await response.json() as StripeListResponse<T>;
    if (!Array.isArray(payload.data)) {
      throw new Error("The Stripe read-only sync returned an unexpected response.");
    }

    results.push(...payload.data);
    if (!payload.has_more || payload.data.length === 0) break;

    const last = payload.data[payload.data.length - 1] as { id?: unknown };
    startingAfter = cleanId(last.id);
    if (!startingAfter) break;
  }

  return results;
}

function uniqueById<T extends { id?: string }>(records: T[]) {
  const byId = new Map<string, T>();
  const withoutId: T[] = [];
  for (const record of records) {
    const id = cleanId(record.id);
    if (id) byId.set(id, record);
    else withoutId.push(record);
  }
  return [...byId.values(), ...withoutId];
}

export async function fetchStripeReadOnlyDataset(args: {
  apiKey: string;
  fetchFn: StripeFetch;
  now?: number;
  pageSize?: number;
  pageLimit?: number;
}): Promise<StripeSyncDataset> {
  if (!isStripeReadOnlyCredential(args.apiKey)) {
    throw new Error("Use a read-only Stripe connection before syncing finance context.");
  }

  const pageSize = Math.max(1, Math.min(args.pageSize ?? DEFAULT_PAGE_SIZE, 100));
  const pageLimit = Math.max(1, Math.min(args.pageLimit ?? DEFAULT_PAGE_LIMIT, 20));
  const list = <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    listStripeResource<T>({
      apiKey: args.apiKey,
      fetchFn: args.fetchFn,
      path,
      params,
      pageSize,
      pageLimit,
    });

  const [
    customers,
    products,
    activePrices,
    inactivePrices,
    invoices,
    subscriptions,
    balanceTransactions,
  ] = await Promise.all([
    list<StripeCustomerRecord>("/v1/customers"),
    list<StripeProductRecord>("/v1/products"),
    list<StripePriceRecord>("/v1/prices", { active: true }),
    list<StripePriceRecord>("/v1/prices", { active: false }),
    list<StripeInvoiceRecord>("/v1/invoices"),
    list<StripeSubscriptionRecord>("/v1/subscriptions", { status: "all" }),
    list<StripeBalanceTransactionRecord>("/v1/balance_transactions"),
  ]);

  return {
    customers,
    products,
    prices: uniqueById([...activePrices, ...inactivePrices]),
    invoices,
    subscriptions,
    balanceTransactions,
    syncedAt: args.now ?? Date.now(),
  };
}
