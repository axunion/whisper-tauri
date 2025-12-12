import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name: name() }));
  }

  return (
    <main class="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-8">Whisper Tauri</h1>

      <form
        class="flex gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button
          type="submit"
          class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Greet
        </button>
      </form>
      <p class="mt-4 text-gray-600">{greetMsg()}</p>
    </main>
  );
}

export default App;
