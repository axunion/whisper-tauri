import { MemoryRouter, Route, useLocation } from "@solidjs/router";
import { fireEvent, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { ja } from "~/i18n/dictionaries/ja";
import { renderWithI18n } from "~/test/helpers";
import { SetupBanner } from "../SetupBanner";

const readiness = vi.hoisted(() => ({
  whisper: true,
  ffmpeg: true,
  ai: true,
}));

vi.mock("~/primitives/createWhisper", () => ({
  createWhisper: () => ({
    loadModels: () => Promise.resolve(),
    hasDownloadedModel: () => readiness.whisper,
  }),
}));

vi.mock("~/primitives/createFfmpegDownloader", () => ({
  createFfmpegDownloader: () => ({
    checkStatus: () => Promise.resolve(),
    isBundled: () => readiness.ffmpeg,
  }),
}));

vi.mock("~/primitives/createTextProcessing", () => ({
  createTextProcessing: () => ({
    checkServer: () => Promise.resolve(),
    loadModels: () => Promise.resolve(),
    isReady: () => readiness.ai,
  }),
}));

/** Shows which settings section the banner navigated to. */
function Settings() {
  const location = useLocation<{ section?: string }>();
  return <p data-testid="section">{location.state?.section ?? "none"}</p>;
}

function renderBanner(ready: {
  whisper: boolean;
  ffmpeg: boolean;
  ai: boolean;
}) {
  Object.assign(readiness, ready);
  renderWithI18n(() => (
    <MemoryRouter>
      <Route path="/" component={SetupBanner} />
      <Route path="/settings" component={Settings} />
    </MemoryRouter>
  ));
}

describe("SetupBanner", () => {
  it("leads to the models section when no Whisper model is downloaded", async () => {
    renderBanner({ whisper: false, ffmpeg: false, ai: false });

    fireEvent.click(await screen.findByText(ja.dashboard.setupModelHint));

    expect(await screen.findByTestId("section")).toHaveTextContent(
      "settings-models",
    );
  });

  it("leads to the FFmpeg section when the model is ready but FFmpeg is missing", async () => {
    renderBanner({ whisper: true, ffmpeg: false, ai: false });

    fireEvent.click(await screen.findByText(ja.dashboard.setupFfmpegHint));

    expect(await screen.findByTestId("section")).toHaveTextContent(
      "settings-ffmpeg",
    );
  });

  it("leads to the AI section when only the text model is missing", async () => {
    renderBanner({ whisper: true, ffmpeg: true, ai: false });

    fireEvent.click(await screen.findByText(ja.dashboard.setupAiHint));

    expect(await screen.findByTestId("section")).toHaveTextContent(
      "settings-ai",
    );
  });

  it("stays hidden when everything is ready", async () => {
    renderBanner({ whisper: true, ffmpeg: true, ai: true });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.queryByText(ja.dashboard.setupModelHint),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(ja.dashboard.setupFfmpegHint),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(ja.dashboard.setupAiHint),
    ).not.toBeInTheDocument();
  });
});
