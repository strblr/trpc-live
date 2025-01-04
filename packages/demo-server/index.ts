import { createBunServeHandler } from "trpc-bun-adapter";
import { appRouter } from "./router";

const server = Bun.serve(
  createBunServeHandler(
    {
      router: appRouter,
      responseMeta: () => ({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      })
    },
    { port: 2022, idleTimeout: 0 }
  )
);

console.info(
  `✅ demo-live tRpc server listening on http://localhost:${server.port}`
);
