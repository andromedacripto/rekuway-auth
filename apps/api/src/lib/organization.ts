import type { PrismaClient } from "@prisma/client";

// Organizations are provisioned deliberately (via `pnpm create:org`), never
// auto-created by an incoming registration request — this prevents anyone
// from squatting a client company's slug by simply registering first.
export async function resolveOrganizationBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  return prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}
