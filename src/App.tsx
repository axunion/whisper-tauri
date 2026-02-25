import { Route, Router } from "@solidjs/router";
import { lazy, Show } from "solid-js";
import { Dashboard } from "~/components/dashboard";
import { AppLayout } from "~/components/layout";

const Transcription = lazy(() => import("~/pages/Transcription"));
const History = lazy(() => import("~/pages/History"));
const Settings = lazy(() => import("~/pages/Settings"));
const DevMenu = import.meta.env.DEV
  ? lazy(() => import("~/pages/DevMenu"))
  : undefined;

function App() {
  return (
    <Router root={AppLayout}>
      <Route path="/" component={Dashboard} />
      <Route path="/transcription" component={Transcription} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Show when={DevMenu}>
        {(Comp) => <Route path="/dev" component={Comp()} />}
      </Show>
    </Router>
  );
}

export default App;
