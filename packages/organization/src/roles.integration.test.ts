import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@onetrips/shared";
import { prisma } from "@onetrips/database";
import { hasPermission } from "@onetrips/auth";
import { updateOrganization } from "./service";

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

const AGENT_PERMS = [PERMISSIONS.BOOKING_VIEW, PERMISSIONS.BOOKING_CREATE, PERMISSIONS.BOOKING_CANCEL];
const VIEWER_PERMS = [PERMISSIONS.BOOKING_VIEW];
const ACCOUNTANT_PERMS = [
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.WALLET_VIEW,
  PERMISSIONS.LEDGER_VIEW,
  PERMISSIONS.REPORT_VIEW,
];
const OWNER_PERMS = [
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.BOOKING_CREATE,
  PERMISSIONS.WALLET_DEPOSIT,
  PERMISSIONS.LEDGER_VIEW,
  PERMISSIONS.USER_MANAGE,
];

describe.skipIf(!hasDb)("B2B role permissions", () => {
  it("uses permission codes rather than role names for financial and org mutations", async () => {
    const agentPayload = { sub: "agent", type: "B2B" as const, permissions: AGENT_PERMS };
    const viewerPayload = { sub: "viewer", type: "B2B" as const, permissions: VIEWER_PERMS };
    const accountantPayload = { sub: "acct", type: "B2B" as const, permissions: ACCOUNTANT_PERMS };
    const ownerPayload = { sub: "owner", type: "B2B" as const, permissions: OWNER_PERMS };

    expect(hasPermission(agentPayload.permissions, PERMISSIONS.BOOKING_CREATE)).toBe(true);
    expect(hasPermission(agentPayload.permissions, PERMISSIONS.WALLET_DEPOSIT)).toBe(false);
    expect(hasPermission(agentPayload.permissions, PERMISSIONS.LEDGER_VIEW)).toBe(false);
    expect(hasPermission(agentPayload.permissions, PERMISSIONS.USER_MANAGE)).toBe(false);

    expect(hasPermission(viewerPayload.permissions, PERMISSIONS.BOOKING_VIEW)).toBe(true);
    expect(hasPermission(viewerPayload.permissions, PERMISSIONS.BOOKING_CREATE)).toBe(false);

    expect(hasPermission(accountantPayload.permissions, PERMISSIONS.LEDGER_VIEW)).toBe(true);
    expect(hasPermission(accountantPayload.permissions, PERMISSIONS.BOOKING_CREATE)).toBe(false);
    expect(hasPermission(accountantPayload.permissions, PERMISSIONS.WALLET_DEPOSIT)).toBe(false);

    expect(hasPermission(ownerPayload.permissions, PERMISSIONS.WALLET_DEPOSIT)).toBe(true);
    expect(hasPermission(ownerPayload.permissions, PERMISSIONS.USER_MANAGE)).toBe(true);
  });

  it("blocks agents from updating the organization record", async () => {
    const org = await prisma.organization.create({
      data: { name: `Role ${randomUUID().slice(0, 8)}`, type: "AGENCY", status: "ACTIVE" },
    });
    const agent = await prisma.user.create({
      data: {
        email: `agent.${randomUUID().slice(0, 8)}@onetrips.test`,
        passwordHash: "x",
        displayName: "Agent",
        type: "B2B",
        status: "ACTIVE",
      },
    });
    await prisma.organizationUser.create({
      data: { organizationId: org.id, userId: agent.id, role: "AGENT" },
    });
    await expect(updateOrganization(agent.id, { city: "Hacked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
