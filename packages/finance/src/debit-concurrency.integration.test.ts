import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DomainError } from "@onetrips/shared";
import { prisma } from "@onetrips/database";
import { assertCanDebit, debitWallet, depositToWallet, getWalletSnapshot } from "./service";

function loadEnv() {
  try {
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    const path = `${process.cwd()}/.env`;
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("wallet debit concurrency", () => {
  it("does not let two simultaneous 8000 charges spend the same 10000 capacity", async () => {
    const org = await prisma.organization.create({
      data: {
        name: `Concurrency ${randomUUID().slice(0, 8)}`,
        type: "AGENCY",
        status: "ACTIVE",
        creditLimit: 0,
      },
    });
    await depositToWallet(org.id, "ORGANIZATION", "test-actor", {
      amount: 10_000,
      currency: "BDT",
      reference: `DEP-CONC-${org.id.slice(-8)}`,
      note: "Concurrency fixture",
    });
    const before = await getWalletSnapshot(org.id, "ORGANIZATION");
    expect(before.available).toBe(10_000);
    await assertCanDebit(org.id, "ORGANIZATION", 8_000, "BDT");

    const results = await Promise.allSettled([
      debitWallet(org.id, "ORGANIZATION", "agent-a", {
        amount: 8_000,
        currency: "BDT",
        reference: `BKG-A-${org.id.slice(-8)}`,
        note: "Booking A",
      }),
      debitWallet(org.id, "ORGANIZATION", "agent-b", {
        amount: 8_000,
        currency: "BDT",
        reference: `BKG-B-${org.id.slice(-8)}`,
        note: "Booking B",
      }),
    ]);

    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const failure = (rejected[0] as PromiseRejectedResult).reason;
    expect(failure).toBeInstanceOf(DomainError);
    expect((failure as DomainError).code).toBe("INSUFFICIENT_CREDIT");

    const after = await getWalletSnapshot(org.id, "ORGANIZATION");
    expect(after.available).toBe(2_000);
    expect(after.balance).toBe(2_000);
  });
});
