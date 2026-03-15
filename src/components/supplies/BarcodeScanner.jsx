import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Loader2, CheckCircle, AlertCircle, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Dynamically load the barcode detection library
let BarcodeDetector = window.BarcodeDetector || null;

export default function BarcodeScanner({ onProductFound, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | found | error
  const [errorMsg, setErrorMsg] = useState("");
  const [scannedProduct, setScannedProduct] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const lastScannedRef = useRef(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!BarcodeDetector) {
        setStatus("error");
        setErrorMsg("Barcode scanning is not supported on this browser. Try Chrome on Android or desktop.");
        return;
      }

      setStatus("scanning");
      startDetection();
    } catch (err) {
      setStatus("error");
      setErrorMsg("Camera access denied. Please allow camera permissions and try again.");
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const startDetection = () => {
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const barcode = barcodes[0].rawValue;
          if (barcode !== lastScannedRef.current) {
            lastScannedRef.current = barcode;
            await handleBarcode(barcode);
            return;
          }
        }
      } catch (_) {}
      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  };

  const handleBarcode = async (barcode) => {
    if (lookingUp) return;
    setLookingUp(true);
    setStatus("found");
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    try {
      const res = await base44.functions.invoke('lookupBarcode', { barcode });
      const data = res.data;

      const productName = data.product_name || data.ai_guess || null;
      const suggestedUnit = data.suggested_unit || "loads";

      setScannedProduct({
        barcode,
        name: productName,
        unit: suggestedUnit,
        found: data.found
      });
    } catch (_) {
      setScannedProduct({ barcode, name: null, unit: "loads", found: false });
    } finally {
      setLookingUp(false);
    }
  };

  const handleConfirm = (overrideName) => {
    const name = overrideName || scannedProduct?.name;
    if (!name) return;
    onProductFound({ name, unit: scannedProduct?.unit || "loads" });
    stopCamera();
    onClose();
  };

  const handleRescan = () => {
    lastScannedRef.current = null;
    setScannedProduct(null);
    setStatus("scanning");
    setLookingUp(false);
    startDetection();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-black/80 text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          <span className="font-medium">Scan Barcode</span>
        </div>
        <button onClick={() => { stopCamera(); onClose(); }} className="p-1">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera feed */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Scanning overlay */}
        {status === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-40 border-2 border-white/70 rounded-xl relative">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
              {/* Scan line */}
              <motion.div
                className="absolute left-2 right-2 h-0.5 bg-green-400/80"
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <p className="absolute bottom-20 text-white/80 text-sm">Point camera at product barcode</p>
          </div>
        )}

        {/* Looking up indicator */}
        {lookingUp && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-white text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Looking up product...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center px-8">
            <div className="text-center text-white">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-sm leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Result panel */}
      <AnimatePresence>
        {scannedProduct && !lookingUp && (
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            className="bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl"
          >
            {scannedProduct.found ? (
              <>
                <div className="flex items-center gap-2 text-green-600 mb-3">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium text-sm">Product found!</span>
                </div>
                <p className="font-semibold text-lg mb-1">{scannedProduct.name}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Suggested unit: <span className="font-medium">{scannedProduct.unit}</span>
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => handleConfirm()} className="flex-1 rounded-xl">
                    Add to Inventory
                  </Button>
                  <Button variant="outline" onClick={handleRescan} className="rounded-xl">
                    Rescan
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-yellow-600 mb-3">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium text-sm">
                    {scannedProduct.name ? "Product identified by AI" : "Product not recognized"}
                  </span>
                </div>
                {scannedProduct.name ? (
                  <>
                    <p className="font-semibold text-lg mb-1">{scannedProduct.name}</p>
                    <p className="text-xs text-muted-foreground mb-4">You can edit the name after adding.</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleConfirm()} className="flex-1 rounded-xl">
                        Add to Inventory
                      </Button>
                      <Button variant="outline" onClick={handleRescan} className="rounded-xl">
                        Rescan
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Barcode <span className="font-mono text-xs">{scannedProduct.barcode}</span> not found in database.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleConfirm("Unknown Supply")} variant="outline" className="flex-1 rounded-xl">
                        Add Manually
                      </Button>
                      <Button variant="outline" onClick={handleRescan} className="rounded-xl">
                        Rescan
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}