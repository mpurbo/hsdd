import { scrypt, timingSafeEqual } from "node:crypto";
import type { Account, PasswordHash } from "./domain.ts";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

/** A key nobody knows the password for. Unknown usernames are compared against it. */
export const DUMMY_HASH: PasswordHash = {
  salt: "d7982de314faa52e3641daefa6a6c0a4",
  hash: "f2c719fb0832d3fb1aabcdaf96b5197181609dcb7668a9bab84775bc9c4dbf4e57c4cd4889c525080629e0b8c7dc19a614ae31baad6d3bbf94ec283149f9b328",
};

const deriveKey = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => (error ? reject(error) : resolve(key))),
  );

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const key = await deriveKey(password, Buffer.from(stored.salt, "hex"));
  return timingSafeEqual(key, Buffer.from(stored.hash, "hex"));
}

export type Verify = typeof verifyPassword;

/**
 * The account whose username matches exactly and whose password verifies.
 * Always runs exactly one comparison, so timing does not reveal whether the
 * username exists (RFC §4).
 */
export async function authenticate(
  accounts: readonly Account[],
  username: string,
  password: string,
  verify: Verify = verifyPassword,
): Promise<Account | undefined> {
  const account = accounts.find((a) => a.username === username);
  const ok = await verify(password, account?.password ?? DUMMY_HASH);
  return ok ? account : undefined;
}
