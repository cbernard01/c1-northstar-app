import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import { type JWT } from "next-auth/jwt";
import MicrosoftEntraIdProvider from "next-auth/providers/microsoft-entra-id";

import { prisma } from "@/lib/prisma";
import { getEnvVariable } from "@/lib/utils";

import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessTokenExpires?: number;
    refreshToken?: string;
  }
}

const providers: Provider[] = [
  MicrosoftEntraIdProvider({
    clientId: getEnvVariable("AUTH_MICROSOFT_ENTRA_ID_ID"),
    clientSecret: getEnvVariable("AUTH_MICROSOFT_ENTRA_ID_SECRET"),
    issuer: `https://login.microsoftonline.com/${getEnvVariable("AUTH_MICROSOFT_ENTRA_ID_TENANT_ID")}/v2.0`,
  }),
];

export const authOptions: NextAuthConfig = {
  providers,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = Number(Date.now() + (account.expires_in ?? 0) * 1000);
      }

      if (token.accessTokenExpires && Date.now() > token.accessTokenExpires) {
        return await refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.id = token.sub as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      session.user.image = token.picture as string;

      return session;
    },
  },
  events: {
    async signIn(message) {
      if (message.user.email) {
        const user = await prisma.user.findUnique({
          where: {
            email: message.user.email,
          },
        });

        if (user && message.profile?.oid && !user.oid) {
          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              oid: message.profile.oid,
            },
          });
        }
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) throw new Error("No refresh token found");

    const url = `https://login.microsoftonline.com/${getEnvVariable("AUTH_MICROSOFT_ENTRA_ID_TENANT_ID")}/oauth2/v2.0/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: getEnvVariable("AUTH_MICROSOFT_ENTRA_ID_ID"),
        client_secret: getEnvVariable("AUTH_MICROSOFT_ENTRA_ID_SECRET"),
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error: unknown) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}