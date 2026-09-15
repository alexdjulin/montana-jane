import { createRouteHandler } from "@fal-ai/server-proxy/nextjs";

/**
 * The fal proxy. Everything the browser sends to fal goes through here so that
 * FAL_KEY stays on the server and never reaches client code.
 *
 * `route` is deprecated in this version of @fal-ai/server-proxy; createRouteHandler
 * is the supported entry point.
 */
export const { GET, POST, PUT } = createRouteHandler();
