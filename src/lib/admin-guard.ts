import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import prisma from './prisma';

/**
 * Authorise an admin-only API request. Returns the admin's user id, or null if
 * the caller isn't a signed-in ADMIN.
 *
 * Role is re-read from the DB (not just trusted from the JWT) so a demoted admin
 * with a still-valid cookie can't keep acting as one — admin actions are
 * sensitive enough to warrant the extra lookup.
 */
export async function requireAdmin(): Promise<{ id: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN') return null;

  return { id: session.user.id };
}
