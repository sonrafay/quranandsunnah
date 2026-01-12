"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type QiblaARProps = {
  bearing: number; // Qibla direction from true North
  onClose: () => void;
};

export default function QiblaAR({ bearing, onClose }: QiblaARProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Request camera access
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        // Request camera with environment-facing (back camera)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Use back camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setPermissionGranted(true);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setCameraError("Unable to access camera. Please allow camera permissions.");
      }
    }

    startCamera();

    return () => {
      // Cleanup: stop camera when component unmounts
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Get device orientation for compass
  useEffect(() => {
    function handleOrientation(event: DeviceOrientationEvent) {
      // iOS WebKit compass heading
      const webkitHeading = (event as any).webkitCompassHeading as number | undefined;

      if (typeof webkitHeading === "number") {
        setDeviceHeading(webkitHeading);
        return;
      }

      // Android/standard compass
      if (typeof event.alpha === "number") {
        setDeviceHeading(360 - event.alpha);
      }
    }

    // Request permission on iOS 13+
    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      (DeviceOrientationEvent as any)
        .requestPermission()
        .then((response: string) => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation, true);
          }
        })
        .catch((err: Error) => {
          console.error("Orientation permission error:", err);
        });
    } else {
      // Non-iOS devices
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation as any);
    };
  }, []);

  // Draw AR overlay
  useEffect(() => {
    if (!canvasRef.current || deviceHeading === null) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate difference between current heading and Qibla bearing
    const diff = bearing - deviceHeading;
    const normalizedDiff = ((diff % 360) + 360) % 360;

    // Draw Qibla indicator
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Offset position based on direction difference
    // If user is facing Qibla, indicator is in center
    // If not, indicator moves left/right
    const offsetX = Math.sin((normalizedDiff * Math.PI) / 180) * (canvas.width * 0.4);
    const indicatorX = centerX + offsetX;
    const indicatorY = centerY - 100; // Above center

    // Draw glow effect
    const gradient = ctx.createRadialGradient(indicatorX, indicatorY, 0, indicatorX, indicatorY, 60);
    gradient.addColorStop(0, "rgba(34, 197, 94, 0.8)"); // Green glow
    gradient.addColorStop(0.5, "rgba(34, 197, 94, 0.4)");
    gradient.addColorStop(1, "rgba(34, 197, 94, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(indicatorX - 60, indicatorY - 60, 120, 120);

    // Draw Kaaba emoji/icon
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🕋", indicatorX, indicatorY);

    // Draw direction arrow if not aligned
    if (Math.abs(normalizedDiff) > 10 && Math.abs(normalizedDiff) < 350) {
      const arrowY = centerY + 80;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 3;

      if (normalizedDiff > 180) {
        // Point left
        ctx.beginPath();
        ctx.moveTo(centerX - 40, arrowY);
        ctx.lineTo(centerX - 10, arrowY - 15);
        ctx.lineTo(centerX - 10, arrowY + 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillText("←", centerX - 60, arrowY);
      } else {
        // Point right
        ctx.beginPath();
        ctx.moveTo(centerX + 40, arrowY);
        ctx.lineTo(centerX + 10, arrowY - 15);
        ctx.lineTo(centerX + 10, arrowY + 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillText("→", centerX + 60, arrowY);
      }
    }

    // Draw alignment indicator
    if (Math.abs(normalizedDiff) < 10 || Math.abs(normalizedDiff) > 350) {
      ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
      ctx.font = "bold 24px Arial";
      ctx.fillText("✓ Aligned with Qibla", centerX, centerY + 140);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "18px Arial";
      ctx.fillText("Rotate to align with Kaaba", centerX, centerY + 140);
    }

    // Draw bearing info
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, 10, 200, 80);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Qibla: ${bearing.toFixed(1)}°`, 20, 35);
    ctx.fillText(`Heading: ${deviceHeading.toFixed(1)}°`, 20, 60);
    ctx.fillText(`Diff: ${normalizedDiff.toFixed(1)}°`, 20, 85);

    // Request next frame
    const animationId = requestAnimationFrame(() => {});

    return () => cancelAnimationFrame(animationId);
  }, [deviceHeading, bearing]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Camera video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* AR overlay canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Close button */}
      <Button
        onClick={onClose}
        size="icon"
        variant="secondary"
        className="absolute top-4 right-4 z-10 rounded-full"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Error message */}
      {cameraError && (
        <div className="absolute inset-x-4 top-20 bg-red-500/90 text-white p-4 rounded-lg">
          <p className="text-sm">{cameraError}</p>
          <p className="text-xs mt-2">
            Please enable camera permissions in your browser settings.
          </p>
        </div>
      )}

      {/* Instructions */}
      {permissionGranted && !cameraError && (
        <div className="absolute bottom-20 inset-x-4">
          <div className="bg-black/60 backdrop-blur-sm text-white p-4 rounded-lg">
            <p className="text-sm text-center">
              Point your camera around until you see the Kaaba 🕋 icon centered.
              <br />
              <span className="text-xs opacity-80">
                The green glow indicates the direction of Qibla.
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
