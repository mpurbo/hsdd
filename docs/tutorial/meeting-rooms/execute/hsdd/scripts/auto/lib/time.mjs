// Timestamps: UTC, second precision, trailing Z. There is no clock override (A-3).

export const STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const nowStamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const checked = (stamp) => {
  if (typeof stamp !== "string" || !STAMP_RE.test(stamp)) throw new Error(`not a timestamp: ${String(stamp)}`);
  return stamp;
};

export const stampMs = (stamp) => {
  const ms = Date.parse(checked(stamp));
  if (Number.isNaN(ms)) throw new Error(`not a timestamp: ${stamp}`);
  return ms;
};

export const dateOf = (stamp) => checked(stamp).slice(0, 10);
