let intervalId: ReturnType<typeof setInterval> | null = null;
let startTime: number = 0;

self.onmessage = (e: MessageEvent) => {
  const { type, startedAt } = e.data;

  if (type === 'start') {
    startTime = new Date(startedAt).getTime();
    if (intervalId) clearInterval(intervalId);

    // Clamped at zero: a startedAt written by a device whose clock runs ahead
    // would otherwise broadcast a negative elapsed to the whole app.
    const currentElapsed = () =>
      Math.max(0, Math.floor((Date.now() - startTime) / 1000));

    intervalId = setInterval(() => {
      self.postMessage({ type: 'tick', elapsed: currentElapsed() });
    }, 1000);

    // Immediately send current elapsed
    self.postMessage({ type: 'tick', elapsed: currentElapsed() });
  }

  if (type === 'stop') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
