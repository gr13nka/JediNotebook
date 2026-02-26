let intervalId: ReturnType<typeof setInterval> | null = null;
let startTime: number = 0;

self.onmessage = (e: MessageEvent) => {
  const { type, startedAt } = e.data;

  if (type === 'start') {
    startTime = new Date(startedAt).getTime();
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      self.postMessage({ type: 'tick', elapsed });
    }, 1000);

    // Immediately send current elapsed
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    self.postMessage({ type: 'tick', elapsed });
  }

  if (type === 'stop') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
