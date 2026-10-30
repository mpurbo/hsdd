import type { Account, Profile } from "./domain.ts";

// The PRD's demo accounts. Passwords are stored only as scrypt keys
// (N = 16384, r = 8, p = 1, 64-byte key, 16-byte salt), never in plain text.
export const ACCOUNTS: readonly Account[] = [
  {
    id: "u_001",
    username: "ayu",
    displayName: "Ayu Lestari",
    email: "ayu@example.com",
    phone: "+62 812 3456 7890",
    memberSince: "2024-03-14",
    password: {
      salt: "41bd1b70afb78cb94af0bc1671a727ee",
      hash: "48de88b257285fde8323a9afebd55d2318f42ebafac48ef9476f284c280bd31edf3cb3b184384a4c06bdf00d00e42a2e6e8e184882809f9d5197bc81e9387023",
    },
  },
  {
    id: "u_002",
    username: "budi",
    displayName: "Budi Santoso",
    email: "budi@example.com",
    phone: "+62 813 9876 5432",
    memberSince: "2025-01-09",
    password: {
      salt: "21be5d709ae5ec27c3a3f21fcddfee08",
      hash: "f3cbc76cf27ba724debf5684a537f232244d9bf9442a67180f592248ebbe5ba014bcecb897314aaa43db63b5c7db0378696c521eb6eace9108e8503e639a94fb",
    },
  },
];

export function toProfile({ password: _password, ...profile }: Account): Profile {
  return profile;
}
