import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

// Shared test helper: every User now requires an Organization (pooled
// multi-tenancy). Tests that need a user first provision a throwaway
// organization with a unique slug per test run to avoid collisions.
export async function createTestOrganization(
  prisma: PrismaClient,
  namePrefix: string,
): Promise<{ id: string; slug: string }> {
  const slug = `${namePrefix}-${randomUUID().slice(0, 8)}`;
  const org = await prisma.organization.create({
    data: { name: namePrefix, slug },
  });
  return { id: org.id, slug: org.slug };
}
