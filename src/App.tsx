import { Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";
import { Dashboard } from "~/components/dashboard";
import { AppLayout } from "~/components/layout";

const Transcription = lazy(() => import("~/pages/Transcription"));
const Settings = lazy(() => import("~/pages/Settings"));
const DevMenu = lazy(() => import("~/pages/DevMenu"));

function App() {
  return (
    <Router root={AppLayout}>
      <Route path="/" component={Dashboard} />
      <Route path="/transcription" component={Transcription} />
      <Route path="/settings" component={Settings} />
      <Route path="/dev" component={DevMenu} />
    </Router>
  );
}

export default App;
