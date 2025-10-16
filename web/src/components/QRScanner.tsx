import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onNavigate?: (url: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onNavigate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError('');
      setScanningStatus('Requesting camera access...');

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device');
        setScanningStatus('');
        return;
      }

      // Request camera permission with specific constraints for mobile devices
      // Using 'environment' for rear camera (important for mobile)
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        }
      };

      console.log('📷 Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // These attributes are crucial for iOS Safari
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('muted', 'true');

        console.log('📹 Starting video playback...');
        await videoRef.current.play(); // Explicitly start playback

        streamRef.current = stream;
        setIsScanning(true);
        scanLoopRef.current = true;
        setScanningStatus('📷 Scanning for QR code...');

        console.log('✅ Camera started successfully');
        scanQRCode();
      }
    } catch (err: any) {
      console.error('❌ Camera error:', err);
      setScanningStatus('');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application');
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}. Please try again or use manual input.`);
      }
    }
  };

  const stopCamera = () => {
    console.log('🛑 Stopping camera');
    scanLoopRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setScanningStatus('');
  };

  const scanQRCode = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      console.warn('⚠️ Canvas or video ref not available');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('⚠️ Could not get canvas context');
      return;
    }

    let animationFrameId: number;

    const scan = () => {
      // Check if we should continue scanning using ref
      if (!scanLoopRef.current) {
        console.log('🛑 Scanning stopped (loop ref false)');
        return;
      }

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (canvas.width === 0 || canvas.height === 0) {
          // Video not ready yet, try again
          console.log('⏳ Video dimensions not ready, waiting...');
          animationFrameId = requestAnimationFrame(scan);
          return;
        }

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data for QR detection
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Try to detect QR code
        const qrCode = detectQRCode(imageData);

        if (qrCode) {
          console.log('🎯 QR code found, stopping scan');
          scanLoopRef.current = false;
          handleQRCodeDetected(qrCode);
          return; // Stop scanning after successful detection
        }
      }

      // Continue scanning
      animationFrameId = requestAnimationFrame(scan);
    };

    // Start the scanning loop
    console.log('▶️ Starting QR scan loop');
    scan();
  };

  const detectQRCode = (imageData: ImageData): string | null => {
    // Use jsQR library to detect QR codes
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code) {
      console.log('✅ QR Code detected:', code.data);
      return code.data;
    }

    return null;
  };

  const handleQRCodeDetected = (qrData: string) => {
    stopCamera();

    console.log('📱 Processing QR code data:', qrData);

    // Parse the QR data to extract event ID and token
    // QR codes can contain various formats:
    // - Full URL: "https://privatepartyy.com/event/123?token=abc"
    // - Relative URL: "/event/123?token=abc"
    // - Path only: "event/123?token=abc"
    // - Join URL: "/join/123?token=abc"

    let cleanData = qrData;

    // Remove domain if present
    cleanData = cleanData.replace(/^https?:\/\/[^/]+/, '');

    // Remove leading slash if present
    cleanData = cleanData.startsWith('/') ? cleanData.substring(1) : cleanData;

    console.log('🔍 Cleaned QR data:', cleanData);

    // Extract eventId and token
    const eventMatch = cleanData.match(/(?:event|join)\/([^?]+)/);
    if (!eventMatch) {
      console.error('❌ Invalid QR code format:', qrData);
      setError('Invalid QR code format. Please try again or use manual input.');
      return;
    }

    const eventId = eventMatch[1];
    const tokenMatch = cleanData.match(/token=([^&]+)/);
    const token = tokenMatch ? tokenMatch[1] : '';

    console.log('✅ Extracted event info:', { eventId, token });

    // ALWAYS redirect to join page to let user choose login method
    // This is consistent with the fix in join/[id].tsx where we removed auto-entry
    const url = `/join/${eventId}${token ? `?token=${token}` : ''}`;

    console.log('🚀 Navigating to:', url);

    if (onNavigate) {
      onNavigate(url);
    } else {
      // Default navigation behavior
      window.location.href = url;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      // Use the same logic as QR code detection
      handleQRCodeDetected(manualInput.trim());
    }
  };

  return (
    <div className="qr-scanner">
      <div className="scanner-container">
        {!showManualInput ? (
          <>
            <div className="camera-view">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                webkit-playsinline="true"
                style={{ width: '100%', maxWidth: '400px', height: 'auto' }}
              />
              <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
              />
            </div>
            
            {scanningStatus && (
              <div className="scanning-status" style={{
                textAlign: 'center',
                marginTop: '10px',
                padding: '12px',
                backgroundColor: '#e3f2fd',
                borderRadius: '8px',
                color: '#1976d2',
                fontWeight: '500'
              }}>
                {scanningStatus}
              </div>
            )}

            <div className="controls">
              {!isScanning ? (
                <button onClick={startCamera}>Start Camera</button>
              ) : (
                <button onClick={stopCamera}>Stop Camera</button>
              )}

              <button onClick={() => setShowManualInput(true)}>
                Manual Input
              </button>
            </div>

            {error && (
              <div className="error" style={{
                color: '#d32f2f',
                marginTop: '10px',
                padding: '12px',
                backgroundColor: '#ffebee',
                borderRadius: '8px',
                fontWeight: '500'
              }}>
                {error}
              </div>
            )}
          </>
        ) : (
          <div className="manual-input">
            <form onSubmit={handleManualSubmit}>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter event ID or QR code data"
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  marginBottom: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <div className="manual-controls">
                <button type="submit">Submit</button>
                <button 
                  type="button" 
                  onClick={() => setShowManualInput(false)}
                >
                  Back to Scanner
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      
      <style>{`
        .qr-scanner {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          max-width: 500px;
          margin: 0 auto;
        }
        
        .scanner-container {
          width: 100%;
        }
        
        .camera-view {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
          border: 2px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .controls {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .manual-controls {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        
        .qr-scanner button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          background-color: #007bff;
          color: white;
          cursor: pointer;
          font-size: 14px;
        }
        
        .qr-scanner button:hover {
          background-color: #0056b3;
        }
        
        .manual-input {
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;