import type { Room } from "./domain.ts";

// The pre-loaded rooms (D3; booking-api@v1 Shapes), in the order every list
// shows them. Nobody adds, edits or removes one.
export const ROOMS: readonly Room[] = [
  { id: "merapi", name: "Merapi", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 8 },
  { id: "bromo", name: "Bromo", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 4 },
  { id: "thames", name: "Thames", office: "London", timeZone: "Europe/London", seats: 10 },
  { id: "kew", name: "Kew", office: "London", timeZone: "Europe/London", seats: 4 },
];
