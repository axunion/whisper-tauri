export type Locale = "ja" | "en";

export interface Dictionary {
  common: {
    cancel: string;
    delete: string;
    close: string;
    retry: string;
    download: string;
    save: string;
    recommended: string;
    deleting: string;
    processing: string;
    done: string;
  };
  nav: {
    dashboard: string;
    transcription: string;
    history: string;
    settings: string;
    dev: string;
  };
  dashboard: {
    title: string;
    quickActions: string;
    recentHistory: string;
    viewAll: string;
    noHistory: string;
    modelStatus: string;
    loadingModels: string;
    noModels: string;
    downloaded: string;
    notDownloaded: string;
  };
  transcription: {
    title: string;
    audioFile: string;
    model: string;
    converting: string;
    transcribing: string;
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
    newFile: string;
    rerun: string;
    selectAudioFile: string;
    changeFile: string;
    supportedFormats: string;
    audioFilesFilter: string;
    completedToast: string;
  };
  history: {
    title: string;
    transcriptionHistory: string;
    detail: string;
    detailDescription: string;
    noEntries: string;
    selectAll: string;
    deselectAll: string;
    deleteCount: string;
    deleteSelected: string;
    deleteConfirmation: string;
    deletedToast: string;
    modelLabel: string;
    searchPlaceholder: string;
    searchNoResults: string;
    filterToday: string;
    filterThisWeek: string;
    filterThisMonth: string;
    filterAll: string;
    sortDate: string;
    sortDuration: string;
    sortFileName: string;
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
    systemInstalled: string;
    ffmpegDeletedToast: string;
    ffmpegDownloadedToast: string;
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
    proofreadTab: string;
    summaryTab: string;
  };
  recording: {
    title: string;
    selectDevice: string;
    defaultDevice: string;
    startRecording: string;
    stopRecording: string;
    recording: string;
    noDevices: string;
    permissionDenied: string;
    transcribeRecording: string;
    discardRecording: string;
    discardConfirmTitle: string;
    discardConfirmDescription: string;
    saveAsWav: string;
    fileTab: string;
    recordTab: string;
  };
  textProcessing: {
    proofread: string;
    summarize: string;
    proofreading: string;
    summarizing: string;
    proofreadResult: string;
    summaryResult: string;
    serverStarting: string;
    serverNotReady: string;
    downloadServerFirst: string;
    downloadModelFirst: string;
    aiSetupRequired: string;
    aiSetupDescription: string;
    modelManagement: string;
    serverManagement: string;
    deleteModel: string;
    deleteModelConfirmation: string;
    modelDeletedToast: string;
    serverDownloadedToast: string;
    serverDeletedToast: string;
    modelDownloadedToast: string;
    summaryLengthShort: string;
    summaryLengthMedium: string;
    summaryLengthLong: string;
    bulletPoints: string;
    copyResult: string;
    replaceText: string;
    proofreadCompletedToast: string;
    summarizeCompletedToast: string;
    cancelledToast: string;
    settingUp: string;
  };
  models: {
    whisper: {
      largeV3Turbo: { description: string };
      medium: { description: string };
      small: { description: string };
    };
    text: {
      gemma3_4b: { description: string };
      qwen35_4b: { description: string };
    };
  };
  dev: {
    title: string;
    dataReset: string;
    devOnlyMessage: string;
    clearHistory: string;
    clearHistoryConfirmation: string;
    deleteAll: string;
    historyClearedToast: string;
    noDownloadedModels: string;
    deleteModel: string;
    deleteModelConfirmation: string;
    deleteAllModels: string;
    deletingAll: string;
    deleteAllModelsConfirmation: string;
    modelDeletedToast: string;
    allModelsDeletedToast: string;
    ffmpegDeletedToast: string;
    llmTester: string;
    inputPlaceholder: string;
    send: string;
    prerequisiteWarning: string;
  };
}

/** Utility type that extracts all dot-notation paths from a nested object type. */
type DotPathsImpl<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPathsImpl<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type DictionaryKey = DotPathsImpl<Dictionary>;
