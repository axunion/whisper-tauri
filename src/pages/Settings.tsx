import { createSignal, For, onMount, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/AlertDialog";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { Label } from "~/components/ui/Label";
import { Progress } from "~/components/ui/Progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { Separator } from "~/components/ui/Separator";
import { createSettings } from "~/primitives/createSettings";
import { applyTheme } from "~/primitives/createTheme";
import { createWhisper } from "~/primitives/createWhisper";
import type { AppSettings } from "~/types";

const LANGUAGE_OPTIONS = [
  { value: "ja", label: "\u65E5\u672C\u8A9E" },
  { value: "en", label: "English" },
] as const;

const OUTPUT_FORMAT_OPTIONS = [
  { value: "txt", label: "\u30C6\u30AD\u30B9\u30C8 (.txt)" },
  { value: "srt", label: "SRT (.srt)" },
  { value: "vtt", label: "VTT (.vtt)" },
] as const;

const THEME_OPTIONS = [
  { value: "light", label: "\u30E9\u30A4\u30C8" },
  { value: "dark", label: "\u30C0\u30FC\u30AF" },
  { value: "system", label: "\u30B7\u30B9\u30C6\u30E0" },
] as const;

type OptionItem = { value: string; label: string };

export default function Settings() {
  const settings = createSettings();
  const whisper = createWhisper();
  const [deletingModelId, setDeletingModelId] = createSignal<string | null>(
    null,
  );

  applyTheme(settings.theme);

  onMount(() => {
    settings.load();
    whisper.loadModels();
  });

  function findOption<T extends readonly OptionItem[]>(
    options: T,
    value: string,
  ): OptionItem | null {
    return options.find((o) => o.value === value) ?? null;
  }

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    await whisper.deleteModel(modelId);
    setDeletingModelId(null);
  }

  return (
    <div class="mx-auto w-full max-w-3xl space-y-6">
      <h1 class="text-2xl font-bold">{"\u8A2D\u5B9A"}</h1>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{"\u4E00\u822C\u8A2D\u5B9A"}</CardTitle>
          <CardDescription>
            {
              "\u30A2\u30D7\u30EA\u306E\u57FA\u672C\u8A2D\u5B9A\u3092\u7BA1\u7406\u3057\u307E\u3059"
            }
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          {/* Language */}
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{"\u8A00\u8A9E"}</Label>
              <p class="text-sm text-muted-foreground">
                {"\u30A2\u30D7\u30EA\u306E\u8868\u793A\u8A00\u8A9E"}
              </p>
            </div>
            <Select<OptionItem>
              multiple={false}
              value={findOption(LANGUAGE_OPTIONS, settings.language())}
              onChange={(val) => {
                if (val) {
                  settings.update({
                    language: val.value as AppSettings["language"],
                  });
                }
              }}
              options={[...LANGUAGE_OPTIONS]}
              optionValue="value"
              optionTextValue="label"
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {props.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger class="w-48">
                <SelectValue<OptionItem>>
                  {(state) => state.selectedOption().label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <Separator />

          {/* Output Format */}
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{"\u51FA\u529B\u5F62\u5F0F"}</Label>
              <p class="text-sm text-muted-foreground">
                {
                  "\u30C7\u30D5\u30A9\u30EB\u30C8\u306E\u51FA\u529B\u30D5\u30A1\u30A4\u30EB\u5F62\u5F0F"
                }
              </p>
            </div>
            <Select<OptionItem>
              multiple={false}
              value={findOption(OUTPUT_FORMAT_OPTIONS, settings.outputFormat())}
              onChange={(val) => {
                if (val) {
                  settings.update({
                    outputFormat: val.value as AppSettings["outputFormat"],
                  });
                }
              }}
              options={[...OUTPUT_FORMAT_OPTIONS]}
              optionValue="value"
              optionTextValue="label"
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {props.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger class="w-48">
                <SelectValue<OptionItem>>
                  {(state) => state.selectedOption().label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <Separator />

          {/* Theme */}
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{"\u30C6\u30FC\u30DE"}</Label>
              <p class="text-sm text-muted-foreground">
                {"\u30A2\u30D7\u30EA\u306E\u5916\u89B3\u30C6\u30FC\u30DE"}
              </p>
            </div>
            <Select<OptionItem>
              multiple={false}
              value={findOption(THEME_OPTIONS, settings.theme())}
              onChange={(val) => {
                if (val) {
                  settings.update({
                    theme: val.value as AppSettings["theme"],
                  });
                }
              }}
              options={[...THEME_OPTIONS]}
              optionValue="value"
              optionTextValue="label"
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {props.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger class="w-48">
                <SelectValue<OptionItem>>
                  {(state) => state.selectedOption().label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Model Management */}
      <Card>
        <CardHeader>
          <CardTitle>{"\u30E2\u30C7\u30EB\u7BA1\u7406"}</CardTitle>
          <CardDescription>
            {
              "Whisper\u30E2\u30C7\u30EB\u306E\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3068\u524A\u9664"
            }
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <For each={whisper.models()}>
            {(model) => (
              <div class="flex items-center justify-between rounded-lg border p-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{model.name}</span>
                    <Badge variant="secondary">{model.size}</Badge>
                    <Show when={model.recommended}>
                      <Badge>Recommended</Badge>
                    </Show>
                  </div>
                  <p class="text-sm text-muted-foreground">
                    {model.description}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <Show
                    when={model.downloaded}
                    fallback={
                      <Show
                        when={
                          whisper.isDownloading() &&
                          whisper.downloadProgress()?.modelId === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={() => whisper.downloadModel(model.id)}
                            disabled={whisper.isDownloading()}
                          >
                            {"\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9"}
                          </Button>
                        }
                      >
                        <div class="w-32 space-y-1">
                          <Progress
                            value={whisper.downloadProgress()?.progress ?? 0}
                            minValue={0}
                            maxValue={100}
                          />
                          <p class="text-center text-xs text-muted-foreground">
                            {Math.round(
                              whisper.downloadProgress()?.progress ?? 0,
                            )}
                            %
                          </p>
                        </div>
                      </Show>
                    }
                  >
                    <AlertDialog>
                      <AlertDialogTrigger
                        as={Button}
                        variant="destructive"
                        size="sm"
                        class="w-28"
                        disabled={deletingModelId() === model.id}
                      >
                        {deletingModelId() === model.id
                          ? "\u524A\u9664\u4E2D..."
                          : "\u524A\u9664"}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogTitle>
                          {"\u30E2\u30C7\u30EB\u306E\u524A\u9664"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {`${model.name} (${model.size}) \u3092\u524A\u9664\u3057\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002`}
                        </AlertDialogDescription>
                        <div class="flex justify-end gap-2">
                          <AlertDialogTrigger as={Button} variant="outline">
                            {"\u30AD\u30E3\u30F3\u30BB\u30EB"}
                          </AlertDialogTrigger>
                          <Button
                            variant="destructive"
                            onClick={() => handleDeleteModel(model.id)}
                          >
                            {"\u524A\u9664"}
                          </Button>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Show>
                </div>
              </div>
            )}
          </For>
          <Show when={whisper.models().length === 0}>
            <p class="text-sm text-muted-foreground">
              {
                "\u30E2\u30C7\u30EB\u60C5\u5831\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D..."
              }
            </p>
          </Show>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card>
        <CardHeader>
          <CardTitle>{"\u30EA\u30BB\u30C3\u30C8"}</CardTitle>
          <CardDescription>
            {
              "\u8A2D\u5B9A\u3092\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u623B\u3057\u307E\u3059"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => settings.reset()}>
            {"\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u623B\u3059"}
          </Button>
        </CardContent>
      </Card>

      {/* Error display */}
      <Show when={whisper.error()}>
        <Card>
          <CardContent class="pt-6">
            <p class="text-sm text-destructive">{whisper.error()}</p>
          </CardContent>
        </Card>
      </Show>
    </div>
  );
}
