import type { FastifyInstance } from "fastify";
import { toProfile } from "./accounts.ts";
import type { Account, ApiError, ErrorCode } from "./domain.ts";
import { authenticate } from "./passwords.ts";
import { parseBearer, parseLoginRequest } from "./requests.ts";
import type { SessionStore } from "./sessions.ts";

const apiError = (code: ErrorCode, message: string): ApiError => ({ error: { code, message } });

// The exact bodies auth-api@v1 and profile-api@v2 fix.
export const VALIDATION_FAILED = apiError("VALIDATION_FAILED", "Username and password are required.");
export const INVALID_CREDENTIALS = apiError("INVALID_CREDENTIALS", "Incorrect username or password.");
export const UNAUTHORIZED = apiError("UNAUTHORIZED", "Sign in to continue.");

/** The one token check: the account a bearer token signs in, or undefined. */
export const signedInAccount =
  (accounts: readonly Account[], sessions: SessionStore) =>
  (authorization: string | undefined): Account | undefined => {
    const token = parseBearer(authorization);
    const session = token === undefined ? undefined : sessions.resolve(token);
    return session && accounts.find((a) => a.id === session.accountId);
  };

export type RouteDeps = {
  accounts: readonly Account[];
  sessions: SessionStore;
  signedIn: (authorization: string | undefined) => Account | undefined;
};

export function registerRoutes(app: FastifyInstance, { accounts, sessions, signedIn }: RouteDeps): void {
  app.post("/api/login", async (request, reply) => {
    const raw = typeof request.body === "string" ? request.body : "";
    const parsed = parseLoginRequest(request.headers["content-type"], raw);
    if (!parsed.ok) return reply.code(400).send(VALIDATION_FAILED);

    const account = await authenticate(accounts, parsed.value.username, parsed.value.password);
    if (account === undefined) return reply.code(401).send(INVALID_CREDENTIALS);

    const session = sessions.issue(account.id);
    return reply.code(200).send({ token: session.token, tokenType: "Bearer", expiresAt: session.expiresAt.toISOString() });
  });

  app.get("/api/me", async (request, reply) => {
    const account = signedIn(request.headers.authorization);
    if (account === undefined) return reply.code(401).send(UNAUTHORIZED);
    return reply.code(200).send(toProfile(account));
  });
}
