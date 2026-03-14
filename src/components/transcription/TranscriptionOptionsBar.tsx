import { FiPlay } from "solid-icons/fi";
import { Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { useI18n } from "~/i18n";
import type { ModelInfo } from "~/types";

interface LanguageOption {
  value: string;
  label: string;
}

interface TranscriptionOptionsBarProps {
  downloadedModels: ModelInfo[];
  selectedModel: ModelInfo | null;
  language: string | null;
  canStart: boolean;
  onSelectModel: (model: ModelInfo) => void;
  onLanguageChange: (language: string | null) => void;
  onStart: () => void;
}

export function TranscriptionOptionsBar(props: TranscriptionOptionsBarProps) {
  const { t } = useI18n();

  const languageOptions: LanguageOption[] = [
    { value: "auto", label: t("transcription.languageAuto") },
    { value: "ja", label: t("transcription.languageJa") },
    { value: "en", label: t("transcription.languageEn") },
    { value: "zh", label: t("transcription.languageZh") },
    { value: "ko", label: t("transcription.languageKo") },
    { value: "fr", label: t("transcription.languageFr") },
    { value: "de", label: t("transcription.languageDe") },
    { value: "es", label: t("transcription.languageEs") },
  ];

  return (
    <div class="mt-6 border-t border-border/30 pt-5">
      <Show
        when={props.downloadedModels.length > 0}
        fallback={
          <p class="rounded-lg bg-muted/50 py-3 text-center text-sm text-muted-foreground">
            {t("transcription.noModelsWarning")}
          </p>
        }
      >
        <div class="grid grid-cols-[2fr_2fr_3fr] gap-3">
          <div class="space-y-3">
            <span class="text-xs font-medium text-muted-foreground">
              {t("transcription.model")}
            </span>
            <Select<ModelInfo>
              multiple={false}
              options={props.downloadedModels}
              optionValue="id"
              optionTextValue="name"
              value={props.selectedModel}
              onChange={(value) => {
                if (value) props.onSelectModel(value);
              }}
              disallowEmptySelection
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>
                  {itemProps.item.rawValue.name}
                </SelectItem>
              )}
            >
              <SelectTrigger class="h-11 border-0 bg-muted/50">
                <SelectValue<ModelInfo>>
                  {(state) =>
                    state.selectedOption()?.name ?? t("transcription.model")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
          <div class="space-y-3">
            <span class="text-xs font-medium text-muted-foreground">
              {t("transcription.languageLabel")}
            </span>
            <Select<LanguageOption>
              multiple={false}
              options={languageOptions}
              optionValue="value"
              optionTextValue="label"
              value={
                languageOptions.find(
                  (o) => o.value === (props.language ?? "auto"),
                ) ??
                languageOptions[0] ??
                null
              }
              onChange={(value) => {
                if (value) {
                  const lang = value.value === "auto" ? null : value.value;
                  props.onLanguageChange(lang);
                }
              }}
              disallowEmptySelection
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>
                  {itemProps.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger class="h-11 border-0 bg-muted/50">
                <SelectValue<LanguageOption>>
                  {(state) =>
                    state.selectedOption()?.label ??
                    t("transcription.languageAuto")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
          <div class="flex items-end">
            <Button
              class="h-11 w-full"
              disabled={!props.canStart}
              onClick={props.onStart}
            >
              <FiPlay />
              {t("transcription.startTranscription")}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
