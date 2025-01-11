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
import { patch } from "@n1ru4l/json-patch-plus";
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

function jsonPatchLink<TRouter extends AnyTRPCRouter>(
  includePaths?: string[]
): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (includePaths && !includePaths.includes(op.path)) {
        return next(op);
      }

      return observable(observer => {
        let data: unknown = null;

        return next(op).subscribe({
          error: observer.error,
          complete: observer.complete,
          next(envelope) {
            const { result } = envelope;
            if (result.type && result.type !== "data") {
              return observer.next(envelope);
            } else {
              const [delta, init] = result.data as any;
              if (init) data = null;
              data = patch({ left: cloneDeep(data), delta });
              observer.next({ ...envelope, result: { ...result, data } });
            }
          }
        });
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
