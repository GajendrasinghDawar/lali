import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

export const db = new Database("gateway.db");

export const auth = betterAuth({
  database: db,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "unset",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "unset",
    }
  },
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          if (account.providerId === "github" && account.accountId !== process.env.OWNER_GITHUB_ID) {
            throw new Error("Only the owner can log in");
          }
          return { data: account };
        }
      }
    }
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production"
  }
});
