import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const logRate = new Ratelimit({
  redis,
  analytics: true,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "shooter:loglimit",
});

export const delAccountRate = new Ratelimit({
  redis,
  analytics: true,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "shooter:loglimit",
});

export const sessionRate = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "7 d"),
  prefix: "shooter:session",
});
