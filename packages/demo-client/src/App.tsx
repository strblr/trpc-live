import { useState } from "react";
import { patch } from "@n1ru4l/json-patch-plus";
import { cloneDeep } from "lodash-es";
import { trpc } from "./trpc";

export function App() {
  const [id, setId] = useState(1);

  const [data, setData] = useState<{
    id: string;
    name: string;
    counter: number;
  } | null>(null);

  const greeting = trpc.users.getUser.useSubscription(
    { id: id.toString() },
    {
      onStarted() {
        setData(null);
      },
      onData(delta) {
        setData(previous => {
          return patch({ left: cloneDeep(previous), delta });
        });
      }
    }
  );

  return (
    <>
      {greeting.error && (
        <div>
          <p>Error: {greeting.error.message}</p>
        </div>
      )}
      <div>
        {data?.id} - {data?.name} - {data?.counter}
      </div>
      <button onClick={() => setId(id + 1)}>Increment</button>
    </>
  );
}
