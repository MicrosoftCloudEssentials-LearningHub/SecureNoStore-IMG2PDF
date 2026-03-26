const { jsPDF } = window.jspdf;

const pageFormats = {
  a4: { width: 210, height: 297 },
  letter: { width: 216, height: 279 },
};

const previewMaxDimension = 1200;
const adjustPreviewMaxDimension = 1400;
const maxCropPercent = 45;
const minRemainingCropPercent = 10;
const autoDetectCropPadding = 0.012;

const presetSettings = {
  clean: { brightness: 14, contrast: 106, grain: 1, vignette: 2, threshold: 186, shadowBoost: 0.14 },
  classic: { brightness: 7, contrast: 126, grain: 5, vignette: 4, threshold: 164, shadowBoost: 0.26 },
  "high-contrast": { brightness: 2, contrast: 146, grain: 2, vignette: 1, threshold: 150, shadowBoost: 0.38 },
};

const presetDescriptions = {
  clean: "Office scanner keeps pages light and clean with the least texture.",
  classic: "Photocopier adds a rougher copied-paper feel with more scan texture.",
  "high-contrast": "Receipts and forms darkens text for small print, faded paper, and sharp document edges.",
};

const broadlySupportedExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "avif",
  "svg",
  "heic",
  "heif",
  "tif",
  "tiff",
]);

const browserNativeExtensions = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "avif", "svg"]);

const reviewPresets = {
  "review-blanks": ["blank"],
  "review-overrides": ["scan-override"],
  "review-perspective": ["perspective"],
};

const exportPresets = {
  "archive-pdf": { exportFormat: "pdf", exportVisibleOnly: false, pdfQuality: "high" },
  "visible-review-zip": { exportFormat: "png", exportVisibleOnly: true },
  "ocr-review-mode": { exportFormat: "pdf", exportVisibleOnly: true },
};

const settingsStorageKey = "safescan-review-settings";

const state = {
  files: [],
  pageFilters: new Set(),
  draggingId: null,
  previewRenderFrame: null,
  activeAdjustId: null,
  activeCornerIndex: null,
  activeCropEdge: null,
  activeCropPointer: null,
  adjustPreviewMetrics: null,
};

const elements = {
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#file-input"),
  previewList: document.querySelector("#preview-list"),
  previewTemplate: document.querySelector("#preview-template"),
  status: document.querySelector("#status"),
  downloadBtn: document.querySelector("#download-btn"),
  ocrBtn: document.querySelector("#ocr-btn"),
  ocrVisibleBtn: document.querySelector("#ocr-visible-btn"),
  ocrSelectedBtn: document.querySelector("#ocr-selected-btn"),
  applyScanSelectedBtn: document.querySelector("#apply-scan-selected-btn"),
  clearScanSelectedBtn: document.querySelector("#clear-scan-selected-btn"),
  keepSelectedBtn: document.querySelector("#keep-selected-btn"),
  removeBlankBtn: document.querySelector("#remove-blank-btn"),
  removeSelectedBtn: document.querySelector("#remove-selected-btn"),
  clearBtn: document.querySelector("#clear-btn"),
  selectAllBtn: document.querySelector("#select-all-btn"),
  selectScanOverridesBtn: document.querySelector("#select-scan-overrides-btn"),
  selectPerspectivePagesBtn: document.querySelector("#select-perspective-pages-btn"),
  clearSelectionBtn: document.querySelector("#clear-selection-btn"),
  resetFiltersBtn: document.querySelector("#reset-filters-btn"),
  filterChips: Array.from(document.querySelectorAll(".filter-chip")),
  filterPresetButtons: Array.from(document.querySelectorAll(".filter-preset-button")),
  exportPresetButtons: Array.from(document.querySelectorAll(".export-preset-button")),
  activeFiltersSummary: document.querySelector("#active-filters-summary"),
  adjustOverlay: document.querySelector("#adjust-overlay"),
  adjustPreviewSurface: document.querySelector("#adjust-preview-surface"),
  adjustPreviewCanvas: document.querySelector("#adjust-preview-canvas"),
  adjustResultCanvas: document.querySelector("#adjust-result-canvas"),
  cropOverlay: document.querySelector("#crop-overlay"),
  cropBox: document.querySelector("#crop-box"),
  cropHandles: Array.from(document.querySelectorAll(".crop-handle")),
  cornerOverlay: document.querySelector("#corner-overlay"),
  cornerHandles: Array.from(document.querySelectorAll(".corner-handle")),
  adjustClose: document.querySelector("#adjust-close"),
  adjustDone: document.querySelector("#adjust-done"),
  adjustReset: document.querySelector("#adjust-reset"),
  adjustApplySelected: document.querySelector("#adjust-apply-selected"),
  adjustAutoDetect: document.querySelector("#adjust-auto-detect"),
  adjustPerspective: document.querySelector("#adjust-perspective"),
  adjustRotate: document.querySelector("#adjust-rotate"),
  adjustCropTop: document.querySelector("#adjust-crop-top"),
  adjustCropRight: document.querySelector("#adjust-crop-right"),
  adjustCropBottom: document.querySelector("#adjust-crop-bottom"),
  adjustCropLeft: document.querySelector("#adjust-crop-left"),
  adjustCropSummary: document.querySelector("#adjust-crop-summary"),
  pageSize: document.querySelector("#page-size"),
  pageMargin: document.querySelector("#page-margin"),
  imageFit: document.querySelector("#image-fit"),
  pdfQuality: document.querySelector("#pdf-quality"),
  exportFormat: document.querySelector("#export-format"),
  ocrLanguage: document.querySelector("#ocr-language"),
  ocrLanguageCustom: document.querySelector("#ocr-language-custom"),
  autoCleanup: document.querySelector("#auto-cleanup"),
  selectDetectedBlanks: document.querySelector("#select-detected-blanks"),
  exportVisibleOnly: document.querySelector("#export-visible-only"),
  prefAlwaysVisibleExport: document.querySelector("#pref-always-visible-export"),
  prefRememberOcrLanguage: document.querySelector("#pref-remember-ocr-language"),
  prefRememberReviewPreset: document.querySelector("#pref-remember-review-preset"),
  prefAutoSelectReviewPreset: document.querySelector("#pref-auto-select-review-preset"),
  scanLookToggle: document.querySelector("#scan-look-toggle"),
  preset: document.querySelector("#scan-preset"),
  presetDescription: document.querySelector("#preset-description"),
  brightness: document.querySelector("#brightness"),
  contrast: document.querySelector("#contrast"),
  grain: document.querySelector("#grain"),
  vignette: document.querySelector("#vignette"),
  controlsGrid: document.querySelector(".controls-grid"),
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function getFileExtension(fileName) {
  return fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
}

function replaceFileExtension(fileName, nextExtension) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const basename = lastDotIndex === -1 ? fileName : fileName.slice(0, lastDotIndex);
  return `${basename}.${nextExtension}`;
}

function isLikelyImageFile(file) {
  return file.type.startsWith("image/") || broadlySupportedExtensions.has(getFileExtension(file.name));
}

function getControls() {
  return {
    useScanLook: elements.scanLookToggle.checked,
    preset: elements.preset.value,
    brightness: Number(elements.brightness.value),
    contrast: Number(elements.contrast.value),
    grain: Number(elements.grain.value),
    vignette: Number(elements.vignette.value),
    pageMargin: Number(elements.pageMargin.value),
    imageFit: elements.imageFit.value,
    pdfQuality: elements.pdfQuality.value,
    exportFormat: elements.exportFormat.value,
    ocrLanguage: elements.ocrLanguage.value,
    autoCleanup: elements.autoCleanup.checked,
    exportVisibleOnly: elements.exportVisibleOnly.checked,
  };
}

function getAutomationPreferences() {
  return {
    alwaysVisibleExport: elements.prefAlwaysVisibleExport.checked,
    rememberOcrLanguage: elements.prefRememberOcrLanguage.checked,
    rememberReviewPreset: elements.prefRememberReviewPreset.checked,
    autoSelectReviewPreset: elements.prefAutoSelectReviewPreset.checked,
  };
}

function getScanControls(controls = getControls()) {
  return {
    useScanLook: controls.useScanLook,
    preset: controls.preset,
    brightness: controls.brightness,
    contrast: controls.contrast,
    grain: controls.grain,
    vignette: controls.vignette,
    autoCleanup: controls.autoCleanup,
  };
}

function getEffectiveControls(entry, controls = getControls()) {
  if (!entry?.scanSettings) {
    return controls;
  }

  return {
    ...controls,
    ...entry.scanSettings,
  };
}

function getOcrLanguageCode() {
  const customLanguage = elements.ocrLanguageCustom.value.trim();
  return customLanguage || elements.ocrLanguage.value;
}

function cloneAdjustments(adjustments) {
  return {
    ...adjustments,
    corners: (adjustments.corners || createDefaultCorners()).map((point) => ({ ...point })),
  };
}

function getSelectedEntries() {
  return state.files.filter((entry) => entry.selected);
}

function entryMatchesFilter(entry, filter) {
  if (filter === "selected") {
    return Boolean(entry.selected);
  }

  if (filter === "blank") {
    return Boolean(entry.blankCandidate);
  }

  if (filter === "scan-override") {
    return Boolean(entry.scanSettings);
  }

  if (filter === "perspective") {
    return Boolean(getEntryAdjustments(entry).perspectiveEnabled);
  }

  return false;
}

function matchesPageFilter(entry) {
  if (!state.pageFilters.size) {
    return true;
  }

  return [...state.pageFilters].every((filter) => entryMatchesFilter(entry, filter));
}

function getVisibleEntries() {
  return state.files.filter(matchesPageFilter);
}

function getActivePresetKey() {
  const activeFilters = [...state.pageFilters].sort().join("|");
  const presetEntry = Object.entries(reviewPresets).find(([, filters]) => filters.slice().sort().join("|") === activeFilters);
  return presetEntry?.[0] || null;
}

function getActiveExportPresetKey() {
  const controls = getControls();
  const activeEntry = Object.entries(exportPresets).find(([, preset]) => {
    const qualityMatches = !preset.pdfQuality || preset.pdfQuality === controls.pdfQuality;
    return preset.exportFormat === controls.exportFormat && preset.exportVisibleOnly === controls.exportVisibleOnly && qualityMatches;
  });

  return activeEntry?.[0] || null;
}

function getFilterCounts() {
  return {
    all: state.files.length,
    selected: state.files.filter((entry) => entryMatchesFilter(entry, "selected")).length,
    blank: state.files.filter((entry) => entryMatchesFilter(entry, "blank")).length,
    "scan-override": state.files.filter((entry) => entryMatchesFilter(entry, "scan-override")).length,
    perspective: state.files.filter((entry) => entryMatchesFilter(entry, "perspective")).length,
  };
}

