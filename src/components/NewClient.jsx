import { useState, useRef, useEffect } from "react";
import {
  Upload,
  RotateCw,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const COMPANY_OPTIONS = [
  "UTL/Fujiyama",
  "Waaree",
  "Luminous",
  "Adani",
  "Tata",
  "Eastman",
  "Microtech",
  "Livguard",
];

export default function NewClient() {
  const [formData, setFormData] = useState({
    sr_no: "",
    name: "",
    address: "",
    date: new Date().toISOString().split("T")[0],
    kw: "",
    panel_company: COMPANY_OPTIONS[0],
    panel_watt: "",
    panel_quantity: "",
    inverter_company: COMPANY_OPTIONS[0],
    inverter_watt: "",
    structure_watt: "",
    cost: "",
    signature_path: "",
  });

  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
  const [isDragging, setIsDragging] = useState(false);
  const [sigStatus, setSigStatus] = useState({
    text: "No signature uploaded",
    type: "idle",
  });

  // NEW: saving / progress state for the Save button
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState({
    step: 0,
    total: 4,
    message: "",
  });

  // Canvas Refs & Processing States
  const origCanvasRef = useRef(null);
  const resCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [sourceImgData, setSourceImgData] = useState(null);
  const [resultImgData, setResultImgData] = useState(null);

  // --- FETCH AUTO-INCREMENTED SR NO ---
  const fetchNextSrNo = () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require("electron");
        // Request the latest customer SR NO from IPC
        const response = ipcRenderer.sendSync("get-latest-sr-no");
        if (response && response.success) {
          const nextSrNo = (parseInt(response.latestSrNo, 10) || 0) + 1;
          setFormData((prev) => ({ ...prev, sr_no: nextSrNo }));
        } else {
          setFormData((prev) => ({ ...prev, sr_no: 1 }));
        }
      } catch (err) {
        console.error("Failed to fetch latest SR NO:", err);
        setFormData((prev) => ({ ...prev, sr_no: 1 }));
      }
    } else {
      // Fallback default for browser mode testing
      setFormData((prev) => ({ ...prev, sr_no: 1001 }));
    }
  };

  useEffect(() => {
    fetchNextSrNo();
  }, []);

  // NEW: listen for progress events pushed from the main process while
  // "add-customer" is running, so the UI can show real step-by-step progress.
  useEffect(() => {
    if (!window.require) return;
    const { ipcRenderer } = window.require("electron");

    const handleProgress = (_event, data) => {
      setProgress(data);
    };

    ipcRenderer.on("add-customer-progress", handleProgress);
    return () => {
      ipcRenderer.removeListener("add-customer-progress", handleProgress);
    };
  }, []);

  // --- IMAGE PROCESSING & BACKGROUND REMOVAL UTILITIES ---
  // (unchanged below — omitted here only for brevity in this snippet set,
  // keep all of your existing fitCanvas / renderToCanvas / detectBgColorMedian /
  // calculateOtsuThreshold / removeBackgroundAuto / rotate90Deg / autoCrop /
  // autoStraighten / processAutomatically / handleFile / handleRotateManual /
  // handleChange functions exactly as they were.)

  const fitCanvas = (canvas, w, h) => {
    canvas.width = w;
    canvas.height = h;
  };

  const renderToCanvas = (canvas, imgData) => {
    if (!canvas || !imgData) return;
    fitCanvas(canvas, imgData.width, imgData.height);
    const ctx = canvas.getContext("2d");
    ctx.putImageData(imgData, 0, 0);
  };

  const detectBgColorMedian = (imageData) => {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    const rVals = [],
      gVals = [],
      bVals = [];
    const rimW = Math.max(1, Math.floor(w * 0.04));
    const rimH = Math.max(1, Math.floor(h * 0.04));

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < rimW || x >= w - rimW || y < rimH || y >= h - rimH) {
          const idx = (y * w + x) * 4;
          rVals.push(data[idx]);
          gVals.push(data[idx + 1]);
          bVals.push(data[idx + 2]);
        }
      }
    }

    rVals.sort((a, b) => a - b);
    gVals.sort((a, b) => a - b);
    bVals.sort((a, b) => a - b);

    const mid = Math.floor(rVals.length / 2);
    return { r: rVals[mid], g: gVals[mid], b: bVals[mid] };
  };

  const calculateOtsuThreshold = (imageData, bg) => {
    const data = imageData.data;
    const total = data.length / 4;
    const maxDist = Math.sqrt(255 * 255 * 3);
    const hist = new Int32Array(256);

    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      const dr = data[idx] - bg.r;
      const dg = data[idx + 1] - bg.g;
      const db = data[idx + 2] - bg.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      const bin = Math.min(255, Math.floor((dist / maxDist) * 255));
      hist[bin]++;
    }

    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];

    let sumB = 0,
      wB = 0,
      wF = 0,
      maxVar = 0,
      optimalBin = 30;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;

      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > maxVar) {
        maxVar = varBetween;
        optimalBin = t;
      }
    }

    return Math.max(18, (optimalBin / 255) * maxDist);
  };

  const removeBackgroundAuto = (imageData, bg, threshold) => {
    const src = imageData.data;
    const out = new ImageData(imageData.width, imageData.height);
    const dst = out.data;

    const lowerCutoff = threshold * 0.65;
    const upperCutoff = threshold * 1.25;
    const range = Math.max(1, upperCutoff - lowerCutoff);

    for (let i = 0; i < src.length; i += 4) {
      const dr = src[i] - bg.r;
      const dg = src[i + 1] - bg.g;
      const db = src[i + 2] - bg.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= lowerCutoff) {
        dst[i] = dst[i + 1] = dst[i + 2] = dst[i + 3] = 0;
      } else if (dist >= upperCutoff) {
        dst[i] = src[i];
        dst[i + 1] = src[i + 1];
        dst[i + 2] = src[i + 2];
        dst[i + 3] = 255;
      } else {
        const alphaRatio = (dist - lowerCutoff) / range;
        dst[i] = src[i];
        dst[i + 1] = src[i + 1];
        dst[i + 2] = src[i + 2];
        dst[i + 3] = Math.round(alphaRatio * 255);
      }
    }
    return out;
  };

  const rotate90Deg = (imageData, angle) => {
    let rot = ((angle % 360) + 360) % 360;
    if (rot === 0) return imageData;

    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;

    const newW = rot === 90 || rot === 270 ? h : w;
    const newH = rot === 90 || rot === 270 ? w : h;

    const out = new ImageData(newW, newH);
    const dst = out.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;
        let dstX = x,
          dstY = y;

        if (rot === 90) {
          dstX = h - 1 - y;
          dstY = x;
        } else if (rot === 180) {
          dstX = w - 1 - x;
          dstY = h - 1 - y;
        } else if (rot === 270) {
          dstX = y;
          dstY = w - 1 - x;
        }

        const dstIdx = (dstY * newW + dstX) * 4;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    return out;
  };

  const autoCrop = (imageData) => {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 20) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) return imageData;

    const pad = 12;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropped = new ImageData(cropW, cropH);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const srcIdx = (y * w + x) * 4;
        const dstIdx = ((y - minY) * cropW + (x - minX)) * 4;
        cropped.data[dstIdx] = data[srcIdx];
        cropped.data[dstIdx + 1] = data[srcIdx + 1];
        cropped.data[dstIdx + 2] = data[srcIdx + 2];
        cropped.data[dstIdx + 3] = data[srcIdx + 3];
      }
    }
    return cropped;
  };

  const autoStraighten = (imageData) => {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      count = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 60) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (count < 20) return imageData;
    return maxX - minX + 1 < maxY - minY + 1
      ? rotate90Deg(imageData, 270)
      : imageData;
  };

  const processAutomatically = (imageData) => {
    if (!imageData) return;
    setSigStatus({ text: "Removing background...", type: "processing" });

    setTimeout(() => {
      try {
        const bg = detectBgColorMedian(imageData);
        const threshold = calculateOtsuThreshold(imageData, bg);
        let processed = removeBackgroundAuto(imageData, bg, threshold);
        processed = autoStraighten(processed);
        processed = autoCrop(processed);

        setResultImgData(processed);
        renderToCanvas(resCanvasRef.current, processed);

        // Convert processed canvas to Base64
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = processed.width;
        tempCanvas.height = processed.height;
        tempCanvas.getContext("2d").putImageData(processed, 0, 0);

        setFormData((prev) => ({
          ...prev,
          signature_path: tempCanvas.toDataURL("image/png"),
        }));
        setSigStatus({
          text: "Background removed successfully!",
          type: "done",
        });
      } catch (err) {
        setSigStatus({
          text: "Processing error: " + err.message,
          type: "error",
        });
      }
    }, 40);
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setSigStatus({
        text: "Please select a valid image file.",
        type: "error",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(img, 0, 0);

        const imgData = tempCtx.getImageData(0, 0, img.width, img.height);
        setSourceImgData(imgData);
        renderToCanvas(origCanvasRef.current, imgData);
        processAutomatically(imgData);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRotateManual = () => {
    if (!resultImgData) return;
    let rotated = rotate90Deg(resultImgData, 90);
    rotated = autoCrop(rotated);
    setResultImgData(rotated);
    renderToCanvas(resCanvasRef.current, rotated);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = rotated.width;
    tempCanvas.height = rotated.height;
    tempCanvas.getContext("2d").putImageData(rotated, 0, 0);
    setFormData((prev) => ({
      ...prev,
      signature_path: tempCanvas.toDataURL("image/png"),
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- SAVE FORM DATA ---
  // CHANGED: sendSync -> invoke (async, non-blocking), plus isSaving/progress state.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return; // guard against double-submit while a save is in flight

    const payload = {
      ...formData,
      sr_no: parseInt(formData.sr_no, 10),
      kw: parseFloat(formData.kw) || 0,
      panel_watt: parseInt(formData.panel_watt, 10) || 0,
      panel_quantity: parseInt(formData.panel_quantity, 10) || 0,
      inverter_watt: parseFloat(formData.inverter_watt) || 0,
      structure_watt: parseFloat(formData.structure_watt) || 0,
      cost: parseFloat(formData.cost) || 0,
    };

    if (window.require) {
      const { ipcRenderer } = window.require("electron");

      setIsSaving(true);
      setProgress({ step: 0, total: 4, message: "Starting..." });
      setStatusMessage({ type: "", text: "" });

      try {
        const response = await ipcRenderer.invoke("add-customer", payload);

        if (response.success) {
          setStatusMessage({
            type: "success",
            text: `Customer saved successfully! Signature exported to DATA/files/${payload.sr_no} ${payload.name}/`,
          });

          // Reset Form
          setFormData({
            sr_no: "",
            name: "",
            address: "",
            date: new Date().toISOString().split("T")[0],
            kw: "",
            panel_company: COMPANY_OPTIONS[0],
            panel_watt: "",
            panel_quantity: "",
            inverter_company: COMPANY_OPTIONS[0],
            inverter_watt: "",
            structure_watt: "",
            cost: "",
            signature_path: "",
          });

          // Fetch the newly incremented serial number for the next entry
          fetchNextSrNo();
          setSourceImgData(null);
          setResultImgData(null);
          setSigStatus({ text: "No signature uploaded", type: "idle" });
        } else {
          setStatusMessage({ type: "error", text: `Error: ${response.error}` });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: `Error: ${err.message}` });
      } finally {
        setIsSaving(false);
        setProgress({ step: 0, total: 4, message: "" });
      }
    } else {
      console.log("Browser Mode Payload:", payload);
      setStatusMessage({
        type: "success",
        text: "Browser mode: Data output to console.",
      });
    }
  };

  const progressPercent = isSaving
    ? Math.round((progress.step / progress.total) * 100)
    : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 bg-[#0B0F19] text-white">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">ADD NEW CUSTOMER</h1>
        <p className="text-sm text-slate-400 mt-1">
          Enter complete details to save to system database
        </p>
      </header>

      {statusMessage.text && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* NEW: progress bar shown only while saving */}
      {isSaving && (
        <div className="p-4 rounded-lg bg-[#131A2B] border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{progress.message || "Saving..."}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#0F1423] overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="bg-[#131A2B] border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-lg font-semibold text-amber-500 border-b border-slate-800 pb-2">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Serial No. (SR NO) *
              </label>
              <input
                type="number"
                name="sr_no"
                required
                readOnly
                value={formData.sr_no}
                onChange={handleChange}
                placeholder="Auto-generated"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 cursor-not-allowed opacity-80"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Full Name"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Customer Address"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                System Capacity (KW)
              </label>
              <input
                type="number"
                step="0.01"
                name="kw"
                value={formData.kw}
                onChange={handleChange}
                placeholder="e.g. 5.5"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* System Specifications */}
        <div className="bg-[#131A2B] border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-lg font-semibold text-amber-500 border-b border-slate-800 pb-2">
            System Specifications
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Panel Company
              </label>
              <select
                name="panel_company"
                value={formData.panel_company}
                onChange={handleChange}
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              >
                {COMPANY_OPTIONS.map((company) => (
                  <option
                    key={company}
                    value={company}
                    className="bg-[#0F1423] text-white"
                  >
                    {company}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Panel Wattage (W)
              </label>
              <input
                type="number"
                name="panel_watt"
                value={formData.panel_watt}
                onChange={handleChange}
                placeholder="e.g. 540"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Panel Quantity
              </label>
              <input
                type="number"
                name="panel_quantity"
                value={formData.panel_quantity}
                onChange={handleChange}
                placeholder="e.g. 10"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Inverter Company
              </label>
              <select
                name="inverter_company"
                value={formData.inverter_company}
                onChange={handleChange}
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              >
                {COMPANY_OPTIONS.map((company) => (
                  <option
                    key={company}
                    value={company}
                    className="bg-[#0F1423] text-white"
                  >
                    {company}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Inverter Capacity (KW/Watt)
              </label>
              <input
                type="number"
                step="0.01"
                name="inverter_watt"
                value={formData.inverter_watt}
                onChange={handleChange}
                placeholder="e.g. 5.0"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Structure Capacity (Watt)
              </label>
              <input
                type="number"
                step="0.01"
                name="structure_watt"
                value={formData.structure_watt}
                onChange={handleChange}
                placeholder="e.g. 5000"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Cost & Signature Processing */}
        <div className="bg-[#131A2B] border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-lg font-semibold text-amber-500 border-b border-slate-800 pb-2">
            Cost & Signature Processing
          </h2>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Total Cost (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full p-2.5 bg-[#0F1423] border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                Upload Signature Image
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length)
                    handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-800 bg-[#0F1423] hover:border-slate-700"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files.length) handleFile(e.target.files[0]);
                  }}
                />
                <Upload className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                <p className="text-sm font-medium text-white">
                  Drag and drop signature here, or{" "}
                  <span className="text-amber-500">browse file</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PNG, JPG, WebP supported
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-[#0F1423] border border-slate-800 rounded-xl p-4 flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-400 mb-2">
                  Original Signature
                </span>
                <div className="w-full h-40 flex items-center justify-center bg-[#0B0F19] rounded-lg overflow-hidden border border-slate-800/80">
                  <canvas
                    ref={origCanvasRef}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

              <div className="bg-[#0F1423] border border-slate-800 rounded-xl p-4 flex flex-col items-center relative">
                <div className="w-full flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-amber-500">
                    Cleaned Signature (Transparent)
                  </span>
                  {resultImgData && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleRotateManual}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => processAutomatically(sourceImgData)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Reprocess"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full h-40 flex items-center justify-center rounded-lg overflow-hidden border border-slate-800/80 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px]">
                  <canvas
                    ref={resCanvasRef}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
              {sigStatus.type === "done" && (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              {sigStatus.type === "error" && (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{sigStatus.text}</span>
            </div>
          </div>
        </div>

        {/* CHANGED: disabled while saving, shows progress text on the button itself */}
        <button
          type="submit"
          disabled={isSaving}
          className={`w-full font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-500/10 text-base ${
            isSaving
              ? "bg-amber-500/50 text-black/70 cursor-not-allowed"
              : "bg-amber-500 text-black hover:bg-amber-400"
          }`}
        >
          {isSaving
            ? `${progress.message || "Saving..."} (${progressPercent}%)`
            : "Save Customer & Export Signature"}
        </button>
      </form>
    </div>
  );
}
