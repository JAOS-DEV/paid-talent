import { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types/auth";
import { isOver18 } from "@/lib/helpers/age-verification";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const email = credentials.email as string;
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser) {
          return {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            image: existingUser.image,
            role: existingUser.role,
            ageVerified: existingUser.ageVerified,
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    newUser: "/onboarding",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email!))
          .limit(1);

        if (!existingUser) {
          return "/auth/role-select?email=" + encodeURIComponent(user.email!);
        }

        if (!existingUser.ageVerified) {
          return "/auth/age-verification";
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
        token.ageVerified = (user as { ageVerified: boolean }).ageVerified;
      }

      if (trigger === "update" && session) {
        token.role = (session as { role?: UserRole }).role ?? token.role;
        token.ageVerified = (session as { ageVerified?: boolean }).ageVerified ?? token.ageVerified;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.ageVerified = token.ageVerified as boolean;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
};

export async function createUserWithRole(
  email: string,
  role: UserRole,
  dateOfBirth: Date | null,
  name?: string
): Promise<typeof users.$inferSelect> {
  const now = new Date();
  const ageVerified = dateOfBirth ? isOver18(dateOfBirth) : false;

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      role,
      name: name ?? null,
      dateOfBirth: dateOfBirth?.toISOString().split("T")[0] ?? null,
      ageVerified,
      ageVerifiedAt: ageVerified ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newUser;
}

export { isOver18 };