function updateFilterChipState() {
  const counts = getFilterCounts();
  elements.filterChips.forEach((chip) => {
    const { filter } = chip.dataset;
    const isActive = filter === "all" ? state.pageFilters.size === 0 : state.pageFilters.has(filter);
    chip.classList.toggle("is-active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
    const countElement = chip.querySelector(".filter-chip-count");
    if (countElement) {
      countElement.textContent = String(counts[filter] ?? 0);
    }
  });

  const activePresetKey = getActivePresetKey();
  elements.filterPresetButtons.forEach((button) => {
    const isActive = button.dataset.preset === activePresetKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const activeExportPresetKey = getActiveExportPresetKey();
  elements.exportPresetButtons.forEach((button) => {
    const isActive = button.dataset.exportPreset === activeExportPresetKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getActiveFilterSummary() {
  const visibleOnlySuffix = elements.exportVisibleOnly.checked ? " Visible-only export is on." : "";
  if (!state.pageFilters.size) {
    return `Showing all pages.${visibleOnlySuffix}`;
  }

  const labels = elements.filterChips
    .filter((chip) => state.pageFilters.has(chip.dataset.filter))
    .map((chip) => chip.querySelector(".filter-chip-label")?.textContent || chip.dataset.filter);

  return `Active filters: ${labels.join(" + ")}.${visibleOnlySuffix}`;
}

function sanitizeBaseName(fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return baseName.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "page";
}

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function updateDownloadButtonLabel() {
  const format = elements.exportFormat.value;
  const targetLabel = elements.exportVisibleOnly.checked
    ? (format === "pdf" ? "Download Visible PDF" : `Download Visible ${format.toUpperCase()} ZIP`)
    : (format === "pdf" ? "Download PDF" : `Download ${format.toUpperCase()} ZIP`);
  elements.downloadBtn.textContent = targetLabel;
}

function updateVisibleActionLabels() {
  elements.ocrBtn.textContent = elements.exportVisibleOnly.checked ? "Extract All Text" : "Extract Text";
  elements.ocrVisibleBtn.textContent = elements.exportVisibleOnly.checked ? "OCR Visible Pages Only" : "Extract Visible Text";
}

function updateAutomationPreferenceState() {
  if (elements.prefAlwaysVisibleExport.checked) {
    elements.exportVisibleOnly.checked = true;
  }
  elements.exportVisibleOnly.disabled = elements.prefAlwaysVisibleExport.checked;
}

function updateBlankActionLabel() {
  elements.removeBlankBtn.textContent = elements.selectDetectedBlanks.checked ? "Select Blank Pages" : "Remove Blank Pages";
}

function saveReviewSettings() {
  const preferences = getAutomationPreferences();
  try {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify({
      preferences,
      pageFilters: preferences.rememberReviewPreset ? [...state.pageFilters] : [],
      exportVisibleOnly: preferences.alwaysVisibleExport ? true : elements.exportVisibleOnly.checked,
      ocrLanguage: preferences.rememberOcrLanguage ? elements.ocrLanguage.value : "eng",
      ocrLanguageCustom: preferences.rememberOcrLanguage ? elements.ocrLanguageCustom.value : "",
    }));
  } catch {
    // Ignore storage failures in private browsing or restricted environments.
  }
}

function loadReviewSettings() {
  try {
    const rawSettings = window.localStorage.getItem(settingsStorageKey);
    if (!rawSettings) {
      return;
    }

    const parsed = JSON.parse(rawSettings);
    if (parsed.preferences) {
      elements.prefAlwaysVisibleExport.checked = Boolean(parsed.preferences.alwaysVisibleExport);
      elements.prefRememberOcrLanguage.checked = Boolean(parsed.preferences.rememberOcrLanguage);
      elements.prefRememberReviewPreset.checked = Boolean(parsed.preferences.rememberReviewPreset);
      elements.prefAutoSelectReviewPreset.checked = Boolean(parsed.preferences.autoSelectReviewPreset);
    }
    if (Array.isArray(parsed.pageFilters)) {
      state.pageFilters = new Set(parsed.pageFilters.filter((filter) => filter in getFilterCounts()));
    }
    if (typeof parsed.exportVisibleOnly === "boolean") {
      elements.exportVisibleOnly.checked = parsed.exportVisibleOnly;
    }
    if (typeof parsed.ocrLanguage === "string") {
      elements.ocrLanguage.value = parsed.ocrLanguage;
    }
    if (typeof parsed.ocrLanguageCustom === "string") {
      elements.ocrLanguageCustom.value = parsed.ocrLanguageCustom;
    }
  } catch {
    // Ignore malformed persisted state and fall back to defaults.
  }

  updateAutomationPreferenceState();
}

function estimateBlankness(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const sampleStep = Math.max(1, Math.round(Math.sqrt((width * height) / 180000)));
  let samples = 0;
  let brightSum = 0;
  let varianceSum = 0;
  let darkPixels = 0;
  let inkPixels = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = ((y * width) + x) * 4;
      const gray = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
      brightSum += gray;
      varianceSum += gray * gray;
      if (gray < 245) {
        darkPixels += 1;
      }
      if (gray < 220) {
        inkPixels += 1;
      }
      samples += 1;
    }
  }

  const average = brightSum / Math.max(1, samples);
  const variance = (varianceSum / Math.max(1, samples)) - (average * average);
  const darkRatio = darkPixels / Math.max(1, samples);
  const inkRatio = inkPixels / Math.max(1, samples);

  return {
    average,
    variance,
    darkRatio,
    inkRatio,
    isBlank: average > 247 && variance < 260 && darkRatio < 0.012 && inkRatio < 0.003,
  };
}

function toggleSelection(id, selected) {
  const entry = state.files.find((file) => file.id === id);
  if (!entry) {
    return;
  }

  entry.selected = selected;
  entry.blankCandidate = false;
  renderPreviews();
}

function setAllSelections(selected) {
  state.files.forEach((entry) => {
    entry.selected = selected;
    entry.blankCandidate = false;
  });
  renderPreviews();
}

function getPdfQualitySettings(quality) {
  if (quality === "compact") {
    return { jpegQuality: 0.76, scaleLimit: 1800 };
  }

  if (quality === "high") {
    return { jpegQuality: 0.97, scaleLimit: 3200 };
  }

  return { jpegQuality: 0.9, scaleLimit: 2400 };
}

function renderOriginalImage(sourceImage) {
  return renderOriginalImageAtSize(sourceImage, sourceImage.width, sourceImage.height);
}

function createDefaultAdjustments() {
  return {
    rotate: 0,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
    cropLeft: 0,
    perspectiveEnabled: false,
    autoDetected: false,
    autoDetectionTried: false,
    corners: createDefaultCorners(),
  };
}

function createDefaultCorners() {
  return [
    { x: 0.04, y: 0.04 },
    { x: 0.96, y: 0.04 },
    { x: 0.96, y: 0.96 },
    { x: 0.04, y: 0.96 },
  ];
}

function getEntryAdjustments(entry) {
  entry.adjustments ||= createDefaultAdjustments();
  entry.adjustments.corners ||= createDefaultCorners();
  entry.adjustments.autoDetected ||= false;
  entry.adjustments.autoDetectionTried ||= false;
  return entry.adjustments;
}

function cornersMatchDefault(corners) {
  const defaults = createDefaultCorners();
  return (corners || []).every((point, index) => {
    const fallback = defaults[index];
    return fallback && Math.abs(point.x - fallback.x) < 0.0001 && Math.abs(point.y - fallback.y) < 0.0001;
  });
}

function hasMeaningfulAdjustments(adjustments) {
  return Boolean(
    adjustments.rotate
    || adjustments.cropTop
    || adjustments.cropRight
    || adjustments.cropBottom
    || adjustments.cropLeft
    || adjustments.perspectiveEnabled
    || !cornersMatchDefault(adjustments.corners || createDefaultCorners())
  );
}

function applyDetectedDocumentAdjustments(adjustments, detectedDocument) {
  adjustments.corners = detectedDocument.corners;
  adjustments.cropTop = Math.max(0, Math.min(maxCropPercent, detectedDocument.bounds.top * 100));
  adjustments.cropRight = Math.max(0, Math.min(maxCropPercent, (1 - detectedDocument.bounds.right) * 100));
  adjustments.cropBottom = Math.max(0, Math.min(maxCropPercent, (1 - detectedDocument.bounds.bottom) * 100));
  adjustments.cropLeft = Math.max(0, Math.min(maxCropPercent, detectedDocument.bounds.left * 100));
  adjustments.perspectiveEnabled = true;
  adjustments.autoDetected = true;
  adjustments.autoDetectionTried = true;
}

function maybeAutoDetectEntryDocument(entry, maxDimension = adjustPreviewMaxDimension) {
  const adjustments = getEntryAdjustments(entry);
  if (!opencvReady() || adjustments.autoDetectionTried || hasMeaningfulAdjustments(adjustments)) {
    return false;
  }

  const baseCanvas = getBaseAdjustedCanvas(entry.sourceImage, adjustments, maxDimension);
  const detectedDocument = detectDocumentShape(baseCanvas);
  adjustments.autoDetectionTried = true;
  if (!detectedDocument) {
    return false;
  }

  applyDetectedDocumentAdjustments(adjustments, detectedDocument);
  return true;
}

function autoDetectPendingEntries(entries = state.files, maxDimension = adjustPreviewMaxDimension) {
  if (!opencvReady()) {
    return 0;
  }

  let detectedCount = 0;
  entries.forEach((entry) => {
    if (maybeAutoDetectEntryDocument(entry, maxDimension)) {
      detectedCount += 1;
    }
  });
  return detectedCount;
}

function countPendingAutoDetectEntries(entries = state.files) {
  return entries.filter((entry) => {
    const adjustments = getEntryAdjustments(entry);
    return !adjustments.autoDetectionTried && !hasMeaningfulAdjustments(adjustments);
  }).length;
}

function getBaseAdjustedCanvas(sourceImage, adjustments, maxDimension) {
  return createRotatedCanvas(sourceImage, adjustments, maxDimension);
}

function renderOriginalImageAtSize(sourceImage, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(sourceImage, 0, 0);
  return canvas;
}

function getScaledDimensions(width, height, maxDimension) {
  if (!maxDimension) {
    return { width, height };
  }

  const largestSide = Math.max(width, height);
  if (largestSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / largestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getCropRect(sourceImage, adjustments) {
  return getCropRectForDimensions(sourceImage.width, sourceImage.height, adjustments);
}

function getCropRectForDimensions(width, height, adjustments) {
  const cropLimit = maxCropPercent / 100;
  const minRemaining = minRemainingCropPercent / 100;
  const cropTop = Math.min(cropLimit, Math.max(0, adjustments.cropTop / 100));
  const cropRight = Math.min(cropLimit, Math.max(0, adjustments.cropRight / 100));
  const cropBottom = Math.min(cropLimit, Math.max(0, adjustments.cropBottom / 100));
  const cropLeft = Math.min(cropLimit, Math.max(0, adjustments.cropLeft / 100));
  const croppedWidth = width * Math.max(minRemaining, 1 - cropLeft - cropRight);
  const croppedHeight = height * Math.max(minRemaining, 1 - cropTop - cropBottom);

  return {
    x: width * cropLeft,
    y: height * cropTop,
    width: croppedWidth,
    height: croppedHeight,
  };
}

function getRotatedBounds(width, height, angleInDegrees) {
  const radians = Math.abs(angleInDegrees) * (Math.PI / 180);
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return {
    width: Math.max(1, Math.round((width * cos) + (height * sin))),
    height: Math.max(1, Math.round((width * sin) + (height * cos))),
  };
}

function createRotatedCanvas(sourceImage, adjustments, maxDimension) {
  const scaledDimensions = getScaledDimensions(sourceImage.width, sourceImage.height, maxDimension);
  const sourceCanvas = renderOriginalImageAtSize(sourceImage, scaledDimensions.width, scaledDimensions.height);

  if (!adjustments.rotate) {
    return sourceCanvas;
  }

  const rotatedBounds = getRotatedBounds(sourceCanvas.width, sourceCanvas.height, adjustments.rotate);
  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = rotatedBounds.width;
  rotatedCanvas.height = rotatedBounds.height;
  const rotatedContext = rotatedCanvas.getContext("2d");
  rotatedContext.fillStyle = "#ffffff";
  rotatedContext.fillRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);
  rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  rotatedContext.rotate(adjustments.rotate * (Math.PI / 180));
  rotatedContext.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  return rotatedCanvas;
}

function createCroppedCanvas(rotatedCanvas, adjustments) {
  const cropRect = getCropRect(rotatedCanvas, adjustments);
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.round(cropRect.width));
  cropCanvas.height = Math.max(1, Math.round(cropRect.height));
  const cropContext = cropCanvas.getContext("2d");
  cropContext.fillStyle = "#ffffff";
  cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.imageSmoothingEnabled = true;
  cropContext.imageSmoothingQuality = "high";
  cropContext.drawImage(
    rotatedCanvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );
  return { cropCanvas, cropRect };
}

function createAdjustedCanvas(sourceImage, adjustments, maxDimension, includePerspective = true) {
  const rotatedCanvas = createRotatedCanvas(sourceImage, adjustments, maxDimension);
  const { cropCanvas, cropRect } = createCroppedCanvas(rotatedCanvas, adjustments);
  return includePerspective ? applyPerspectiveCorrection(cropCanvas, adjustments, cropRect, rotatedCanvas) : cropCanvas;
}

function opencvReady() {
  return Boolean(window.cv && typeof window.cv.Mat === "function");
}

function clampNormalizedPoint(point) {
  return {
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y)),
  };
}

function getPerspectivePoints(canvas, adjustments, cropRect = null, sourceCanvas = canvas) {
  return (adjustments.corners || createDefaultCorners()).map((point) => ({
    x: (clampNormalizedPoint(point).x * sourceCanvas.width) - (cropRect ? cropRect.x : 0),
    y: (clampNormalizedPoint(point).y * sourceCanvas.height) - (cropRect ? cropRect.y : 0),
  }));
}

function distanceBetween(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function orderCorners(points) {
  const sortedBySum = [...points].sort((left, right) => (left.x + left.y) - (right.x + right.y));
  const topLeft = sortedBySum[0];
  const bottomRight = sortedBySum[3];
  const remaining = sortedBySum.slice(1, 3).sort((left, right) => (left.x - left.y) - (right.x - right.y));
  return [topLeft, remaining[0], bottomRight, remaining[1]];
}

function getPolygonArea(points) {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += (current.x * next.y) - (next.x * current.y);
  }

  return Math.abs(area / 2);
}

function getNormalizedBounds(points) {
  const normalizedPoints = points.map(clampNormalizedPoint);
  const xs = normalizedPoints.map((point) => point.x);
  const ys = normalizedPoints.map((point) => point.y);
  const left = Math.max(0, Math.min(...xs));
  const top = Math.max(0, Math.min(...ys));
  const right = Math.min(1, Math.max(...xs));
  const bottom = Math.min(1, Math.max(...ys));

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function expandBounds(bounds, padding = 0) {
  return {
    left: Math.max(0, bounds.left - padding),
    top: Math.max(0, bounds.top - padding),
    right: Math.min(1, bounds.right + padding),
    bottom: Math.min(1, bounds.bottom + padding),
  };
}

function createCornersFromBounds(bounds) {
  return [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ];
}

function getContourPoints(approximation, canvas) {
  const points = [];

  for (let row = 0; row < approximation.rows; row += 1) {
    points.push({
      x: approximation.data32S[row * 2] / canvas.width,
      y: approximation.data32S[(row * 2) + 1] / canvas.height,
    });
  }

  return points;
}

function scoreDocumentCandidate(points) {
  const orderedPoints = orderCorners(points).map(clampNormalizedPoint);
  const bounds = getNormalizedBounds(orderedPoints);
  const polygonArea = getPolygonArea(orderedPoints);
  const boundingArea = Math.max(0.0001, bounds.width * bounds.height);
  const fillRatio = polygonArea / boundingArea;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const centerDistance = Math.hypot(centerX - 0.5, centerY - 0.5) / Math.hypot(0.5, 0.5);
  const centerScore = 1 - Math.min(1, centerDistance);
  const minMargin = Math.min(bounds.left, bounds.top, 1 - bounds.right, 1 - bounds.bottom);
  const aspectRatio = bounds.width / Math.max(bounds.height, 0.0001);

  if (polygonArea < 0.08 || bounds.width < 0.2 || bounds.height < 0.2) {
    return null;
  }

  if (bounds.width > 0.99 && bounds.height > 0.99) {
    return null;
  }

  let score = polygonArea * 5;
  score += fillRatio * 1.8;
  score += centerScore * 0.9;

  if (minMargin < 0.008) {
    score -= 0.45;
  } else if (minMargin < 0.02) {
    score -= 0.2;
  }

  if (aspectRatio < 0.35 || aspectRatio > 2.4) {
    score -= 0.3;
  }

  return {
    score,
    corners: orderedPoints,
    bounds,
  };
}

function buildDocumentCandidate(points) {
  const candidate = scoreDocumentCandidate(points);
  if (!candidate) {
    return null;
  }

  return candidate;
}

function getBoundingRectPoints(contour, canvas) {
  const rect = window.cv.boundingRect(contour);
  return createCornersFromBounds({
    left: rect.x / canvas.width,
    top: rect.y / canvas.height,
    right: (rect.x + rect.width) / canvas.width,
    bottom: (rect.y + rect.height) / canvas.height,
  });
}

function getBestDocumentCandidateFromContours(contours, canvas, preferQuadrilateral = false) {
  let bestCandidate = null;

  for (let index = 0; index < contours.size(); index += 1) {
    const contour = contours.get(index);
    const perimeter = window.cv.arcLength(contour, true);
    const approx = new window.cv.Mat();
    window.cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

    const contourArea = Math.abs(window.cv.contourArea(contour)) / (canvas.width * canvas.height);
    let candidate = null;

    if (approx.rows === 4) {
      candidate = buildDocumentCandidate(getContourPoints(approx, canvas));
      if (candidate) {
        candidate.score += 0.4;
      }
    }

    if (!candidate && !preferQuadrilateral) {
      candidate = buildDocumentCandidate(getBoundingRectPoints(contour, canvas));
    }

    if (candidate) {
      candidate.score += Math.min(1.2, contourArea * 1.6);
      if (!bestCandidate || candidate.score > bestCandidate.score) {
        bestCandidate = candidate;
      }
    }

    contour.delete();
    approx.delete();
  }

  return bestCandidate;
}

function applyPerspectiveCorrection(canvas, adjustments, cropRect = null, sourceCanvas = canvas) {
  if (!adjustments.perspectiveEnabled || !opencvReady()) {
    return canvas;
  }

  const sourcePoints = orderCorners(getPerspectivePoints(canvas, adjustments, cropRect, sourceCanvas));
  const destinationWidth = Math.max(
    1,
    Math.round(Math.max(distanceBetween(sourcePoints[0], sourcePoints[1]), distanceBetween(sourcePoints[3], sourcePoints[2])))
  );
  const destinationHeight = Math.max(
    1,
    Math.round(Math.max(distanceBetween(sourcePoints[0], sourcePoints[3]), distanceBetween(sourcePoints[1], sourcePoints[2])))
  );

  const src = window.cv.imread(canvas);
  const dst = new window.cv.Mat();
  const srcTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
    sourcePoints[0].x, sourcePoints[0].y,
    sourcePoints[1].x, sourcePoints[1].y,
    sourcePoints[2].x, sourcePoints[2].y,
    sourcePoints[3].x, sourcePoints[3].y,
  ]);
  const dstTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
    0, 0,
    destinationWidth - 1, 0,
    destinationWidth - 1, destinationHeight - 1,
    0, destinationHeight - 1,
  ]);
  const matrix = window.cv.getPerspectiveTransform(srcTri, dstTri);

  window.cv.warpPerspective(
    src,
    dst,
    matrix,
    new window.cv.Size(destinationWidth, destinationHeight),
    window.cv.INTER_LINEAR,
    window.cv.BORDER_CONSTANT,
    new window.cv.Scalar(255, 255, 255, 255)
  );

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = destinationWidth;
  outputCanvas.height = destinationHeight;
  window.cv.imshow(outputCanvas, dst);

  src.delete();
  dst.delete();
  srcTri.delete();
  dstTri.delete();
  matrix.delete();
  return outputCanvas;
}

