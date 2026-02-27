import Bottleneck from "bottleneck";

const limiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 200,
  highWater: 20,
  strategy: Bottleneck.strategy.OVERFLOW,
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withRateLimitAndRetry<T>(fn: () => Promise<T>, opts?: { maxRetries?: number }) {
  const maxRetries = opts?.maxRetries ?? 5;

  try {
    return limiter.schedule(async () => {
      let attempt = 0;

      for(;;) {
        try {
          return await fn();
        } catch (err) {
          const status = err?.status ?? err?.response?.status;

          if (status !== 429 || attempt >= maxRetries) throw err;

          const baseMs = 250 * Math.pow(2, attempt);
          const jitterMs = Math.floor(Math.random() * 250);
          const waitMs = baseMs + jitterMs;

          attempt++;
          await sleep(waitMs);
        }
      }
    });
  } catch (err) {
    const msg = String(err?.message ?? '');
    const isOverflow =
      err?.name === 'BottleneckError' ||
      msg.toLowerCase().includes('overflow') ||
      msg.toLowerCase().includes('highwater');

    if (isOverflow) {
      const e: Error & { status?: number } = new Error('Rate limit queue overflow');
      e.status = 429;
      throw e;
    }

    throw err;
  }
}