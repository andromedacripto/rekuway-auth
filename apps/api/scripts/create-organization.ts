import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

// Usage: pnpm exec tsx scripts/create-organization.ts "Acme Corp" acme-corp
// Run this once per new pilot client to provision their tenant before
// their first user can register.

async function main(): Promise<void> {
  const [name, slug] = process.argv.slice(2);
  if (!name || !slug) {
    console.error('Usage: tsx scripts/create-organization.ts "Company Name" company-slug');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.create({
      data: { id: randomUUID(), name, slug },
    });
    console.log(`Created organization: ${org.name} (slug: ${org.slug}, id: ${org.id})`);
  } catch (err) {
    console.error("Failed to create organization:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
