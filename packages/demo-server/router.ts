import { InMemoryLiveStore, key } from "trpc-live";
import { diff } from "@n1ru4l/json-patch-plus";
import z from "zod";
import { publicProcedure, router } from "./trpc";

let counter = 0;
const liveStore = new InMemoryLiveStore();

function jsonDiff<TOpts, T>(fn: (opts: TOpts) => AsyncGenerator<T>) {
  return async function* (opts: TOpts) {
    let previous: unknown = null;
    for await (const data of fn(opts)) {
      const delta = diff({ left: previous, right: data });
      yield delta as T;
      previous = data;
    }
  };
}

export const appRouter = router({
  users: {
    getUser: publicProcedure
      .input(
        z.object({
          id: z.string()
        })
      )
      .subscription(
        jsonDiff(
          liveStore.live({
            key: () => [key("getUser")],
            resolver: async ({ input }) => {
              return {
                id: input.id,
                name: "John Doe",
                counter
              };
            }
          })
        )
      )
  }
});

setInterval(() => {
  counter++;
  liveStore.invalidate(key("getUser"));
}, 600);

export type AppRouter = typeof appRouter;