function detectDocumentShape(canvas) {
  if (!opencvReady()) {
    return null;
  }

  const src = window.cv.imread(canvas);
  const gray = new window.cv.Mat();
  const blurred = new window.cv.Mat();
  const thresholded = new window.cv.Mat();
  const closed = new window.cv.Mat();
  const edged = new window.cv.Mat();
  const dilatedEdges = new window.cv.Mat();
  const maskContours = new window.cv.MatVector();
  const maskHierarchy = new window.cv.Mat();
  const edgeContours = new window.cv.MatVector();
  const edgeHierarchy = new window.cv.Mat();
  const closeKernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(11, 11));
  const edgeKernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(5, 5));

  window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
  window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0);
  window.cv.adaptiveThreshold(blurred, thresholded, 255, window.cv.ADAPTIVE_THRESH_GAUSSIAN_C, window.cv.THRESH_BINARY, 31, 9);
  window.cv.morphologyEx(thresholded, closed, window.cv.MORPH_CLOSE, closeKernel);
  window.cv.findContours(closed, maskContours, maskHierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

  window.cv.Canny(blurred, edged, 60, 180);
  window.cv.dilate(edged, dilatedEdges, edgeKernel);
  window.cv.findContours(dilatedEdges, edgeContours, edgeHierarchy, window.cv.RETR_LIST, window.cv.CHAIN_APPROX_SIMPLE);

  const maskCandidate = getBestDocumentCandidateFromContours(maskContours, canvas, false);
  const edgeCandidate = getBestDocumentCandidateFromContours(edgeContours, canvas, true);
  const bestCandidate = [maskCandidate, edgeCandidate]
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0] || null;

  src.delete();
  gray.delete();
  blurred.delete();
  thresholded.delete();
  closed.delete();
  edged.delete();
  dilatedEdges.delete();
  maskContours.delete();
  maskHierarchy.delete();
  edgeContours.delete();
  edgeHierarchy.delete();
  closeKernel.delete();
  edgeKernel.delete();

  if (!bestCandidate) {
    return null;
  }

  return {
    corners: bestCandidate.corners,
    bounds: expandBounds(bestCandidate.bounds, autoDetectCropPadding),
  };
}

