import { useState } from "react";
import { trpc } from "./trpc";

export function App() {
  const [id, setId] = useState(1);
  const greeting = trpc.users.getUser.useSubscription({ id: id.toString() });

  return (
    <>
      {greeting.error && (
        <div>
          <p>Error: {greeting.error.message}</p>
        </div>
      )}
      <div>
        {greeting.data?.id} - {greeting.data?.name} - {greeting.data?.counter}
      </div>
      <button onClick={() => setId(id + 1)}>Increment</button>
    </>
  );
}
