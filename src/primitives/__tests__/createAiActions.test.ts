import { createRoot, createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseError } from "~/lib/errors";
import { toast } from "~/lib/toast";
import type { StructuredSummary, TextModelInfo } from "~/types";
import type { AppError } from "~/types/errors";
import {
  type CreateAiActionsOptions,
  createAiActions,
} from "../createAiActions";
import type { AiSession } from "../createAiSession";
import type { createTextProcessing } from "../createTextProcessing";

// Toast rendering is a view concern; mock the facade so completed-action
// notifications stay observable without pulling in UI machinery.
vi.mock("~/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const summaryFixture: StructuredSummary = {
  headline: "Headline",
  tldr: "Recap.",
  keywords: [],
  actionItems: [],
  keyPoints: [],
};

/**
 * Builds a session whose given operation fails: it records the error (via a
 * real signal, mirroring createAiSession's setError) and resolves to null.
 * The AppError comes from the production parseError mapping so fixtures
 * cannot drift from src/lib/errors.ts.
 */
function makeFailingSession(
  operation: "summarize" | "cleanText" | "generateTitle",
  rustError: string,
): AiSession {
  const [error, setError] = createSignal<AppError | null>(null);
  return makeSession({
    error,
    [operation]: vi.fn(async () => {
      setError(parseError(rustError));
      return null;
    }),
  });
}

function makeModel(downloaded: boolean): TextModelInfo {
  return {
    id: "gemma-4-e2b",
    name: "Gemma",
    size: "2.7GB",
    sizeBytes: 2_700_000_000,
    description: "Test model",
    downloaded,
  };
}

function makeTp(
  opts: { serverAvailable?: boolean; models?: TextModelInfo[] } = {},
): ReturnType<typeof createTextProcessing> {
  const fake = {
    serverAvailable: () => opts.serverAvailable ?? true,
    models: () => opts.models ?? [makeModel(true)],
  };
  return fake as unknown as ReturnType<typeof createTextProcessing>;
}

function makeSession(overrides: Partial<AiSession> = {}): AiSession {
  return {
    summaryResult: () => null,
    cleanTextResult: () => null,
    titleResult: () => null,
    isProcessing: () => false,
    isGeneratingTitle: () => false,
    isLoaded: () => true,
    currentOperation: () => null,
    inferenceProgress: () => null,
    error: () => null,
    summarize: vi.fn(async () => summaryFixture),
    cleanText: vi.fn(async () => "cleaned text"),
    generateTitle: vi.fn(async () => "Generated title"),
    cancel: vi.fn(async () => {}),
    clearError: vi.fn(),
    ...overrides,
  };
}

function makeOptions(
  overrides: Partial<CreateAiActionsOptions> = {},
): CreateAiActionsOptions {
  return {
    session: makeSession(),
    tp: makeTp(),
    getResultText: () => "transcribed text",
    onOpenSummary: vi.fn(),
    onOpenCleanText: vi.fn(),
    t: (key) => key,
    ...overrides,
  };
}

