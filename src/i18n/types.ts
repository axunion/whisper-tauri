export type Locale = "ja" | "en";

export interface Dictionary {
  common: {
    cancel: string;
    delete: string;
    close: string;
    retry: string;
    download: string;
    copy: string;
    copied: string;
    save: string;
    reset: string;
    clear: string;
    recommended: string;
    deleting: string;
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
    newFile: string;
    rerun: string;
    selectAudioFile: string;
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
    from: string;
    to: string;
    modelLabel: string;
  };
  settings: {
    title: string;
    general: string;
    generalDescription: string;
    language: string;
    languageDescription: string;
    languageJa: string;
    languageEn: string;
    outputFormat: string;
    outputFormatDescription: string;
    outputFormatTxt: string;
    outputFormatSrt: string;
    outputFormatVtt: string;
    theme: string;
    themeDescription: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    modelManagement: string;
    modelManagementDescription: string;
    deleteModel: string;
    deleteModelConfirmation: string;
    modelDeletedToast: string;
    loadingModels: string;
    toolManagement: string;
    toolManagementDescription: string;
    systemInstalled: string;
    ffmpegDeletedToast: string;
    ffmpegDownloadedToast: string;
    resetTitle: string;
    resetDescription: string;
    resetToDefaults: string;
    settingsResetToast: string;
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
  };
  dev: {
    title: string;
    cachesClear: string;
    modelManager: string;
    debugLog: string;
    devOnlyMessage: string;
    clearHistory: string;
    clearHistoryDescription: string;
    clearHistoryConfirmation: string;
    deleteAll: string;
    historyClearedToast: string;
    resetSettings: string;
    resetSettingsDescription: string;
    resetSettingsConfirmation: string;
    deleteFfmpeg: string;
    deleteFfmpegDescription: string;
    deleteFfmpegConfirmation: string;
    noDownloadedModels: string;
    deleteModel: string;
    deleteModelConfirmation: string;
    deleteAllModels: string;
    deletingAll: string;
    deleteAllModelsConfirmation: string;
    modelDeletedToast: string;
    allModelsDeletedToast: string;
    noLogs: string;
    logCopiedToast: string;
    logCopyFailedToast: string;
    ffmpegDeletedToast: string;
    settingsResetToast: string;
  };
}

/** Utility type that extracts all dot-notation paths from a nested object type. */
type DotPathsImpl<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPathsImpl<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type DictionaryKey = DotPathsImpl<Dictionary>;
