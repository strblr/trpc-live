import {
  createTRPCReact,
  loggerLink,
  splitLink,
  unstable_httpBatchStreamLink,
  unstable_httpSubscriptionLink
} from "@trpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "../../../packages/demo-server/router";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

export const trpcClient = trpc.createClient({
  links: [
    loggerLink(),
    splitLink({
      condition: op => op.type === "subscription",
      true: unstable_httpSubscriptionLink({
        url: "http://localhost:2022"
      }),
      false: unstable_httpBatchStreamLink({
        url: "http://localhost:2022"
      })
    })
  ]
});
