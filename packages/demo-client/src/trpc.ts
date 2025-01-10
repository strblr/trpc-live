import {
  createTRPCReact,
  splitLink,
  unstable_httpBatchStreamLink,
  unstable_httpSubscriptionLink
} from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "../../../packages/demo-server/router";

export const trpc = createTRPCReact<AppRouter>();

export type inferAsyncIterableYield<T> = T extends AsyncIterable<infer U>
  ? U
  : never;

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

export const trpcClient = trpc.createClient({
  links: [
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
