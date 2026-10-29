import type { Clock, RandomBytes, Session } from "./domain.ts";

/** ADR-001: a fixed 30-minute lifetime from issue, no renewal. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

export type SessionStore = {
  issue(accountId: string): Session;
  resolve(token: string): Session | undefined;
};

/** "Valid until expiresAt": live strictly before it. */
export const isLive = (session: Session, now: Date): boolean => now.getTime() < session.expiresAt.getTime();

/** The in-memory store. The Map is the only mutable state in the service. */
export function createSessionStore(clock: Clock, randomBytes: RandomBytes): SessionStore {
  const sessions = new Map<string, Session>();
  return {
    issue(accountId) {
      const session: Session = {
        token: randomBytes(32).toString("base64url"),
        accountId,
        expiresAt: new Date(clock().getTime() + SESSION_TTL_MS),
      };
      sessions.set(session.token, session);
      return session;
    },
    resolve(token) {
      const session = sessions.get(token);
      if (session === undefined) return undefined;
      if (isLive(session, clock())) return session;
      sessions.delete(token);
      return undefined;
    },
  };
}