function buildRenderCanvas(sourceImage, controls, options = {}, adjustments = createDefaultAdjustments()) {
  const adjustedSource = createAdjustedCanvas(sourceImage, adjustments, options.maxDimension);
  return controls.useScanLook
    ? applyScanEffect(adjustedSource, controls, { width: adjustedSource.width, height: adjustedSource.height })
    : renderOriginalImageAtSize(adjustedSource, adjustedSource.width, adjustedSource.height);
}

function updateScanControlState() {
  const useScanLook = elements.scanLookToggle.checked;
  elements.controlsGrid.classList.toggle("disabled", !useScanLook);
  [elements.preset, elements.brightness, elements.contrast, elements.grain, elements.vignette].forEach((input) => {
    input.disabled = !useScanLook;
  });
}

function syncPresetToControls() {
  const preset = presetSettings[elements.preset.value];
  elements.brightness.value = preset.brightness;
  elements.contrast.value = preset.contrast;
  elements.grain.value = preset.grain;
  elements.vignette.value = preset.vignette;
  updatePresetDescription();
}

function updatePresetDescription() {
  elements.presetDescription.textContent = presetDescriptions[elements.preset.value];
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas conversion failed."));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}

async function convertHeicFile(file) {
  if (!window.heic2any) {
    throw new Error(`HEIC conversion library is unavailable for ${file.name}.`);
  }

  const output = await window.heic2any({
    blob: file,
    toType: "image/png",
  });
  const blob = Array.isArray(output) ? output[0] : output;
  return new File([blob], replaceFileExtension(file.name, "png"), { type: blob.type || "image/png" });
}

async function convertTiffFile(file) {
  if (!window.UTIF) {
    throw new Error(`TIFF conversion library is unavailable for ${file.name}.`);
  }

  const buffer = await file.arrayBuffer();
  const ifds = window.UTIF.decode(buffer);
  if (!ifds.length) {
    throw new Error(`Could not decode ${file.name}.`);
  }

  const firstFrame = ifds[0];
  window.UTIF.decodeImage(buffer, firstFrame);
  const rgba = window.UTIF.toRGBA8(firstFrame);
  const canvas = document.createElement("canvas");
  canvas.width = firstFrame.width;
  canvas.height = firstFrame.height;
  const context = canvas.getContext("2d");
  const imageData = new ImageData(new Uint8ClampedArray(rgba), firstFrame.width, firstFrame.height);
  context.putImageData(imageData, 0, 0);
  const blob = await canvasToBlob(canvas, "image/png", 0.92);
  return new File([blob], replaceFileExtension(file.name, "png"), { type: "image/png" });
}

async function normalizeImageFile(file) {
  const extension = getFileExtension(file.name);
  if (browserNativeExtensions.has(extension)) {
    return file;
  }

  if (extension === "heic" || extension === "heif") {
    return convertHeicFile(file);
  }

  if (extension === "tif" || extension === "tiff") {
    return convertTiffFile(file);
  }

  return file;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    image.src = url;
  });
}

function applyScanEffect(sourceImage, controls, dimensions = { width: sourceImage.width, height: sourceImage.height }) {
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = canvas.width < sourceImage.width ? "medium" : "high";
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const preset = presetSettings[controls.preset];
  const contrastFactor = controls.contrast / 100;
  const brightnessOffset = controls.brightness * 1.8;
  const grainAmount = controls.grain;
  const threshold = preset.threshold;
  const shadowBoost = preset.shadowBoost;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const baseGray = red * 0.299 + green * 0.587 + blue * 0.114;
    const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
    const noise = (Math.random() - 0.5) * grainAmount * 2;
    const adjustedGray = clamp(((baseGray - 128) * contrastFactor) + 128 + brightnessOffset + noise);
    const cleanupLift = controls.autoCleanup ? Math.max(0, adjustedGray - 168) * 0.72 : 0;
    const cleanedGray = clamp(adjustedGray + cleanupLift);
    const darkness = Math.max(0, threshold - cleanedGray) / threshold;
    const backgroundCandidate = controls.autoCleanup && cleanedGray > threshold - 18 && colorSpread < 44;
    let grayscaleValue = clamp(cleanedGray - (darkness * 255 * shadowBoost));

    if (backgroundCandidate || (controls.autoCleanup && grayscaleValue > threshold + 14)) {
      grayscaleValue = 255;
    }

    data[index] = grayscaleValue;
    data[index + 1] = grayscaleValue;
    data[index + 2] = grayscaleValue;
  }

  context.putImageData(imageData, 0, 0);
  applyPaperWash(context, canvas.width, canvas.height);
  applyVignette(context, canvas.width, canvas.height, controls.vignette);
  applyShadowEdge(context, canvas.width, canvas.height);
  return canvas;
}

function applyPaperWash(context, width, height) {
  context.save();
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.01)");
  gradient.addColorStop(0.5, "rgba(248, 248, 248, 0.04)");
  gradient.addColorStop(1, "rgba(230, 230, 230, 0.06)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function applyVignette(context, width, height, strength) {
  if (strength <= 0) {
    return;
  }

  context.save();
  const alpha = strength / 220;
  const topGradient = context.createLinearGradient(0, 0, 0, height * 0.18);
  topGradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
  topGradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = topGradient;
  context.fillRect(0, 0, width, height * 0.18);

  const bottomGradient = context.createLinearGradient(0, height, 0, height * 0.82);
  bottomGradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
  bottomGradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = bottomGradient;
  context.fillRect(0, height * 0.82, width, height * 0.18);

  const leftGradient = context.createLinearGradient(0, 0, width * 0.12, 0);
  leftGradient.addColorStop(0, `rgba(0,0,0,${alpha * 0.9})`);
  leftGradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = leftGradient;
  context.fillRect(0, 0, width * 0.12, height);

  const rightGradient = context.createLinearGradient(width, 0, width * 0.88, 0);
  rightGradient.addColorStop(0, `rgba(0,0,0,${alpha * 0.9})`);
  rightGradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = rightGradient;
  context.fillRect(width * 0.88, 0, width * 0.12, height);
  context.restore();
}

function applyShadowEdge(context, width, height) {
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.035)";
  context.fillRect(0, height - Math.max(8, height * 0.015), width, Math.max(8, height * 0.015));
  context.restore();
}

function scheduleRenderPreviews() {
  if (state.previewRenderFrame !== null) {
    cancelAnimationFrame(state.previewRenderFrame);
  }

  state.previewRenderFrame = requestAnimationFrame(() => {
    state.previewRenderFrame = null;
    renderPreviews();
  });
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

async function addFiles(fileList) {
  const images = Array.from(fileList).filter((file) => isLikelyImageFile(file));
  if (!images.length) {
    setStatus("Only image files can be converted.");
    return;
  }

  setStatus(`Preparing ${images.length} image${images.length > 1 ? "s" : ""} locally...`);
  const failures = [];

  for (const file of images) {
    try {
      const normalizedFile = await normalizeImageFile(file);
      const { image, url } = await loadImage(normalizedFile);
      state.files.push({
        id: generateId(),
        name: file.name,
        width: image.width,
        height: image.height,
        selected: false,
        blankCandidate: false,
        adjustments: createDefaultAdjustments(),
        sourceImage: image,
        sourceUrl: url,
      });
    } catch (error) {
      failures.push(file.name);
    }
  }

  renderPreviews();
  if (failures.length) {
    setStatus(`Loaded ${state.files.length} image${state.files.length === 1 ? "" : "s"}. Skipped: ${failures.join(", ")}.`);
  }
}

function renderPreviews() {
  autoDetectPendingEntries(state.files, previewMaxDimension);
  elements.previewList.innerHTML = "";
  const controls = getControls();
  const selectedCount = getSelectedEntries().length;
  const overrideCount = state.files.filter((entry) => Boolean(entry.scanSettings)).length;
  const perspectiveCount = state.files.filter((entry) => Boolean(getEntryAdjustments(entry).perspectiveEnabled)).length;
  const visibleEntries = getVisibleEntries();

  visibleEntries.forEach((entry) => {
    const fragment = elements.previewTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".preview-card");
    const blankCandidateBadge = fragment.querySelector(".blank-candidate-badge");
    const scanOverrideBadge = fragment.querySelector(".scan-override-badge");
    const perspectiveBadge = fragment.querySelector(".perspective-badge");
    const canvas = fragment.querySelector("canvas");
    const name = fragment.querySelector(".preview-name");
    const dimensions = fragment.querySelector(".preview-dimensions");
    const selectToggle = fragment.querySelector(".select-page-toggle");
    const adjustButton = fragment.querySelector(".adjust-button");
    const rotateLeftButton = fragment.querySelector(".rotate-left-button");
    const rotateRightButton = fragment.querySelector(".rotate-right-button");
    const duplicateButton = fragment.querySelector(".duplicate-button");
    const removeButton = fragment.querySelector(".remove-button");
    const effectiveControls = getEffectiveControls(entry, controls);
    const rendered = buildRenderCanvas(entry.sourceImage, effectiveControls, { maxDimension: previewMaxDimension }, getEntryAdjustments(entry));

    card.dataset.id = entry.id;
    card.classList.toggle("is-selected", Boolean(entry.selected));
    blankCandidateBadge.classList.toggle("hidden", !entry.blankCandidate);
    scanOverrideBadge.classList.toggle("hidden", !entry.scanSettings);
    perspectiveBadge.classList.toggle("hidden", !getEntryAdjustments(entry).perspectiveEnabled);
    card.addEventListener("dragstart", onDragStart);
    card.addEventListener("dragover", onDragOver);
    card.addEventListener("drop", onDrop);
    card.addEventListener("dragend", onDragEnd);

    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const previewContext = canvas.getContext("2d");
    previewContext.imageSmoothingEnabled = true;
    previewContext.imageSmoothingQuality = "medium";
    previewContext.drawImage(rendered, 0, 0);
    name.textContent = entry.name;
    dimensions.textContent = `${entry.width} x ${entry.height}px`;
    selectToggle.checked = Boolean(entry.selected);
    selectToggle.addEventListener("change", (event) => toggleSelection(entry.id, event.currentTarget.checked));
    rotateLeftButton.addEventListener("click", () => rotateEntry(entry.id, -90));
    rotateRightButton.addEventListener("click", () => rotateEntry(entry.id, 90));
    duplicateButton.addEventListener("click", () => duplicateEntry(entry.id));
    adjustButton.addEventListener("click", () => openAdjustPanel(entry.id));
    removeButton.addEventListener("click", () => removeFile(entry.id));
    elements.previewList.appendChild(fragment);
  });

  elements.downloadBtn.disabled = state.files.length === 0;
  elements.ocrBtn.disabled = state.files.length === 0;
  elements.ocrVisibleBtn.disabled = visibleEntries.length === 0;
  elements.ocrSelectedBtn.disabled = selectedCount === 0;
  elements.applyScanSelectedBtn.disabled = selectedCount === 0;
  elements.clearScanSelectedBtn.disabled = selectedCount === 0;
  elements.keepSelectedBtn.disabled = selectedCount === 0;
  elements.removeBlankBtn.disabled = state.files.length === 0;
  elements.removeSelectedBtn.disabled = selectedCount === 0;
  elements.clearBtn.disabled = state.files.length === 0;
  elements.selectAllBtn.disabled = state.files.length === 0;
  elements.selectScanOverridesBtn.disabled = overrideCount === 0;
  elements.selectPerspectivePagesBtn.disabled = perspectiveCount === 0;
  elements.clearSelectionBtn.disabled = selectedCount === 0;
  elements.adjustApplySelected.disabled = selectedCount === 0 || !state.activeAdjustId;
  updateFilterChipState();
  elements.activeFiltersSummary.textContent = getActiveFilterSummary();
  updateDownloadButtonLabel();
  updateVisibleActionLabels();
  setStatus(
    state.files.length
      ? `${state.files.length} page${state.files.length > 1 ? "s" : ""} ready in ${controls.useScanLook ? "black-and-white scan" : "original"} mode. Showing ${visibleEntries.length}. ${selectedCount ? `${selectedCount} selected for batch actions. ` : ""}Export stays on this device.`
      : "Add images to start building a local PDF."
  );
}

