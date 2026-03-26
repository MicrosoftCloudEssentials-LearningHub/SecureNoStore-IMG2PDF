const { jsPDF } = window.jspdf;

const pageFormats = {
  a4: { width: 210, height: 297 },
  letter: { width: 216, height: 279 },
};

const presetSettings = {
  clean: { brightness: 12, contrast: 112, grain: 2, vignette: 4, threshold: 172 },
  classic: { brightness: 8, contrast: 124, grain: 7, vignette: 14, threshold: 156 },
  "high-contrast": { brightness: 4, contrast: 152, grain: 4, vignette: 9, threshold: 142 },
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

const state = {
  files: [],
  draggingId: null,
};

const elements = {
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#file-input"),
  previewList: document.querySelector("#preview-list"),
  previewTemplate: document.querySelector("#preview-template"),
  status: document.querySelector("#status"),
  downloadBtn: document.querySelector("#download-btn"),
  clearBtn: document.querySelector("#clear-btn"),
  pageSize: document.querySelector("#page-size"),
  scanLookToggle: document.querySelector("#scan-look-toggle"),
  preset: document.querySelector("#scan-preset"),
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
  };
}

function renderOriginalImage(sourceImage) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const context = canvas.getContext("2d");
  context.drawImage(sourceImage, 0, 0);
  return canvas;
}

function buildRenderCanvas(sourceImage, controls) {
  return controls.useScanLook ? applyScanEffect(sourceImage, controls) : renderOriginalImage(sourceImage);
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

function applyScanEffect(sourceImage, controls) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const preset = presetSettings[controls.preset];
  const contrastFactor = controls.contrast / 100;
  const brightnessOffset = controls.brightness * 1.8;
  const grainAmount = controls.grain;
  const threshold = preset.threshold;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const baseGray = red * 0.299 + green * 0.587 + blue * 0.114;
    const noise = (Math.random() - 0.5) * grainAmount * 2;
    const adjustedGray = clamp(((baseGray - 128) * contrastFactor) + 128 + brightnessOffset + noise);
    const binaryValue = adjustedGray >= threshold ? 255 : 0;

    data[index] = binaryValue;
    data[index + 1] = binaryValue;
    data[index + 2] = binaryValue;
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
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.02)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
  gradient.addColorStop(1, "rgba(232, 232, 232, 0.08)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function applyVignette(context, width, height, strength) {
  context.save();
  const radius = Math.max(width, height) * 0.72;
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    radius * 0.2,
    width / 2,
    height / 2,
    radius
  );
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${strength / 140})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function applyShadowEdge(context, width, height) {
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.05)";
  context.fillRect(0, height - Math.max(8, height * 0.015), width, Math.max(8, height * 0.015));
  context.restore();
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
  elements.previewList.innerHTML = "";
  const controls = getControls();

  state.files.forEach((entry) => {
    const fragment = elements.previewTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".preview-card");
    const canvas = fragment.querySelector("canvas");
    const name = fragment.querySelector(".preview-name");
    const dimensions = fragment.querySelector(".preview-dimensions");
    const removeButton = fragment.querySelector(".icon-button");
    const rendered = buildRenderCanvas(entry.sourceImage, controls);

    card.dataset.id = entry.id;
    card.addEventListener("dragstart", onDragStart);
    card.addEventListener("dragover", onDragOver);
    card.addEventListener("drop", onDrop);
    card.addEventListener("dragend", onDragEnd);

    canvas.width = rendered.width;
    canvas.height = rendered.height;
    canvas.getContext("2d").drawImage(rendered, 0, 0);
    name.textContent = entry.name;
    dimensions.textContent = `${entry.width} x ${entry.height}px`;
    removeButton.addEventListener("click", () => removeFile(entry.id));
    elements.previewList.appendChild(fragment);
  });

  elements.downloadBtn.disabled = state.files.length === 0;
  elements.clearBtn.disabled = state.files.length === 0;
  setStatus(
    state.files.length
      ? `${state.files.length} page${state.files.length > 1 ? "s" : ""} ready in ${controls.useScanLook ? "scanned" : "original"} mode. Export stays on this device.`
      : "Add images to start building a local PDF."
  );
}

function removeFile(id) {
  const entry = state.files.find((file) => file.id === id);
  if (entry) {
    URL.revokeObjectURL(entry.sourceUrl);
  }
  state.files = state.files.filter((file) => file.id !== id);
  renderPreviews();
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
  if (!state.files.length) {
    return;
  }

  const pageSize = pageFormats[elements.pageSize.value];
  const doc = new jsPDF({
    orientation: pageSize.width > pageSize.height ? "landscape" : "portrait",
    unit: "mm",
    format: [pageSize.width, pageSize.height],
    compress: true,
  });

  const controls = getControls();
  setStatus(`Rendering ${controls.useScanLook ? "scanned" : "original"} PDF locally...`);

  for (const [index, entry] of state.files.entries()) {
    const rendered = buildRenderCanvas(entry.sourceImage, controls);
    const dataUrl = rendered.toDataURL("image/jpeg", 0.92);
    const imageRatio = rendered.width / rendered.height;
    const pageRatio = pageSize.width / pageSize.height;
    const margin = 8;
    let renderWidth = pageSize.width - (margin * 2);
    let renderHeight = pageSize.height - (margin * 2);

    if (imageRatio > pageRatio) {
      renderHeight = renderWidth / imageRatio;
    } else {
      renderWidth = renderHeight * imageRatio;
    }

    const offsetX = (pageSize.width - renderWidth) / 2;
    const offsetY = (pageSize.height - renderHeight) / 2;

    if (index > 0) {
      doc.addPage([pageSize.width, pageSize.height], pageSize.width > pageSize.height ? "landscape" : "portrait");
    }

    doc.setFillColor(247, 242, 233);
    doc.rect(0, 0, pageSize.width, pageSize.height, "F");
    doc.addImage(dataUrl, "JPEG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
  }

  doc.save(`safescan-${Date.now()}.pdf`);
  setStatus(`${controls.useScanLook ? "Scanned" : "Original"} PDF generated locally and downloaded.`);
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
  renderPreviews();
});

elements.scanLookToggle.addEventListener("change", () => {
  updateScanControlState();
  renderPreviews();
});

[elements.brightness, elements.contrast, elements.grain, elements.vignette].forEach((input) => {
  input.addEventListener("input", () => renderPreviews());
});

elements.downloadBtn.addEventListener("click", exportPdf);
elements.clearBtn.addEventListener("click", clearAll);

syncPresetToControls();
updateScanControlState();