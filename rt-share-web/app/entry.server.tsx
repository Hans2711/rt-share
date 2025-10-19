import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext,
) {
  // Use React 19 ReadableStream-based SSR compatible with Bun
  const userAgent = request.headers.get("user-agent") || "";
  const waitForAll = (userAgent && isbot(userAgent)) || routerContext.isSpaMode;

  // Render to a WHATWG ReadableStream
  const stream: any = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
      onError(err: unknown) {
        // Ensure a 500 status on SSR errors surfaced after shell render
        try { console.error(err); } catch {}
        responseStatusCode = 500;
      },
    },
  );

  // Bots/SPAs should wait for the full content
  try {
    if (waitForAll && stream?.allReady) {
      await Promise.race([
        stream.allReady,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SSR timeout")), streamTimeout + 1000)),
      ]);
    }
  } catch {
    // ignore; we'll still stream what we have
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(stream, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

