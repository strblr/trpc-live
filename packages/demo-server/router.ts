import z from "zod";
import { publicProcedure, router } from "./trpc";
import { InMemoryLiveStore, key } from "trpc-live";

let counter = 0;
const liveStore = new InMemoryLiveStore();

export const appRouter = router({
  users: {
    getUser: publicProcedure
      .input(
        z.object({
          id: z.string()
        })
      )
      .subscription(
        liveStore.live({
          key: ({ input }) => [
            key("getUser"),
            key("getUser", { id: input.id })
          ],
          resolver: async ({ input }) => {
            return {
              id: input.id,
              name: "John Doe",
              counter
            };
          }
        })
      )
  }
});

setInterval(() => {
  counter++;
  liveStore.invalidate(key("getUser"));
}, 600);

export type AppRouter = typeof appRouter;
