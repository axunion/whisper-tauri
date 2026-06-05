import {
  FiCheck,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiLink,
  FiTrash2,
  FiX,
} from "solid-icons/fi";
import { SiNotion } from "solid-icons/si";
import { createSignal, onMount, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { HelpHint } from "~/components/ui/HelpHint";
import { SectionRow } from "~/components/ui/SectionRow";
import { useI18n } from "~/i18n";
import { parseError } from "~/lib/errors";
import { cn } from "~/lib/utils";
import { createNotionSettings } from "~/primitives/createNotionSettings";

export default function NotionIntegration() {
  const { t } = useI18n();
  const notion = createNotionSettings();

  const [editMode, setEditMode] = createSignal(false);
  const [tokenInput, setTokenInput] = createSignal("");
  const [databaseIdInput, setDatabaseIdInput] = createSignal("");
  const [showToken, setShowToken] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = createSignal(false);

  onMount(() => {
    notion.load();
  });

  function startEdit() {
    setTokenInput(notion.token() ?? "");
    setDatabaseIdInput(notion.databaseId() ?? "");
    setShowToken(false);
    setErrorMessage(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setShowToken(false);
    setErrorMessage(null);
  }

  const canSubmit = () =>
    !testing() &&
    tokenInput().trim().length > 0 &&
    databaseIdInput().trim().length > 0;

  async function handleConnect() {
    if (!canSubmit()) return;
    setTesting(true);
    setErrorMessage(null);
    const trimmedToken = tokenInput().trim();
    const trimmedDbId = databaseIdInput().trim();
    try {
      const info = await notion.testConnection(trimmedToken, trimmedDbId);
      await notion.update({
        enabled: true,
        token: trimmedToken,
        databaseId: trimmedDbId,
        titleProperty: info.titleProperty,
      });
      setEditMode(false);
      setShowToken(false);
    } catch (e) {
      const err = parseError(e);
      setErrorMessage(
        t("settings.notionConnectionFailed", {
          message: err.details ?? t(err.messageKey),
        }),
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnectOpen(false);
    await notion.update({
      enabled: false,
      token: null,
      databaseId: null,
      titleProperty: null,
    });
    cancelEdit();
  }

  const inputClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Card>
      <CardHeader>
        <CardTitleWithIcon icon={() => <SiNotion class="size-4" />}>
          {t("settings.notionIntegration")}
        </CardTitleWithIcon>
      </CardHeader>
      <CardContent class="space-y-4">
        <Show when={!editMode()}>
          <Show
            when={notion.isConfigured()}
            fallback={
              <SectionRow
                title={
                  <span class="text-muted-foreground">
                    {t("settings.notionNotConnected")}
                  </span>
                }
                right={
                  <Button size="sm" class="w-28" onClick={startEdit}>
                    <FiLink class="size-4" />
                    {t("settings.notionConnect")}
                  </Button>
                }
              />
            }
          >
            <SectionRow
              title={
                <>
                  {t("settings.notionConnected")}
                  <FiCheck class="size-5 text-emerald-500" />
                </>
              }
              right={
                <div class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    class="w-28"
                    onClick={startEdit}
                  >
                    <FiEdit2 class="size-4" />
                    {t("settings.notionEditConnection")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    class="w-28"
                    onClick={() => setDisconnectOpen(true)}
                  >
                    <FiTrash2 class="size-4" />
                    {t("settings.notionDisconnect")}
                  </Button>
                </div>
              }
            />
          </Show>
        </Show>

        <Show when={editMode()}>
          <div class="space-y-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm font-medium">
                {t("settings.notionToken")}
                <HelpHint term="notionToken" />
              </div>
              <div class="relative">
                <input
                  type={showToken() ? "text" : "password"}
                  value={tokenInput()}
                  onInput={(e) => setTokenInput(e.currentTarget.value)}
                  class={cn(inputClass, "pr-10")}
                  autocomplete="off"
                  spellcheck={false}
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowToken(!showToken())}
                  aria-label={
                    showToken()
                      ? t("settings.notionHideToken")
                      : t("settings.notionShowToken")
                  }
                >
                  <Show when={showToken()} fallback={<FiEye class="size-4" />}>
                    <FiEyeOff class="size-4" />
                  </Show>
                </button>
              </div>
              <p class="text-xs text-muted-foreground">
                {t("settings.notionTokenStorageNote")}
              </p>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm font-medium">
                {t("settings.notionDatabaseId")}
                <HelpHint term="notionDatabaseId" />
              </div>
              <input
                type="text"
                value={databaseIdInput()}
                onInput={(e) => setDatabaseIdInput(e.currentTarget.value)}
                class={inputClass}
                autocomplete="off"
                spellcheck={false}
              />
              <p class="text-xs text-muted-foreground">
                {t("settings.notionDatabaseIdHelp")}
              </p>
            </div>

            <Show when={errorMessage()}>
              {(msg) => (
                <div class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {msg()}
                </div>
              )}
            </Show>

            <div class="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelEdit}>
                <FiX class="size-4" />
                {t("common.cancel")}
              </Button>
              <Button disabled={!canSubmit()} onClick={handleConnect}>
                <FiLink class="size-4" />
                {testing()
                  ? t("settings.notionTesting")
                  : t("settings.notionConnectAndTest")}
              </Button>
            </div>
          </div>
        </Show>
      </CardContent>

      <AlertDialog open={disconnectOpen()} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("settings.notionDisconnectConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("settings.notionDisconnectConfirmDescription")}
          </AlertDialogDescription>
          <div class="flex justify-end gap-2">
            <Button
              variant="outline"
              class="w-32"
              onClick={() => setDisconnectOpen(false)}
            >
              <FiX class="size-4" />
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              class="w-32"
              onClick={() => {
                void handleDisconnect();
              }}
            >
              <FiTrash2 class="size-4" />
              {t("settings.notionDisconnect")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
