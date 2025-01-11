import {
  createTRPCReact,
  splitLink,
  unstable_httpBatchStreamLink,
  unstable_httpSubscriptionLink
} from "@trpc/react-query";
import type { AnyTRPCRouter } from "@trpc/server";
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { QueryClient } from "@tanstack/react-query";
import { Delta, patch } from "@n1ru4l/json-patch-plus";
import cloneDeep from "lodash.clonedeep";
import type { AppRouter } from "../../../packages/demo-server/router";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

export function jsonPatchLink<TRouter extends AnyTRPCRouter = AnyTRPCRouter>(
  livePaths?: string[]
): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (
        op.type !== "subscription" ||
        (livePaths && !livePaths.includes(op.path))
      ) {
        return next(op);
      }

      return observable(observer => {
        let data: unknown = null;

        const subscription = next(op).subscribe({
          next(envelope) {
            const { result } = envelope;

            if (result.type && result.type !== "data") {
              return observer.next(envelope);
            } else {
              data = patch({
                left: cloneDeep(data),
                delta: result.data as Delta
              });

              observer.next({ ...envelope, result: { ...result, data } });
            }
          },
          error: observer.error,
          complete: observer.complete
        });

        return () => {
          subscription.unsubscribe();
        };
      });
    };
  };
}

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: op => op.type === "subscription",
      true: [
        jsonPatchLink(["users.getUser"]),
        unstable_httpSubscriptionLink({
          url: "http://localhost:2022"
        })
      ],
      false: unstable_httpBatchStreamLink({
        url: "http://localhost:2022"
      })
    })
  ]
});
