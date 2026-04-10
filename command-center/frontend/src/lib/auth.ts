import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const ALLOWED_USERS = ["iamkiranrao"];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // GitHub sends iss=https://github.com/login/oauth in the callback,
      // but @auth/core defaults to "https://authjs.dev" causing validation
      // failure. Set issuer to match what GitHub actually sends.
      issuer: "https://github.com/login/oauth",
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.login || !ALLOWED_USERS.includes(profile.login as string)) {
        return false;
      }
      return true;
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.username = profile.login;
        token.avatar = profile.avatar_url;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).username = token.username;
        (session.user as any).avatar = token.avatar;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