function rotateEntry(id, deltaDegrees) {
  const entry = state.files.find((file) => file.id === id);
  if (!entry) {
    return;
  }

  const adjustments = getEntryAdjustments(entry);
  adjustments.rotate = (((adjustments.rotate + deltaDegrees) % 360) + 360) % 360;
  if (adjustments.rotate > 180) {
    adjustments.rotate -= 360;
  }
  scheduleRenderPreviews();
}

function duplicateEntry(id) {
  const index = state.files.findIndex((file) => file.id === id);
  if (index === -1) {
    return;
  }

  const sourceEntry = state.files[index];
  const clone = {
    ...sourceEntry,
    id: generateId(),
    selected: false,
    blankCandidate: false,
    adjustments: cloneAdjustments(getEntryAdjustments(sourceEntry)),
    scanSettings: sourceEntry.scanSettings ? { ...sourceEntry.scanSettings } : null,
  };
  state.files.splice(index + 1, 0, clone);
  renderPreviews();
}

function applyScanSettingsToSelectedPages() {
  const targets = getSelectedEntries();
  if (!targets.length) {
    setStatus("Select one or more pages to copy the current scan settings.");
    return;
  }

  const scanSettings = getScanControls(getControls());
  targets.forEach((entry) => {
    entry.scanSettings = { ...scanSettings };
  });
  scheduleRenderPreviews();
  if (state.activeAdjustId) {
    renderAdjustPreview();
  }
  setStatus(`Applied the current scan settings to ${targets.length} selected page${targets.length === 1 ? "" : "s"}.`);
}

function clearScanSettingsFromSelectedPages() {
  const targets = getSelectedEntries();
  if (!targets.length) {
    setStatus("Select one or more pages to clear their page-specific scan override.");
    return;
  }

  targets.forEach((entry) => {
    entry.scanSettings = null;
  });
  scheduleRenderPreviews();
  if (state.activeAdjustId) {
    renderAdjustPreview();
  }
  setStatus(`Cleared page-specific scan overrides from ${targets.length} selected page${targets.length === 1 ? "" : "s"}.`);
}

function removeSelectedPages() {
  const selectedEntries = getSelectedEntries();
  if (!selectedEntries.length) {
    return;
  }

  selectedEntries.forEach((entry) => URL.revokeObjectURL(entry.sourceUrl));
  const selectedIds = new Set(selectedEntries.map((entry) => entry.id));
  state.files = state.files.filter((entry) => !selectedIds.has(entry.id));
  if (state.activeAdjustId && selectedIds.has(state.activeAdjustId)) {
    closeAdjustPanel();
  }
  renderPreviews();
  setStatus(`Removed ${selectedEntries.length} selected page${selectedEntries.length === 1 ? "" : "s"}.`);
}

function keepSelectedPagesOnly() {
  const selectedEntries = getSelectedEntries();
  if (!selectedEntries.length) {
    return;
  }

  const selectedIds = new Set(selectedEntries.map((entry) => entry.id));
  state.files.forEach((entry) => {
    if (!selectedIds.has(entry.id)) {
      URL.revokeObjectURL(entry.sourceUrl);
    }
  });
  state.files = state.files.filter((entry) => selectedIds.has(entry.id));
  state.files.forEach((entry) => {
    entry.selected = false;
    entry.blankCandidate = false;
  });
  if (state.activeAdjustId && !selectedIds.has(state.activeAdjustId)) {
    closeAdjustPanel();
  }
  renderPreviews();
  setStatus(`Kept ${selectedEntries.length} selected page${selectedEntries.length === 1 ? "" : "s"} and removed the rest.`);
}

function selectPagesWithScanOverrides() {
  const overrideEntries = state.files.filter((entry) => Boolean(entry.scanSettings));
  if (!overrideEntries.length) {
    setStatus("No pages currently have page-specific scan overrides.");
    return;
  }

  const overrideIds = new Set(overrideEntries.map((entry) => entry.id));
  state.files.forEach((entry) => {
    entry.selected = overrideIds.has(entry.id);
    entry.blankCandidate = false;
  });
  renderPreviews();
  setStatus(`Selected ${overrideEntries.length} page${overrideEntries.length === 1 ? "" : "s"} with page-specific scan overrides.`);
}

function selectPerspectiveCorrectedPages() {
  const perspectiveEntries = state.files.filter((entry) => Boolean(getEntryAdjustments(entry).perspectiveEnabled));
  if (!perspectiveEntries.length) {
    setStatus("No pages currently use perspective correction.");
    return;
  }

  const perspectiveIds = new Set(perspectiveEntries.map((entry) => entry.id));
  state.files.forEach((entry) => {
    entry.selected = perspectiveIds.has(entry.id);
    entry.blankCandidate = false;
  });
  renderPreviews();
  setStatus(`Selected ${perspectiveEntries.length} perspective-corrected page${perspectiveEntries.length === 1 ? "" : "s"}.`);
}

function setPageFilter(filter) {
  if (filter === "all") {
    state.pageFilters.clear();
    saveReviewSettings();
    renderPreviews();
    return;
  }

  if (state.pageFilters.has(filter)) {
    state.pageFilters.delete(filter);
  } else {
    state.pageFilters.add(filter);
  }
  saveReviewSettings();
  renderPreviews();
}

function resetPageFilters() {
  state.pageFilters.clear();
  saveReviewSettings();
  renderPreviews();
}

function applyFilterPreset(presetKey) {
  const filters = reviewPresets[presetKey];
  if (!filters) {
    return;
  }

  state.pageFilters = new Set(filters);
  if (elements.prefAutoSelectReviewPreset.checked) {
    state.files.forEach((entry) => {
      entry.selected = matchesPageFilter(entry);
    });
  }
  saveReviewSettings();
  renderPreviews();
}

function applyExportPreset(presetKey) {
  const preset = exportPresets[presetKey];
  if (!preset) {
    return;
  }

  elements.exportFormat.value = preset.exportFormat;
  if (!elements.prefAlwaysVisibleExport.checked) {
    elements.exportVisibleOnly.checked = preset.exportVisibleOnly;
  }
  if (preset.pdfQuality) {
    elements.pdfQuality.value = preset.pdfQuality;
  }
  saveReviewSettings();
  renderPreviews();
  setStatus(`Applied the ${presetKey.replace(/-/g, " ")} preset.`);
}

function getEntriesForExport() {
  const controls = getControls();
  const entries = controls.exportVisibleOnly ? getVisibleEntries() : state.files;
  return entries;
}

function createOcrCanvas(sourceImage, adjustments) {
  const canvas = createAdjustedCanvas(sourceImage, adjustments, 2200, true);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
    const boosted = gray > 175 ? 255 : Math.max(0, gray * 0.72);
    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function extractTextFromEntries(entries, scopeLabel) {
  if (!entries.length) {
    return;
  }

  autoDetectPendingEntries(entries, 2200);

  if (!window.Tesseract) {
    setStatus("OCR engine is still loading. Try again in a moment.");
    return;
  }

  elements.ocrBtn.disabled = true;
  elements.ocrSelectedBtn.disabled = true;
  const pageTexts = [];
  const language = getOcrLanguageCode();

  try {
    for (const [index, entry] of entries.entries()) {
      setStatus(`Extracting text from ${scopeLabel} page ${index + 1} of ${entries.length}...`);
      const ocrCanvas = createOcrCanvas(entry.sourceImage, getEntryAdjustments(entry));
      const result = await window.Tesseract.recognize(ocrCanvas, language, {
        logger: () => {},
      });
      pageTexts.push(`Page ${index + 1}: ${entry.name}\n${result.data.text.trim()}\n`);
    }

    downloadTextFile(`safescan-text-${Date.now()}.txt`, pageTexts.join("\n\n"));
    setStatus(`${scopeLabel === "selected" ? "Selected-page" : "OCR"} text extracted locally and downloaded.`);
  } catch (error) {
    setStatus("OCR could not finish for one or more pages.");
  } finally {
    elements.ocrBtn.disabled = state.files.length === 0;
    elements.ocrSelectedBtn.disabled = getSelectedEntries().length === 0;
  }
}

async function extractTextFromPages() {
  await extractTextFromEntries(state.files, "all");
}

async function extractTextFromVisiblePages() {
  await extractTextFromEntries(getVisibleEntries(), "visible");
}

async function extractTextFromSelectedPages() {
  await extractTextFromEntries(getSelectedEntries(), "selected");
}

function removeFile(id) {
  const entry = state.files.find((file) => file.id === id);
  if (entry) {
    URL.revokeObjectURL(entry.sourceUrl);
  }
  state.files = state.files.filter((file) => file.id !== id);
  renderPreviews();
}

function openAdjustPanel(id) {
  state.activeAdjustId = id;
  const entry = state.files.find((file) => file.id === id);
  if (!entry) {
    return;
  }

  setAdjustCropSummaryVisibility(false);
  syncAdjustInputs(entry);
  elements.adjustApplySelected.disabled = getSelectedEntries().length === 0;
  elements.adjustOverlay.classList.remove("hidden");
  elements.adjustOverlay.setAttribute("aria-hidden", "false");
  renderAdjustPreview();
}

function closeAdjustPanel() {
  state.activeAdjustId = null;
  setAdjustCropSummaryVisibility(false);
  elements.adjustApplySelected.disabled = true;
  elements.adjustOverlay.classList.add("hidden");
  elements.adjustOverlay.setAttribute("aria-hidden", "true");
}

function applyAdjustmentsToSelectedPages() {
  const sourceEntry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!sourceEntry) {
    return;
  }

  updateActiveAdjustments();
  const targets = getSelectedEntries().filter((entry) => entry.id !== sourceEntry.id);
  if (!targets.length) {
    setStatus("Select one or more other pages to batch apply these adjustments.");
    return;
  }

  const sourceAdjustments = cloneAdjustments(getEntryAdjustments(sourceEntry));
  targets.forEach((entry) => {
    entry.adjustments = cloneAdjustments(sourceAdjustments);
  });
  renderAdjustPreview();
  scheduleRenderPreviews();
  setStatus(`Applied the current adjustments to ${targets.length} selected page${targets.length === 1 ? "" : "s"}.`);
}

