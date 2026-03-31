/**
 * FrameSnap – script.js
 * Handles: Camera · File Upload · Crop (Cropper.js) · Frame Overlay · Canvas Export · Server Upload
 */

'use strict';

// ─────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────
let currentFacingMode = "environment";
let stream;
let cameraStream   = null;
let croppedDataURL = null;  // source image data URL
let framedDataURL  = null;  // result after frame applied

// ─────────────────────────────────────────────────
// DOM references
// ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const btnOpenCamera   = $('btn-open-camera');
const btnFlipCamera = document.getElementById("btnFlipCamera");

btnFlipCamera.addEventListener("click", flipCamera);
const btnCapture      = $('btn-capture');
const btnCloseCamera  = $('btn-close-camera');
const fileInput       = $('file-input');
const cameraContainer = $('camera-container');
const cameraPreview   = $('camera-preview');
const snapshotCanvas  = $('snapshot-canvas');

const sectionSource   = $('section-source');
const sectionFrame    = $('section-frame');
const sectionExport   = $('section-export');

const finalCanvas     = $('final-canvas');
const btnApplyFrame   = $('btn-apply-frame');
const btnBackCrop     = $('btn-back-crop');

const exportCanvas    = $('export-canvas');
const btnDownload     = $('btn-download');
const btnUploadServer = $('btn-upload-server');
const uploadStatus    = $('upload-status');
const btnStartOver    = $('btn-start-over');

// Step indicators
const stepIndicators  = [
  $('step-indicator-1'),
  $('step-indicator-3'),
  $('step-indicator-4'),
];

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function applyBackgroundFromTemplate() {
  const meta = document.querySelector('meta[name="framesnap-bg-url"]');
  const bgUrl = (meta && meta.getAttribute('content')) ? meta.getAttribute('content').trim() : '';
  if (!bgUrl) return;
  const layer = document.querySelector('.bg-layer');
  if (!layer) return;
  layer.style.backgroundImage = `url('${bgUrl.replace(/'/g, "\\'")}')`;
}

function showToast(msg, duration = 2800) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, duration);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyBackgroundFromTemplate, { once: true });
} else {
  applyBackgroundFromTemplate();
}

// ─────────────────────────────────────────────────
// Step management
// ─────────────────────────────────────────────────
function goToStep(n) {
  const sections = [sectionSource, sectionFrame, sectionExport];
  sections.forEach((s, i) => s.classList.toggle('hidden', i !== n - 1));

  stepIndicators.forEach((el, i) => {
    if (!el) return;
    el.classList.remove('active', 'done');
    const step = i + 1;
    if (step === n) el.classList.add('active');
    else if (step < n) el.classList.add('done');
  });
}

// ─────────────────────────────────────────────────
// Camera
// ─────────────────────────────────────────────────
btnOpenCamera.addEventListener('click', async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { 
  facingMode: currentFacingMode,
  width: { ideal: 1280 }, 
  height: { ideal: 720 } 
},
    });
    cameraPreview.srcObject = cameraStream;
    if (currentFacingMode === "user") {
  cameraPreview.style.transform = "scaleX(-1)";
} else {
  cameraPreview.style.transform = "scaleX(1)";
    }
    cameraContainer.classList.remove('hidden');
    btnOpenCamera.disabled = true;
    fileInput.disabled = true;
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'Camera permission denied. Please allow camera access.'
      : `Camera error: ${err.message}`;
    showToast('⚠ ' + msg);
    console.error('Camera error:', err);
  }
});

btnCloseCamera.addEventListener('click', stopCamera);

function stopCamera() {
  function flipCamera() {
  currentFacingMode = currentFacingMode === "user"
    ? "environment"
    : "user";

  if (cameraStream) {
    stopCamera();
    btnOpenCamera.click();
  }
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraPreview.srcObject = null;
  cameraContainer.classList.add('hidden');
  btnOpenCamera.disabled = false;
  fileInput.disabled = false;
}

btnCapture.addEventListener('click', () => {
  const video = cameraPreview;
  snapshotCanvas.width  = video.videoWidth;
  snapshotCanvas.height = video.videoHeight;
  const ctx = snapshotCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataURL = snapshotCanvas.toDataURL('image/png');
  stopCamera();
  loadImageForPreview(dataURL);
});

// ─────────────────────────────────────────────────
// File upload
// ─────────────────────────────────────────────────
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('⚠ Please select a valid image file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => loadImageForPreview(ev.target.result);
  reader.readAsDataURL(file);
});

