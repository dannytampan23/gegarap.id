import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/prisma';
import { normalizePhone, verifyOtp, upsertUser } from '@/lib/otp';

/**
 * NextAuth configuration — passwordless WhatsApp OTP via a Credentials provider.
 *
 * The UI first calls `/api/auth/send-otp` to deliver a code, then submits
 * `{ phone, otp }` here. A valid code upserts the user (login == register) and
 * issues a JWT session. Kept in one place so the route handler, middleware, and
 * `getServerSession` share the same options.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'whatsapp-otp',
      name: 'WhatsApp OTP',
      credentials: {
        phone: { label: 'Nomor WhatsApp', type: 'text' },
        otp: { label: 'Kode OTP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) return null;

        const phone = normalizePhone(credentials.phone);
        const valid = await verifyOtp(phone, credentials.otp);
        if (!valid) return null;

        const user = await upsertUser(phone);
        return {
          id: user.id,
          phone: user.phone ?? phone,
          name: user.name ?? phone,
          role: user.role,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in, seed the token from the authorize() result.
      if (user) {
        token.id = user.id;
        token.phone = (user as { phone?: string }).phone ?? token.phone;
        token.role = (user as { role?: string }).role ?? token.role;
      }

      // Keep `role` authoritative against the DB. Without this, a JWT minted
      // while the user was a CUSTOMER stays CUSTOMER even after onboarding
      // promotes them to PROVIDER (or after an admin grant). Re-read on every
      // refresh (no `user`) and on an explicit client session.update().
      if (token.id && (!user || trigger === 'update')) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.phone = token.phone;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
