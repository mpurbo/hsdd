// Domain types for the backend. Values only: no behavior lives here.

export type Clock = () => Date;
export type RandomBytes = (size: number) => Buffer;

/** A scrypt salt and derived key, both hex. */
export type PasswordHash = { salt: string; hash: string };

export type Account = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  /** A calendar date, YYYY-MM-DD. */
  memberSince: string;
  password: PasswordHash;
};

/** What profile-api@v1 returns: an account without its password. */
export type Profile = Omit<Account, "password">;

export type Session = { token: string; accountId: string; expiresAt: Date };

export type ErrorCode = "VALIDATION_FAILED" | "INVALID_CREDENTIALS" | "UNAUTHORIZED";

/** The error envelope both contracts use. */
export type ApiError = { error: { code: ErrorCode; message: string } };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