async function removeBlankPages() {
  if (!state.files.length) {
    return;
  }

  elements.removeBlankBtn.disabled = true;
  const controls = getControls();
  const blankIds = [];

  try {
    for (const [index, entry] of state.files.entries()) {
      setStatus(`Checking page ${index + 1} of ${state.files.length} for blank content...`);
      const effectiveControls = getEffectiveControls(entry, controls);
      const cleanedCanvas = buildRenderCanvas(
        entry.sourceImage,
        { ...effectiveControls, useScanLook: true, grain: 0, vignette: 0 },
        { maxDimension: 1200 },
        getEntryAdjustments(entry)
      );
      if (estimateBlankness(cleanedCanvas).isBlank) {
        blankIds.push(entry.id);
      }
    }

    if (!blankIds.length) {
      setStatus("No blank pages were detected.");
      return;
    }

    if (elements.selectDetectedBlanks.checked) {
      const blankIdSet = new Set(blankIds);
      state.files.forEach((entry) => {
        entry.selected = blankIdSet.has(entry.id);
        entry.blankCandidate = blankIdSet.has(entry.id);
      });
      renderPreviews();
      setStatus(`Selected ${blankIds.length} detected blank page${blankIds.length === 1 ? "" : "s"}. Review them, then use Remove Selected Pages.`);
      return;
    }

    state.files = state.files.filter((entry) => !blankIds.includes(entry.id));
    renderPreviews();
    setStatus(`Removed ${blankIds.length} blank page${blankIds.length === 1 ? "" : "s"}.`);
  } finally {
    elements.removeBlankBtn.disabled = state.files.length === 0;
  }
}

async function exportImageSet(format) {
  const entries = getEntriesForExport();
  if (!entries.length) {
    setStatus("There are no pages available to export with the current filter settings.");
    return;
  }

  const pendingAutoDetectCount = countPendingAutoDetectEntries(entries);
  if (pendingAutoDetectCount && !opencvReady()) {
    setStatus(`Document cleanup is still loading. Wait a moment and export again so ${pendingAutoDetectCount === 1 ? "this page is" : "these pages are"} flattened like scanned documents.`);
    return;
  }

  autoDetectPendingEntries(entries);

  if (!window.JSZip) {
    setStatus("ZIP export is still loading. Try again in a moment.");
    return;
  }

  const controls = getControls();
  const qualitySettings = getPdfQualitySettings(controls.pdfQuality);
  const zip = new window.JSZip();
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const extension = format === "png" ? "png" : "jpg";

  setStatus(`Rendering ${entries.length} ${extension.toUpperCase()} page${entries.length === 1 ? "" : "s"} locally...`);

  for (const [index, entry] of entries.entries()) {
    const effectiveControls = getEffectiveControls(entry, controls);
    const rendered = buildRenderCanvas(
      entry.sourceImage,
      effectiveControls,
      { maxDimension: qualitySettings.scaleLimit },
      getEntryAdjustments(entry)
    );
    const blob = await canvasToBlob(rendered, mimeType, format === "png" ? undefined : qualitySettings.jpegQuality);
    const fileName = `${String(index + 1).padStart(3, "0")}-${sanitizeBaseName(entry.name)}.${extension}`;
    zip.file(fileName, blob);
  }

  const archive = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: format === "png" ? 3 : 6 },
  });

  downloadBlob(`safescan-${extension}-pages-${Date.now()}.zip`, archive);
  setStatus(`${extension.toUpperCase()} page set generated locally and downloaded.`);
}

async function exportOutput() {
  const format = elements.exportFormat.value;
  if (format === "pdf") {
    await exportPdf();
    return;
  }

  await exportImageSet(format);
}

function updateActiveAdjustments() {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  entry.adjustments = {
    rotate: Number(elements.adjustRotate.value),
    cropTop: Number(elements.adjustCropTop.value),
    cropRight: Number(elements.adjustCropRight.value),
    cropBottom: Number(elements.adjustCropBottom.value),
    cropLeft: Number(elements.adjustCropLeft.value),
    perspectiveEnabled: elements.adjustPerspective.checked,
    corners: getEntryAdjustments(entry).corners,
  };
}

function syncAdjustInputs(entry) {
  const adjustments = getEntryAdjustments(entry);
  elements.adjustRotate.value = adjustments.rotate;
  elements.adjustCropTop.value = adjustments.cropTop;
  elements.adjustCropRight.value = adjustments.cropRight;
  elements.adjustCropBottom.value = adjustments.cropBottom;
  elements.adjustCropLeft.value = adjustments.cropLeft;
  elements.adjustPerspective.checked = adjustments.perspectiveEnabled;
  updateAdjustCropSummary(adjustments);
}

function updateAdjustCropSummary(adjustments) {
  if (!elements.adjustCropSummary) {
    return;
  }

  const top = Math.round(adjustments.cropTop || 0);
  const right = Math.round(adjustments.cropRight || 0);
  const bottom = Math.round(adjustments.cropBottom || 0);
  const left = Math.round(adjustments.cropLeft || 0);
  const visibleWidth = Math.max(minRemainingCropPercent, 100 - left - right);
  const visibleHeight = Math.max(minRemainingCropPercent, 100 - top - bottom);

  elements.adjustCropSummary.innerHTML = `<strong>Crop</strong> Top ${top}%, Right ${right}%, Bottom ${bottom}%, Left ${left}%. <strong>Visible area</strong> ${Math.round(visibleWidth)}% wide by ${Math.round(visibleHeight)}% high.`;
}

function setAdjustCropSummaryVisibility(isVisible) {
  if (!elements.adjustCropSummary) {
    return;
  }

  elements.adjustCropSummary.classList.toggle("hidden", !isVisible);
  if (isVisible) {
    positionCropBox();
  }
}

function positionAdjustCropSummary(cropRect) {
  if (!elements.adjustCropSummary || !state.adjustPreviewMetrics) {
    return;
  }

  const { displayWidth, displayHeight, scaleX, scaleY, offsetLeft, offsetTop } = state.adjustPreviewMetrics;
  const summaryBounds = elements.adjustCropSummary.getBoundingClientRect();
  const summaryWidth = Math.min(summaryBounds.width || 260, Math.max(140, displayWidth - 16));
  const summaryHeight = summaryBounds.height || 62;
  const cropLeft = offsetLeft + (cropRect.x * scaleX);
  const cropTop = offsetTop + (cropRect.y * scaleY);
  const cropWidth = cropRect.width * scaleX;
  const cropHeight = cropRect.height * scaleY;
  const minLeft = offsetLeft + 8;
  const maxLeft = offsetLeft + displayWidth - summaryWidth - 8;
  const preferredLeft = cropLeft + 12;
  const left = Math.max(minLeft, Math.min(maxLeft, preferredLeft));
  const preferredTop = cropTop - summaryHeight - 12;
  const fallbackTop = cropTop + cropHeight + 12;
  const minTop = offsetTop + 8;
  const maxTop = offsetTop + displayHeight - summaryHeight - 8;
  const top = preferredTop >= minTop
    ? preferredTop
    : Math.max(minTop, Math.min(maxTop, fallbackTop));

  elements.adjustCropSummary.style.left = `${left}px`;
  elements.adjustCropSummary.style.top = `${top}px`;
}

function updateAdjustPreviewMetrics() {
  const sourceWidth = elements.adjustPreviewCanvas.width;
  const sourceHeight = elements.adjustPreviewCanvas.height;

  if (!sourceWidth || !sourceHeight) {
    state.adjustPreviewMetrics = null;
    return null;
  }

  const canvasBounds = elements.adjustPreviewCanvas.getBoundingClientRect();
  const surfaceBounds = elements.adjustPreviewSurface.getBoundingClientRect();
  const displayWidth = canvasBounds.width || sourceWidth;
  const displayHeight = canvasBounds.height || sourceHeight;

  state.adjustPreviewMetrics = {
    sourceWidth,
    sourceHeight,
    displayWidth,
    displayHeight,
    scaleX: displayWidth / sourceWidth,
    scaleY: displayHeight / sourceHeight,
    offsetLeft: canvasBounds.left - surfaceBounds.left,
    offsetTop: canvasBounds.top - surfaceBounds.top,
  };

  return state.adjustPreviewMetrics;
}

function positionCropBox() {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry || !state.adjustPreviewMetrics) {
    return;
  }

  const cropRect = getCropRectForDimensions(
    state.adjustPreviewMetrics.sourceWidth,
    state.adjustPreviewMetrics.sourceHeight,
    getEntryAdjustments(entry)
  );
  const { displayWidth, displayHeight, scaleX, scaleY, offsetLeft, offsetTop } = state.adjustPreviewMetrics;
  elements.cropOverlay.style.left = `${offsetLeft}px`;
  elements.cropOverlay.style.top = `${offsetTop}px`;
  elements.cropOverlay.style.width = `${displayWidth}px`;
  elements.cropOverlay.style.height = `${displayHeight}px`;
  elements.cropBox.style.left = `${cropRect.x * scaleX}px`;
  elements.cropBox.style.top = `${cropRect.y * scaleY}px`;
  elements.cropBox.style.width = `${cropRect.width * scaleX}px`;
  elements.cropBox.style.height = `${cropRect.height * scaleY}px`;
  positionAdjustCropSummary(cropRect);
}