describe("createAiActions", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  describe("isReady", () => {
    it("should be ready when the server is available and a model is downloaded", () => {
      createRoot((dispose) => {
        const actions = createAiActions(makeOptions());
        expect(actions.isReady()).toBe(true);
        dispose();
      });
    });

    it("should not be ready when the server is unavailable", () => {
      createRoot((dispose) => {
        const actions = createAiActions(
          makeOptions({ tp: makeTp({ serverAvailable: false }) }),
        );
        expect(actions.isReady()).toBe(false);
        dispose();
      });
    });

    it("should not be ready when no model is downloaded", () => {
      createRoot((dispose) => {
        const actions = createAiActions(
          makeOptions({ tp: makeTp({ models: [makeModel(false)] }) }),
        );
        expect(actions.isReady()).toBe(false);
        dispose();
      });
    });
  });

  describe("prereq guard", () => {
    it("should open the prereq dialog instead of summarizing when not ready", () => {
      createRoot((dispose) => {
        const actions = createAiActions(
          makeOptions({ tp: makeTp({ serverAvailable: false }) }),
        );

        actions.onSummarize();

        expect(actions.showPrereqDialog()).toBe(true);
        expect(actions.pendingAction()).toBeNull();
        dispose();
      });
    });

    it("should open the prereq dialog for title generation when not ready", () => {
      createRoot((dispose) => {
        const actions = createAiActions(
          makeOptions({ tp: makeTp({ models: [makeModel(false)] }) }),
        );

        actions.onGenerateTitle();

        expect(actions.showPrereqDialog()).toBe(true);
        dispose();
      });
    });

    it("should allow dismissing the prereq dialog", () => {
      createRoot((dispose) => {
        const actions = createAiActions(
          makeOptions({ tp: makeTp({ serverAvailable: false }) }),
        );

        actions.onCleanText();
        expect(actions.showPrereqDialog()).toBe(true);

        actions.setShowPrereqDialog(false);
        expect(actions.showPrereqDialog()).toBe(false);
        dispose();
      });
    });
  });

  describe("onSummarize", () => {
    it("should open the summary view and summarize the result text immediately", async () => {
      await createRoot(async (dispose) => {
        const session = makeSession();
        const onOpenSummary = vi.fn();
        const actions = createAiActions(
          makeOptions({ session, onOpenSummary }),
        );

        actions.onSummarize();
        await flushPromises();

        expect(onOpenSummary).toHaveBeenCalled();
        expect(session.summarize).toHaveBeenCalledWith("transcribed text");
        expect(toast.success).toHaveBeenCalledWith(
          "textProcessing.summarizeCompletedToast",
        );
        dispose();
      });
    });

    it("should hold the action as pending when a summary already exists", () => {
      createRoot((dispose) => {
        const session = makeSession({ summaryResult: () => summaryFixture });
        const actions = createAiActions(makeOptions({ session }));

        actions.onSummarize();

        expect(actions.pendingAction()).toBeInstanceOf(Function);
        expect(actions.showPrereqDialog()).toBe(false);
        dispose();
      });
    });

    it("should run the summarize action after confirming overwrite", async () => {
      await createRoot(async (dispose) => {
        const session = makeSession({ summaryResult: () => summaryFixture });
        const onOpenSummary = vi.fn();
        const actions = createAiActions(
          makeOptions({ session, onOpenSummary }),
        );

        actions.onSummarize();
        actions.confirmOverwrite();
        await flushPromises();

        expect(onOpenSummary).toHaveBeenCalled();
        expect(session.summarize).toHaveBeenCalledWith("transcribed text");
        expect(actions.pendingAction()).toBeNull();
        dispose();
      });
    });
  });

  describe("error surfacing", () => {
    it("should toast the mapped message when summarize fails", async () => {
      await createRoot(async (dispose) => {
        const session = makeFailingSession(
          "summarize",
          "Inference error: boom",
        );
        const actions = createAiActions(makeOptions({ session }));
        // Let the effect's initial tracking run flush before triggering.
        await flushPromises();

        actions.onSummarize();
        await flushPromises();

        expect(toast.error).toHaveBeenCalledWith("errors.inferenceError");
        expect(toast.success).not.toHaveBeenCalled();
        dispose();
      });
    });

    it("should toast the mapped message when clean text fails", async () => {
      await createRoot(async (dispose) => {
        const session = makeFailingSession(
          "cleanText",
          "Inference error: boom",
        );
        const actions = createAiActions(makeOptions({ session }));
        // Let the effect's initial tracking run flush before triggering.
        await flushPromises();

        actions.onCleanText();
        await flushPromises();

        expect(toast.error).toHaveBeenCalledWith("errors.inferenceError");
        dispose();
      });
    });

    it("should stay silent when the failure is a user cancellation", async () => {
      await createRoot(async (dispose) => {
        const session = makeFailingSession("summarize", "Inference cancelled");
        const actions = createAiActions(makeOptions({ session }));
        // Let the effect's initial tracking run flush before triggering.
        await flushPromises();

        actions.onSummarize();
        await flushPromises();

        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        dispose();
      });
    });

    it("should toast the mapped message when title generation fails", async () => {
      await createRoot(async (dispose) => {
        const session = makeFailingSession(
          "generateTitle",
          "Inference error: boom",
        );
        const actions = createAiActions(makeOptions({ session }));
        // Let the effect's initial tracking run flush before triggering.
        await flushPromises();

        actions.onGenerateTitle();
        await flushPromises();

        expect(toast.error).toHaveBeenCalledWith("errors.inferenceError");
        dispose();
      });
    });
  });

  describe("onCleanText", () => {
    it("should open the clean-text view and clean the result text immediately", async () => {
      await createRoot(async (dispose) => {
        const session = makeSession();
        const onOpenCleanText = vi.fn();
        const actions = createAiActions(
          makeOptions({ session, onOpenCleanText }),
        );

        actions.onCleanText();
        await flushPromises();

        expect(onOpenCleanText).toHaveBeenCalled();
        expect(session.cleanText).toHaveBeenCalledWith("transcribed text");
        expect(toast.success).toHaveBeenCalledWith(
          "textProcessing.cleanTextCompletedToast",
        );
        dispose();
      });
    });

    it("should hold the action as pending when cleaned text already exists", () => {
      createRoot((dispose) => {
        const session = makeSession({ cleanTextResult: () => "old cleaned" });
        const actions = createAiActions(makeOptions({ session }));

        actions.onCleanText();

        expect(actions.pendingAction()).toBeInstanceOf(Function);
        dispose();
      });
    });
  });

  describe("onGenerateTitle", () => {
    it("should toggle the generating flag and deliver the generated title", async () => {
      await createRoot(async (dispose) => {
        const generatingStates: boolean[] = [];
        let receivedTitle: string | undefined;
        const actions = createAiActions(
          makeOptions({
            onGeneratingTitleChange: (generating) => {
              generatingStates.push(generating);
            },
            onTitleGenerated: (title) => {
              receivedTitle = title;
            },
          }),
        );

        actions.onGenerateTitle();
        await flushPromises();

        expect(generatingStates).toEqual([true, false]);
        expect(receivedTitle).toBe("Generated title");
        expect(toast.success).toHaveBeenCalledWith(
          "textProcessing.titleGeneratedToast",
        );
        dispose();
      });
    });

    it("should clear the generating flag and deliver no title when generation yields null", async () => {
      await createRoot(async (dispose) => {
        const generatingStates: boolean[] = [];
        let receivedTitle: string | undefined;
        const session = makeSession({
          generateTitle: vi.fn(async () => null),
        });
        const actions = createAiActions(
          makeOptions({
            session,
            onGeneratingTitleChange: (generating) => {
              generatingStates.push(generating);
            },
            onTitleGenerated: (title) => {
              receivedTitle = title;
            },
          }),
        );

        actions.onGenerateTitle();
        await flushPromises();

        expect(generatingStates).toEqual([true, false]);
        expect(receivedTitle).toBeUndefined();
        dispose();
      });
    });

    it("should work without the optional title callbacks", async () => {
      await createRoot(async (dispose) => {
        const session = makeSession();
        const actions = createAiActions(makeOptions({ session }));
        // Let the effect's initial tracking run flush before triggering.
        await flushPromises();

        actions.onGenerateTitle();
        await flushPromises();

        expect(session.generateTitle).toHaveBeenCalledWith("transcribed text");
        dispose();
      });
    });
  });

  describe("overwrite confirmation", () => {
    it("should discard the pending action on cancel", () => {
      createRoot((dispose) => {
        const session = makeSession({ summaryResult: () => summaryFixture });
        const actions = createAiActions(makeOptions({ session }));

        actions.onSummarize();
        expect(actions.pendingAction()).toBeInstanceOf(Function);

        actions.cancelPending();
        expect(actions.pendingAction()).toBeNull();
        dispose();
      });
    });
  });
});