// ─────────────────────────────────────────────────
// Load image for preview (auto-frame)
// ─────────────────────────────────────────────────
function loadImageForPreview(dataURL) {
  croppedDataURL = dataURL;
  framedDataURL = null;
  const frameURL = getFrameURL();

  renderFramedOnCanvas(finalCanvas, croppedDataURL, frameURL, () => {
    goToStep(2);
  });
}

// Back button (from Preview to Source)
btnBackCrop.addEventListener('click', () => {
  fileInput.value = '';
  croppedDataURL = null;
  framedDataURL = null;
  goToStep(1);
});

// ─────────────────────────────────────────────────
// Apply frame overlay
// ─────────────────────────────────────────────────
btnApplyFrame.addEventListener('click', () => {
  if (!croppedDataURL) { showToast('⚠ No image loaded.'); return; }
  btnApplyFrame.disabled = true;
  btnApplyFrame.textContent = 'Processing…';

  const frameURL = getFrameURL();

  renderFramedOnCanvas(exportCanvas, croppedDataURL, frameURL, () => {
    framedDataURL = exportCanvas.toDataURL('image/png');
    goToStep(3);
    btnApplyFrame.disabled = false;
    btnApplyFrame.textContent = 'Continue →';
    showToast('✓ Ready!');
  });
});

/** Returns the absolute URL to the frame overlay PNG */
function getFrameURL() {
  const meta = document.querySelector('meta[name="framesnap-frame-url"]');
  const fromTemplate = (meta && meta.getAttribute('content')) ? meta.getAttribute('content').trim() : '';
  if (fromTemplate) return fromTemplate;
  return '/static/frame.png';
}

/**
 * Draw the source image into a canvas sized to the frame image, then overlay the frame.
 * @param {HTMLCanvasElement} canvas
 * @param {string} src  - data URL of the source image
 * @param {string|null} frameSrc  - URL of the frame PNG (or null to skip)
 * @param {Function} onDone
 */
function renderFramedOnCanvas(canvas, src, frameSrc, onDone) {
  if (!frameSrc) {
    showToast('⚠ Frame image not found.');
    return;
  }

  const frame = new Image();
  frame.onload = () => {
    canvas.width = frame.naturalWidth;
    canvas.height = frame.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      drawCover(ctx, img, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      onDone();
    };
    img.onerror = () => showToast('⚠ Could not load image.');
    img.src = src;
  };
  frame.onerror = () => {
    console.warn('Frame image could not be loaded.');
    showToast('⚠ Frame image could not be loaded.');
  };
  frame.src = frameSrc;
}

function drawCover(ctx, img, dx, dy, dWidth, dHeight) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const scale = Math.max(dWidth / iw, dHeight / ih);
  const sw = dWidth / scale;
  const sh = dHeight / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
}

// ─────────────────────────────────────────────────
// Download
// ─────────────────────────────────────────────────
btnDownload.addEventListener('click', () => {
  const src = framedDataURL || croppedDataURL;
  if (!src) { showToast('⚠ Nothing to download.'); return; }

  const link = document.createElement('a');
  link.download = `its-summit-${Date.now()}.png`;
  link.href = src;
  link.click();
  showToast('⬇ Downloading…');
});

// ─────────────────────────────────────────────────
// Upload to server
// ─────────────────────────────────────────────────
btnUploadServer.addEventListener('click', async () => {
  const src = framedDataURL || croppedDataURL;
  if (!src) { showToast('⚠ Nothing to upload.'); return; }

  setUploadStatus('loading', '☁ Uploading to server…');
  btnUploadServer.disabled = true;

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: src }),
    });

    const data = await response.json();

    if (response.ok && data.status === 'uploaded') {
      setUploadStatus('success', '✓ Uploaded successfully!');
      showToast('✓ Image saved on server!');
    } else {
      const msg = data.message || 'Upload failed. Please try again.';
      setUploadStatus('error', '✕ ' + msg);
    }
  } catch (err) {
    console.error('Upload error:', err);
    setUploadStatus('error', '✕ Network error. Check your connection.');
  } finally {
    btnUploadServer.disabled = false;
  }
});

function setUploadStatus(type, message) {
  uploadStatus.textContent = message;
  uploadStatus.className   = `upload-status ${type}`;
  uploadStatus.classList.remove('hidden');
}

// ─────────────────────────────────────────────────
// Start over
// ─────────────────────────────────────────────────
btnStartOver.addEventListener('click', () => {
  // Reset all state
  stopCamera();
  croppedDataURL = null;
  framedDataURL  = null;
  fileInput.value = '';
  uploadStatus.className = 'upload-status hidden';

  // Clear canvases
  [finalCanvas, exportCanvas, snapshotCanvas].forEach(c => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
  });

  goToStep(1);
});

// ─────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────
goToStep(1);
