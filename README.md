# trpc-live

A simple live query solution for [tRPC](https://trpc.io/) applications. Real-time client updates and server-side invalidation with minimal setup. Implemented on top of tRPC subscriptions.

## Concepts

- **Live query**: A live query is a query that is re-run when the data it depends on changes.
- **Live store**: Manages live query subscribers and invalidations on the server. The current implementation is in-memory. Other stores can be implemented in the future (Redis, etc.).

Live queries put the burden on the server to refresh client queries when data changes. This avoids patterns like polling or combining a regular query with a "change" subscription. In practice, `trpc-live` implements live queries on top of tRPC subscriptions. Clients fire a subscription and get an initial result, essentially acting as a regular query. In the background, the server registers the subscription in a store using keys. These keys identify the data that was subscribed to. When the data changes, the server can trigger a targeted re-run by using the keys. The subscription resolver is then re-run and the clients receive the updated result.

## Installation

Install `trpc-live`:

```bash
npm install trpc-live
yarn add trpc-live
bun add trpc-live
```

## Usage

### Server setup

Start by creating a single live store. Then create tRPC subscription resolvers with the store's `live` method:

```typescript
import { router, publicProcedure } from "./trpc";
import { InMemoryLiveStore } from "trpc-live";

const liveStore = new InMemoryLiveStore();

export const appRouter = router({
  getPost: publicProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .subscription(
      liveStore.live({
        key: ({ input }) => `post:${input.id}`, // Define a key
        resolver: async ({ input }) => {
          const post = await fetchPostFromDatabase(input.id); // Get data
          return {
            id: input.id,
            content: post.content,
            likes: post.likes
          };
        }
      })
    ),

  likePost: publicProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input }) => {
      await likePostInDatabase(input.id); // Mutate data
      liveStore.invalidate(`post:${input.id}`); // Invalidate using the key
      return { success: true };
    })
});
```

In this example, when a post is liked, all subscribers to that post will receive an update.

### Client setup

On the client, live queries are just regular tRPC subscriptions.

Don't forget to configure your tRPC client to support subscriptions:

```typescript
export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: op => op.type === "subscription",
      true: unstable_httpSubscriptionLink({ url: "http://localhost:2022" }),
      false: unstable_httpBatchStreamLink({ url: "http://localhost:2022" })
    })
  ]
});
```

Refer to the official [tRPC docs](https://trpc.io/) for more information.

For React, simply use the `useSubscription` hook:

```typescript
export function Post({ id }: { id: string }) {
  const post = trpc.getPost.useSubscription({ id });
  const like = trpc.likePost.useMutation();

  if (!post.data) return <div>Loading...</div>;

  return (
    <div>
      <p>{post.data.content}</p>
      <p>Likes: {post.data.likes}</p>
      <button onClick={() => like.mutate({ id })}>Like</button>
    </div>
  );
}
```

When you or someone else viewing the same post clicks the "Like" button, the post will update for everyone.

## Invalidation

The `invalidate` method can be called from anywhere. It will re-run all live queries registered for the given key. In the previous example, we call it in the mutation resolver after updating the data. Here is an example of calling it from a Mongoose hook:

```typescript
postSchema.post("save", async function (post) {
  liveStore.invalidate(`thread:${post.threadId}`);
});
```

You can pass multiple keys to `invalidate`:

```typescript
liveStore.invalidate(["post:1", "post:2"]); // Invalidate post 1 and 2
```

## Error handling

Errors are handled just like regular tRPC errors.

```typescript
liveStore.live({
  key: ({ input }) => `post:${input.id}`,
  resolver: async ({ input }) => {
    const post = await fetchPostFromDatabase(input.id);
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Post not found"
      });
    }
    return post;
  }
});
```

```typescript
const post = trpc.getPost.useSubscription({ id: "1" });

if (post.error) {
  return <div>Error: {post.error.message}</div>;
}
```

## Key helper

`trpc-live` provides a `key` helper function to generate stable string keys from arguments. You are not required to use it but it can be useful for live query keys that depend on multiple arguments.

```typescript
import { key } from "trpc-live";

const key1 = key("post");
const key2 = key("post", { id: postId, version });
const key3 = key({ query: "post", id: postId, version });
const key4 = key(["post", postId, version]);
```

Usage example:

```typescript
liveStore.live({
  key: ({ input }) => key("post", { id: input.id, version: input.version }),
  resolver: async ({ input }) => {
    // ...
  }
});

liveStore.invalidate(key("post", { id: "1", version: "1" }));
```

## Multiple keys

A live query can register multiple keys. This is useful if you want to be able to invalidate the query in different ways. For example, you might want to invalidate a post by its id, or all posts regardless of id.

```typescript
liveStore.live({
  key: ({ input }) => ["post", `post:${input.id}`],
  resolver: async ({ input }) => {
    // ...
  }
});

liveStore.invalidate("post"); // Invalidate all posts
liveStore.invalidate("post:1"); // Invalidate post 1
```

## Count subscribers

You can get the number of active subscribers for a given set of keys:

```typescript
liveStore.count("post");
liveStore.count(["post:1", "post:2"]);
```

## API reference

### `InMemoryLiveStore`

Manages subscriptions and invalidations for live data.

#### Methods

- `invalidate(key: string | string[]): void`

  Invalidates specific keys, triggering corresponding live queries to be re-run.

- `count(key: string | string[]): number`

  Returns the number of active subscribers for a given set of keys.

- `live(options: LiveOptions): SubscriptionResolver`

  Creates a "live query" subscription resolver.

  - `LiveOptions<...>` interface
    - `key: string | string[] | ((opts: ProcedureResolverOptions<...>) => string | string[])`
    - `resolver: (opts: ProcedureResolverOptions<...>) => TOutput | Promise<TOutput>`

### `key(...args: any[]): string`

Generates a stable key from provided arguments.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any features, bug fixes, or improvements.

## License

[MIT](LICENSE)
