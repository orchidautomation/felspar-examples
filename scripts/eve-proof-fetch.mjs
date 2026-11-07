// Preloaded only in the proof's Eve processes. This limits global fetch;
// it is not a sandbox for arbitrary Node code or other network APIs.
export function localFetch(fetchImpl) {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    ) {
      throw new Error("Eve proof blocked a non-loopback fetch");
    }
    // A local response must not redirect the underlying fetch off-machine.
    return fetchImpl(input, { ...init, redirect: "error" });
  };
}

globalThis.fetch = localFetch(globalThis.fetch);
