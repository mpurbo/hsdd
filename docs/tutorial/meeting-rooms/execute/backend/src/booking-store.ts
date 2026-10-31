// The booking store on PostgreSQL (D5, D6). Instants cross the boundary as ISO
// strings with an explicit ::timestamptz cast, so the session setting never matters.
import type { Pool, PoolClient } from "pg";
import type { BookingStore, NewBooking, Result, StoredBooking } from "./domain.ts";

const COLUMNS = "id, room_id, account_id, title, start_at, end_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Row = { id: string; room_id: string; account_id: string; title: string; start_at: Date; end_at: Date };

// D10: PostgreSQL has no year 0 or earlier in ISO input (22008), so a bound before
// year 1 goes as year 1. Stored instants are never earlier, so the answer is unchanged.
const EARLIEST = new Date("0001-01-01T00:00:00.000Z");
export const sqlInstant = (bound: Date): string => (bound < EARLIEST ? EARLIEST : bound).toISOString();

const toStoredBooking = (row: Row): StoredBooking => ({
  id: row.id,
  roomId: row.room_id,
  accountId: row.account_id,
  title: row.title,
  start: row.start_at,
  end: row.end_at,
});

const insertOn = async (client: PoolClient, b: NewBooking): Promise<Result<StoredBooking, StoredBooking>> => {
  const bounds = [b.start.toISOString(), b.end.toISOString()];
  const overlap = await client.query<Row>(
    `SELECT ${COLUMNS} FROM booking
     WHERE room_id = $1 AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     ORDER BY start_at LIMIT 1`,
    [b.roomId, ...bounds],
  );
  if (overlap.rows[0] !== undefined) return { ok: false, error: toStoredBooking(overlap.rows[0]) };
  const inserted = await client.query<Row>(
    `INSERT INTO booking (room_id, account_id, title, start_at, end_at)
     VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz) RETURNING ${COLUMNS}`,
    [b.roomId, b.accountId, b.title, ...bounds],
  );
  return { ok: true, value: toStoredBooking(inserted.rows[0]) };
};

export function createBookingStore(pool: Pool): BookingStore {
  return {
    async insert(b) {
      const client = await pool.connect();
      let releaseWith: Error | undefined;
      try {
        await client.query("BEGIN");
        const result = await insertOn(client, b);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          releaseWith = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        }
        throw error;
      } finally {
        client.release(releaseWith);
      }
    },
    async overlapping(from, to) {
      const { rows } = await pool.query<Row>(
        `SELECT ${COLUMNS} FROM booking
         WHERE tstzrange(start_at, end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')
         ORDER BY start_at`,
        [sqlInstant(from), sqlInstant(to)],
      );
      return rows.map(toStoredBooking);
    },
    async notEndedOf(accountId, now) {
      const { rows } = await pool.query<Row>(
        `SELECT ${COLUMNS} FROM booking WHERE account_id = $1 AND end_at > $2::timestamptz ORDER BY start_at`,
        [accountId, sqlInstant(now)],
      );
      return rows.map(toStoredBooking);
    },
    async find(id) {
      if (!UUID.test(id)) return undefined;
      const { rows } = await pool.query<Row>(`SELECT ${COLUMNS} FROM booking WHERE id = $1`, [id]);
      return rows[0] === undefined ? undefined : toStoredBooking(rows[0]);
    },
    async remove() {
      throw new Error("not implemented");
    },
  };
}