function positionCornerHandles() {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry || !state.adjustPreviewMetrics) {
    return;
  }

  const { displayWidth, displayHeight, offsetLeft, offsetTop } = state.adjustPreviewMetrics;
  elements.cornerOverlay.style.left = `${offsetLeft}px`;
  elements.cornerOverlay.style.top = `${offsetTop}px`;
  elements.cornerOverlay.style.width = `${displayWidth}px`;
  elements.cornerOverlay.style.height = `${displayHeight}px`;
  getEntryAdjustments(entry).corners.forEach((point, index) => {
    const handle = elements.cornerHandles[index];
    handle.style.left = `${point.x * displayWidth}px`;
    handle.style.top = `${point.y * displayHeight}px`;
  });
}

function renderAdjustPreview() {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  const controls = getEffectiveControls(entry, getControls());
  const baseCanvas = getBaseAdjustedCanvas(entry.sourceImage, getEntryAdjustments(entry), adjustPreviewMaxDimension);
  const correctedCanvas = buildRenderCanvas(
    entry.sourceImage,
    controls,
    { maxDimension: adjustPreviewMaxDimension },
    getEntryAdjustments(entry)
  );
  const canvas = elements.adjustPreviewCanvas;
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "medium";
  context.drawImage(baseCanvas, 0, 0);

  const resultCanvas = elements.adjustResultCanvas;
  resultCanvas.width = correctedCanvas.width;
  resultCanvas.height = correctedCanvas.height;
  const resultContext = resultCanvas.getContext("2d");
  resultContext.imageSmoothingEnabled = true;
  resultContext.imageSmoothingQuality = "medium";
  resultContext.drawImage(correctedCanvas, 0, 0);

  updateAdjustPreviewMetrics();
  positionCropBox();
  elements.cornerOverlay.classList.toggle("hidden", !getEntryAdjustments(entry).perspectiveEnabled);
  elements.cornerOverlay.setAttribute("aria-hidden", String(!getEntryAdjustments(entry).perspectiveEnabled));
  positionCornerHandles();
}

function resetActiveAdjustments() {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  entry.adjustments = createDefaultAdjustments();
  syncAdjustInputs(entry);
  renderAdjustPreview();
  scheduleRenderPreviews();
}

function updateCropAdjustmentFromPoint(edge, normalizedPoint) {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  const adjustments = getEntryAdjustments(entry);
  const maxCombinedCrop = 100 - minRemainingCropPercent;

  if (edge === "top") {
    adjustments.cropTop = Math.max(0, Math.min(maxCropPercent, normalizedPoint.y * 100));
  }

  if (edge === "right") {
    adjustments.cropRight = Math.max(0, Math.min(maxCropPercent, (1 - normalizedPoint.x) * 100));
  }

  if (edge === "bottom") {
    adjustments.cropBottom = Math.max(0, Math.min(maxCropPercent, (1 - normalizedPoint.y) * 100));
  }

  if (edge === "left") {
    adjustments.cropLeft = Math.max(0, Math.min(maxCropPercent, normalizedPoint.x * 100));
  }

  if (adjustments.cropTop + adjustments.cropBottom > maxCombinedCrop) {
    if (edge === "top") {
      adjustments.cropTop = maxCombinedCrop - adjustments.cropBottom;
    } else {
      adjustments.cropBottom = maxCombinedCrop - adjustments.cropTop;
    }
  }

  if (adjustments.cropLeft + adjustments.cropRight > maxCombinedCrop) {
    if (edge === "left") {
      adjustments.cropLeft = maxCombinedCrop - adjustments.cropRight;
    } else {
      adjustments.cropRight = maxCombinedCrop - adjustments.cropLeft;
    }
  }

  syncAdjustInputs(entry);
}

function handleCropPointerDown(event) {
  state.activeCropEdge = event.currentTarget.dataset.edge;
  setAdjustCropSummaryVisibility(true);
  event.currentTarget.setPointerCapture(event.pointerId);
}

function shiftCropWindow(horizontalDelta, verticalDelta) {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  const adjustments = getEntryAdjustments(entry);
  const safeHorizontalDelta = horizontalDelta >= 0
    ? Math.min(horizontalDelta, adjustments.cropRight, maxCropPercent - adjustments.cropLeft)
    : -Math.min(-horizontalDelta, adjustments.cropLeft, maxCropPercent - adjustments.cropRight);
  const safeVerticalDelta = verticalDelta >= 0
    ? Math.min(verticalDelta, adjustments.cropBottom, maxCropPercent - adjustments.cropTop)
    : -Math.min(-verticalDelta, adjustments.cropTop, maxCropPercent - adjustments.cropBottom);

  adjustments.cropLeft = Math.max(0, Math.min(maxCropPercent, adjustments.cropLeft + safeHorizontalDelta));
  adjustments.cropRight = Math.max(0, Math.min(maxCropPercent, adjustments.cropRight - safeHorizontalDelta));
  adjustments.cropTop = Math.max(0, Math.min(maxCropPercent, adjustments.cropTop + safeVerticalDelta));
  adjustments.cropBottom = Math.max(0, Math.min(maxCropPercent, adjustments.cropBottom - safeVerticalDelta));
  syncAdjustInputs(entry);
}

function handleCropBoxPointerDown(event) {
  if (event.target !== elements.cropBox) {
    return;
  }

  event.preventDefault();
  state.activeCropEdge = "move";
  state.activeCropPointer = { x: event.clientX, y: event.clientY };
  setAdjustCropSummaryVisibility(true);
  elements.cropBox.setPointerCapture(event.pointerId);
}

function handleCropBoxPointerMove(event) {
  if (state.activeCropEdge !== "move" || !state.activeCropPointer) {
    return;
  }

  const overlayBounds = elements.cropOverlay.getBoundingClientRect();
  const deltaX = ((event.clientX - state.activeCropPointer.x) / overlayBounds.width) * 100;
  const deltaY = ((event.clientY - state.activeCropPointer.y) / overlayBounds.height) * 100;
  state.activeCropPointer = { x: event.clientX, y: event.clientY };
  shiftCropWindow(deltaX, deltaY);
  renderAdjustPreview();
  scheduleRenderPreviews();
}

function handleCropBoxPointerUp(event) {
  if (state.activeCropEdge !== "move") {
    return;
  }

  state.activeCropEdge = null;
  state.activeCropPointer = null;
  setAdjustCropSummaryVisibility(false);
  elements.cropBox.releasePointerCapture(event.pointerId);
}

function handleCropPointerMove(event) {
  if (!state.activeCropEdge) {
    return;
  }

  const overlayBounds = elements.cropOverlay.getBoundingClientRect();
  const normalizedPoint = clampNormalizedPoint({
    x: (event.clientX - overlayBounds.left) / overlayBounds.width,
    y: (event.clientY - overlayBounds.top) / overlayBounds.height,
  });
  updateCropAdjustmentFromPoint(state.activeCropEdge, normalizedPoint);
  renderAdjustPreview();
  scheduleRenderPreviews();
}

function handleCropPointerUp(event) {
  state.activeCropEdge = null;
  setAdjustCropSummaryVisibility(false);
  event.currentTarget.releasePointerCapture(event.pointerId);
}

function handleCropKeydown(event) {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  const adjustments = getEntryAdjustments(entry);
  const step = event.shiftKey ? 1 : 0.3;
  let handled = false;

  if (event.currentTarget.dataset.edge === "top" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    adjustments.cropTop += event.key === "ArrowDown" ? step : -step;
    handled = true;
  }

  if (event.currentTarget.dataset.edge === "bottom" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    adjustments.cropBottom += event.key === "ArrowUp" ? step : -step;
    handled = true;
  }

  if (event.currentTarget.dataset.edge === "left" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    adjustments.cropLeft += event.key === "ArrowRight" ? step : -step;
    handled = true;
  }

  if (event.currentTarget.dataset.edge === "right" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    adjustments.cropRight += event.key === "ArrowLeft" ? step : -step;
    handled = true;
  }

  if (!handled) {
    return;
  }

  event.preventDefault();
  adjustments.cropTop = Math.max(0, Math.min(maxCropPercent, adjustments.cropTop));
  adjustments.cropRight = Math.max(0, Math.min(maxCropPercent, adjustments.cropRight));
  adjustments.cropBottom = Math.max(0, Math.min(maxCropPercent, adjustments.cropBottom));
  adjustments.cropLeft = Math.max(0, Math.min(maxCropPercent, adjustments.cropLeft));
  syncAdjustInputs(entry);
  renderAdjustPreview();
  scheduleRenderPreviews();
}

