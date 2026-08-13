import { eq } from "drizzle-orm";
import { localCredentials, users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";
import { sdk } from "../server/_core/sdk";

const username = `verify_${Date.now()}`;
const password = "LocalAuth-Check-2026";

async function main() {
  const ctx = { user: null, req: { headers: {}, protocol: "https" }, res: {} } as any;
  const caller = appRouter.createCaller(ctx);
  try {
    const registered = await caller.auth.register({ username, password });
    const authenticated = await sdk.authenticateRequest({ headers: { authorization: `Bearer ${registered.sessionToken}` } } as any);
    const loggedIn = await caller.auth.login({ username, password });
    if (authenticated.id !== registered.user.id || loggedIn.user.id !== registered.user.id || !loggedIn.sessionToken) {
      throw new Error("Local auth verification did not return the expected user session.");
    }
    console.log(JSON.stringify({ registered: true, authenticated: true, loggedIn: true, userId: registered.user.id }));
  } finally {
    const db = await getDb();
    if (db) {
      await db.delete(localCredentials).where(eq(localCredentials.username, username));
      await db.delete(users).where(eq(users.openId, `local:${username}`));
    }
  }
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
