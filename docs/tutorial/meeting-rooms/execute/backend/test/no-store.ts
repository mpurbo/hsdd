// A BookingStore for tests that reach no booking route: every method rejects,
// so a test that does reach it fails. It holds no bookings and answers nothing.
import type { BookingStore } from "../src/domain.ts";

const unreachable = (): Promise<never> => Promise.reject(new Error("this test reaches no booking route"));

export const NO_STORE: BookingStore = {
  insert: unreachable,
  overlapping: unreachable,
  notEndedOf: unreachable,
  find: unreachable,
  remove: unreachable,
};