function handleCropBoxKeydown(event) {
  const movementMap = {
    ArrowUp: { x: 0, y: -1 },
    ArrowRight: { x: 1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
  };
  const movement = movementMap[event.key];
  if (!movement) {
    return;
  }

  event.preventDefault();
  const step = event.shiftKey ? 1 : 0.3;
  shiftCropWindow(movement.x * step, movement.y * step);
  renderAdjustPreview();
  scheduleRenderPreviews();
}

function handleCornerPointerDown(event) {
  const cornerIndex = Number(event.currentTarget.dataset.corner);
  state.activeCornerIndex = cornerIndex;
  event.currentTarget.setPointerCapture(event.pointerId);
}

function handleCornerPointerMove(event) {
  if (state.activeCornerIndex === null || !state.adjustPreviewMetrics) {
    return;
  }

  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  const overlayBounds = elements.cornerOverlay.getBoundingClientRect();
  const normalizedPoint = clampNormalizedPoint({
    x: (event.clientX - overlayBounds.left) / overlayBounds.width,
    y: (event.clientY - overlayBounds.top) / overlayBounds.height,
  });
  getEntryAdjustments(entry).corners[state.activeCornerIndex] = normalizedPoint;
  positionCornerHandles();
  renderAdjustPreview();
  scheduleRenderPreviews();
}

function handleCornerPointerUp(event) {
  state.activeCornerIndex = null;
  event.currentTarget.releasePointerCapture(event.pointerId);
}

function handleCornerKeydown(event) {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  const movementMap = {
    ArrowUp: { x: 0, y: -1 },
    ArrowRight: { x: 1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
  };
  const movement = movementMap[event.key];
  if (!movement) {
    return;
  }

  event.preventDefault();
  const step = event.shiftKey ? 0.01 : 0.003;
  const cornerIndex = Number(event.currentTarget.dataset.corner);
  const currentPoint = getEntryAdjustments(entry).corners[cornerIndex];
  getEntryAdjustments(entry).corners[cornerIndex] = clampNormalizedPoint({
    x: currentPoint.x + (movement.x * step),
    y: currentPoint.y + (movement.y * step),
  });
  renderAdjustPreview();
  scheduleRenderPreviews();
}

function autoDetectActiveDocument() {
  const entry = state.files.find((file) => file.id === state.activeAdjustId);
  if (!entry) {
    return;
  }

  const baseCanvas = getBaseAdjustedCanvas(entry.sourceImage, getEntryAdjustments(entry), adjustPreviewMaxDimension);
  const detectedDocument = detectDocumentShape(baseCanvas);
  if (!detectedDocument) {
    setStatus(opencvReady() ? "Could not detect document edges automatically. Adjust the corners manually." : "OpenCV is still loading. Try auto detect again in a moment, or adjust corners manually.");
    return;
  }

  const adjustments = getEntryAdjustments(entry);
  applyDetectedDocumentAdjustments(adjustments, detectedDocument);
  syncAdjustInputs(entry);
  elements.adjustPerspective.checked = true;
  renderAdjustPreview();
  scheduleRenderPreviews();
  setStatus("Detected the sheet bounds and cropped away the surrounding photo background. Fine-tune the box if needed.");
}

function clearAll() {
  state.files.forEach((entry) => URL.revokeObjectURL(entry.sourceUrl));
  state.files = [];
  renderPreviews();
}

function onDragStart(event) {
  state.draggingId = event.currentTarget.dataset.id;
  event.currentTarget.classList.add("dragging");
}

function onDragOver(event) {
  event.preventDefault();
}

function onDrop(event) {
  event.preventDefault();
  const targetId = event.currentTarget.dataset.id;
  if (!state.draggingId || state.draggingId === targetId) {
    return;
  }

  const fromIndex = state.files.findIndex((file) => file.id === state.draggingId);
  const toIndex = state.files.findIndex((file) => file.id === targetId);
  const [moved] = state.files.splice(fromIndex, 1);
  state.files.splice(toIndex, 0, moved);
  renderPreviews();
}

function onDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
  state.draggingId = null;
}

async function exportPdf() {
  const entries = getEntriesForExport();
  if (!entries.length) {
    setStatus("There are no pages available to export with the current filter settings.");
    return;
  }

  const pendingAutoDetectCount = countPendingAutoDetectEntries(entries);
  if (pendingAutoDetectCount && !opencvReady()) {
    setStatus(`Document cleanup is still loading. Wait a moment and export again so ${pendingAutoDetectCount === 1 ? "this page is" : "these pages are"} flattened like scanned documents.`);
    return;
  }

  autoDetectPendingEntries(entries);

  const pageSize = pageFormats[elements.pageSize.value];
  const doc = new jsPDF({
    orientation: pageSize.width > pageSize.height ? "landscape" : "portrait",
    unit: "mm",
    format: [pageSize.width, pageSize.height],
    compress: true,
  });

  const controls = getControls();
  const qualitySettings = getPdfQualitySettings(controls.pdfQuality);
  setStatus("Rendering PDF locally...");

  for (const [index, entry] of entries.entries()) {
    const effectiveControls = getEffectiveControls(entry, controls);
    const rendered = buildRenderCanvas(
      entry.sourceImage,
      effectiveControls,
      { maxDimension: qualitySettings.scaleLimit },
      getEntryAdjustments(entry)
    );
    const exportFormat = effectiveControls.useScanLook ? "PNG" : "JPEG";
    const dataUrl = effectiveControls.useScanLook
      ? rendered.toDataURL("image/png")
      : rendered.toDataURL("image/jpeg", qualitySettings.jpegQuality);
    const imageRatio = rendered.width / rendered.height;
    const pageRatio = pageSize.width / pageSize.height;
    const margin = controls.pageMargin;
    let renderWidth = pageSize.width - (margin * 2);
    let renderHeight = pageSize.height - (margin * 2);

    if (controls.imageFit === "cover") {
      if (imageRatio > pageRatio) {
        renderWidth = renderHeight * imageRatio;
      } else {
        renderHeight = renderWidth / imageRatio;
      }
    } else {
      if (imageRatio > pageRatio) {
        renderHeight = renderWidth / imageRatio;
      } else {
        renderWidth = renderHeight * imageRatio;
      }
    }

    const offsetX = (pageSize.width - renderWidth) / 2;
    const offsetY = (pageSize.height - renderHeight) / 2;

    if (index > 0) {
      doc.addPage([pageSize.width, pageSize.height], pageSize.width > pageSize.height ? "landscape" : "portrait");
    }

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageSize.width, pageSize.height, "F");
    doc.addImage(dataUrl, exportFormat, offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
  }

  doc.save(`safescan-${Date.now()}.pdf`);
  setStatus("PDF generated locally and downloaded.");
}

function handleDropzoneKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    elements.fileInput.click();
  }
}

elements.dropzone.addEventListener("click", () => elements.fileInput.click());
elements.dropzone.addEventListener("keydown", handleDropzoneKeydown);
elements.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
elements.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropzone.classList.add("drag-active");
});
elements.dropzone.addEventListener("dragleave", () => {
  elements.dropzone.classList.remove("drag-active");
});
elements.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove("drag-active");
  addFiles(event.dataTransfer.files);
});

elements.preset.addEventListener("change", () => {
  syncPresetToControls();
  scheduleRenderPreviews();
  renderAdjustPreview();
});

elements.scanLookToggle.addEventListener("change", () => {
  updateScanControlState();
  scheduleRenderPreviews();
  renderAdjustPreview();
});

elements.autoCleanup.addEventListener("change", () => {
  scheduleRenderPreviews();
  renderAdjustPreview();
});

elements.selectDetectedBlanks.addEventListener("change", updateBlankActionLabel);

[elements.brightness, elements.contrast, elements.grain, elements.vignette].forEach((input) => {
  input.addEventListener("input", () => {
    scheduleRenderPreviews();
    renderAdjustPreview();
  });
});

[elements.adjustRotate, elements.adjustCropTop, elements.adjustCropRight, elements.adjustCropBottom, elements.adjustCropLeft].forEach((input) => {
  input.addEventListener("input", () => {
    updateActiveAdjustments();
    renderAdjustPreview();
    scheduleRenderPreviews();
  });
});

elements.adjustPerspective.addEventListener("change", () => {
  updateActiveAdjustments();
  renderAdjustPreview();
  scheduleRenderPreviews();
});

elements.adjustAutoDetect.addEventListener("click", autoDetectActiveDocument);

elements.cropHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", handleCropPointerDown);
  handle.addEventListener("pointermove", handleCropPointerMove);
  handle.addEventListener("pointerup", handleCropPointerUp);
  handle.addEventListener("pointercancel", handleCropPointerUp);
  handle.addEventListener("keydown", handleCropKeydown);
});

elements.cropBox.addEventListener("pointerdown", handleCropBoxPointerDown);
elements.cropBox.addEventListener("pointermove", handleCropBoxPointerMove);
elements.cropBox.addEventListener("pointerup", handleCropBoxPointerUp);
elements.cropBox.addEventListener("pointercancel", handleCropBoxPointerUp);
elements.cropBox.addEventListener("keydown", handleCropBoxKeydown);

elements.cornerHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", handleCornerPointerDown);
  handle.addEventListener("pointermove", handleCornerPointerMove);
  handle.addEventListener("pointerup", handleCornerPointerUp);
  handle.addEventListener("pointercancel", handleCornerPointerUp);
  handle.addEventListener("keydown", handleCornerKeydown);
});

elements.adjustClose.addEventListener("click", closeAdjustPanel);
elements.adjustDone.addEventListener("click", () => {
  scheduleRenderPreviews();
  closeAdjustPanel();
});
elements.adjustReset.addEventListener("click", resetActiveAdjustments);
elements.adjustApplySelected.addEventListener("click", applyAdjustmentsToSelectedPages);
elements.adjustOverlay.addEventListener("click", (event) => {
  if (event.target === elements.adjustOverlay) {
    closeAdjustPanel();
  }
});

window.addEventListener("resize", () => {
  if (!state.activeAdjustId) {
    return;
  }

  updateAdjustPreviewMetrics();
  positionCropBox();
  positionCornerHandles();
});

elements.downloadBtn.addEventListener("click", exportOutput);
elements.ocrBtn.addEventListener("click", extractTextFromPages);
elements.ocrVisibleBtn.addEventListener("click", extractTextFromVisiblePages);
elements.ocrSelectedBtn.addEventListener("click", extractTextFromSelectedPages);
elements.applyScanSelectedBtn.addEventListener("click", applyScanSettingsToSelectedPages);
elements.clearScanSelectedBtn.addEventListener("click", clearScanSettingsFromSelectedPages);
elements.keepSelectedBtn.addEventListener("click", keepSelectedPagesOnly);
elements.removeBlankBtn.addEventListener("click", removeBlankPages);
elements.removeSelectedBtn.addEventListener("click", removeSelectedPages);
elements.clearBtn.addEventListener("click", clearAll);
elements.selectAllBtn.addEventListener("click", () => setAllSelections(true));
elements.selectScanOverridesBtn.addEventListener("click", selectPagesWithScanOverrides);
elements.selectPerspectivePagesBtn.addEventListener("click", selectPerspectiveCorrectedPages);
elements.clearSelectionBtn.addEventListener("click", () => setAllSelections(false));
elements.resetFiltersBtn.addEventListener("click", resetPageFilters);
elements.filterChips.forEach((chip) => {
  chip.addEventListener("click", () => setPageFilter(chip.dataset.filter));
});
elements.filterPresetButtons.forEach((button) => {
  button.addEventListener("click", () => applyFilterPreset(button.dataset.preset));
});
elements.exportPresetButtons.forEach((button) => {
  button.addEventListener("click", () => applyExportPreset(button.dataset.exportPreset));
});
elements.exportFormat.addEventListener("change", () => {
  saveReviewSettings();
  renderPreviews();
});
elements.pdfQuality.addEventListener("change", () => {
  saveReviewSettings();
  renderPreviews();
});
elements.exportVisibleOnly.addEventListener("change", () => {
  saveReviewSettings();
  renderPreviews();
});
elements.ocrLanguage.addEventListener("change", saveReviewSettings);
elements.ocrLanguageCustom.addEventListener("input", saveReviewSettings);
[elements.prefAlwaysVisibleExport, elements.prefRememberOcrLanguage, elements.prefRememberReviewPreset, elements.prefAutoSelectReviewPreset].forEach((input) => {
  input.addEventListener("change", () => {
    updateAutomationPreferenceState();
    saveReviewSettings();
    renderPreviews();
  });
});

loadReviewSettings();
syncPresetToControls();
updateScanControlState();
updateAutomationPreferenceState();
updateDownloadButtonLabel();
updateVisibleActionLabels();
updateBlankActionLabel();
renderPreviews();