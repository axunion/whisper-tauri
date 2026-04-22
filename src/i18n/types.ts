export type Locale = "ja" | "en";

export interface Dictionary {
  common: {
    cancel: string;
    delete: string;
    close: string;
    retry: string;
    download: string;

    deleting: string;
    confirm: string;
    done: string;
    downloading: string;
    downloadingSpeechModel: string;
    downloadingFfmpeg: string;
    downloadingTextModel: string;
    downloadingServer: string;
  };
  nav: {
    dashboard: string;
    transcription: string;
    history: string;
    settings: string;
    dev: string;
  };
  dashboard: {
    quickActionFile: string;
    quickActionFileDesc: string;
    quickActionRecord: string;
    quickActionRecordDesc: string;
    setupModelHint: string;
    setupFfmpegHint: string;
    setupAiHint: string;
    recentActivity: string;
    viewAll: string;
  };
  transcription: {
    model: string;
    converting: string;
    startTranscription: string;
    languageLabel: string;
    noModelsWarning: string;
    languageAuto: string;
    languageJa: string;
    languageEn: string;
    languageZh: string;
    languageKo: string;
    languageFr: string;
    languageDe: string;
    languageEs: string;
    selectAudioFile: string;
    changeFile: string;
    supportedFormats: string;
    audioFilesFilter: string;
    completedToast: string;
    estimatedTime: string;
    remainingTime: string;
    almostDone: string;
    cancelling: string;
  };
  history: {
    detail: string;
    noEntries: string;
    deleteCount: string;
    deleteSelected: string;
    deleteConfirmation: string;
    deletedToast: string;
    searchPlaceholder: string;
    searchNoResults: string;
    filterLast7days: string;
    filterLast30days: string;
    filterAll: string;
    sortDate: string;
    sortLength: string;
    sortFileName: string;
    sortAsc: string;
    sortDesc: string;
    select: string;
    selectedCount: string;
  };
  settings: {
    title: string;
    general: string;
    language: string;
    languageDescription: string;
    languageJa: string;
    languageEn: string;
    theme: string;
    themeDescription: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    modelManagement: string;
    deleteModel: string;
    deleteModelConfirmation: string;
    modelDeletedToast: string;
    loadingModels: string;
    toolManagement: string;
    deleteFfmpeg: string;
    deleteFfmpegConfirmation: string;
    ffmpegDeletedToast: string;
    ffmpegDownloadedToast: string;
    ffmpegUpdateAvailable: string;
    update: string;
    vadEnabled: string;
    vadDescription: string;
  };
  errors: {
    file: string;
    model: string;
    process: string;
    network: string;
    cancelled: string;
    unknown: string;
  };
  result: {
    copiedToast: string;
    copyFailedToast: string;
    savedToast: string;
    saveFailedToast: string;
    exportTxt: string;
    exportSrt: string;
    exportVtt: string;
    textTab: string;
    timelineTab: string;
    summaryTab: string;
    cleanTextTab: string;
  };
  recording: {
    title: string;
    selectDevice: string;
    defaultDevice: string;
    startRecording: string;
    recording: string;
    noDevices: string;
    discardRecording: string;
    saveAsWav: string;
    fileTab: string;
    recordTab: string;
  };
  textProcessing: {
    summarize: string;
    summarizing: string;
    aiSetupRequired: string;
    aiSetupDescription: string;
    modelManagement: string;
    serverManagement: string;
    deleteModel: string;
    deleteModelConfirmation: string;
    modelDeletedToast: string;
    serverDownloadedToast: string;
    deleteServer: string;
    deleteServerConfirmation: string;
    serverDeletedToast: string;
    modelDownloadedToast: string;
    summarizeCompletedToast: string;
    settingUp: string;
    cleanText: string;
    cleaningText: string;
    cleanTextCompletedToast: string;
    titleGeneratedToast: string;
    generateTitle: string;
    overwriteConfirmTitle: string;
    overwriteConfirmDescription: string;
  };
  models: {
    whisper: {
      largeV3: { description: string };
      largeV3Turbo: { description: string };
      medium: { description: string };
      small: { description: string };
    };
    text: {
      gemma4_e2b: { description: string };
      qwen35_4b: { description: string };
    };
  };
  onboarding: {
    next: string;
    back: string;
    welcomeTitle: string;
    welcomeSubtitle: string;
    privacyMessage: string;
    chooseLanguage: string;
    chooseTheme: string;
    modelTitle: string;
    modelSubtitle: string;
    modelReady: string;
    modelDownloadLater: string;
    modelRequired: string;
    ffmpegTitle: string;
    ffmpegDescription: string;
    llmTitle: string;
    llmDescription: string;
    completionTitle: string;
    completionSubtitle: string;
    summaryModel: string;
    summaryFfmpeg: string;
    summaryLlm: string;
    summaryReady: string;
    summaryNotInstalled: string;
    startTranscribing: string;
  };
  dev: {
    dataReset: string;
    devOnlyMessage: string;
    clearHistory: string;
    clearHistoryConfirmation: string;
    deleteAll: string;
    historyClearedToast: string;
    noDownloadedModels: string;
    deleteModel: string;
    deleteModelConfirmation: string;
    modelDeletedToast: string;
    deleteFfmpeg: string;
    deleteFfmpegConfirmation: string;
    ffmpegDeletedToast: string;
    resetOnboardingConfirmTitle: string;
    resetOnboardingConfirmDescription: string;
    llmTester: string;
    defaultInput: string;
    send: string;
    prerequisiteWarning: string;
    resetOnboarding: string;
    reset: string;
    onboardingResetToast: string;
  };
}

/** Utility type that extracts all dot-notation paths from a nested object type. */
type DotPathsImpl<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPathsImpl<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type DictionaryKey = DotPathsImpl<Dictionary>;
