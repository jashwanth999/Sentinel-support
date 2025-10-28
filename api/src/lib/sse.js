export function initSse (res, { retry = 2000 } = {}) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write(`retry: ${retry}\n\n`);

  const send = (event, data) => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\n`);
    res.write(`data: ${payload}\n\n`);
  };

  const close = () => {
    res.end();
  };

  return { send, close };
}
