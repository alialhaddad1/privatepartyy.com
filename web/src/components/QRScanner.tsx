import React, { useRef, useEffect, useState } from 'react';

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
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError('');

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device');
        return;
      }

      // Request camera permission with specific constraints for mobile devices
      // Using 'environment' for rear camera (important for iPhones)
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // These attributes are crucial for iOS Safari
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        await videoRef.current.play(); // Explicitly start playback
        streamRef.current = stream;
        setIsScanning(true);
        scanQRCode();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device');
      } else {
        setError('Camera access error. Please try again or use manual input.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const scanQRCode = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA && isScanning) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = detectQRCode(imageData);
        
        if (qrCode) {
          handleQRCodeDetected(qrCode);
          return;
        }
      }
      
      if (isScanning) {
        requestAnimationFrame(scan);
      }
    };
    
    scan();
  };

  const detectQRCode = (imageData: ImageData): string | null => {
    // Simple QR code detection simulation
    // In a real implementation, you'd use a library like jsQR
    const data = imageData.data;
    let hasPattern = false;
    
    // Very basic pattern detection (this is a placeholder)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness < 50 || brightness > 200) {
        hasPattern = true;
      }
    }
    
    // Simulate QR code detection with a mock result
    if (hasPattern && Math.random() > 0.95) {
      return 'event/123?token=abc123def456';
    }
    
    return null;
  };

  const handleQRCodeDetected = (qrData: string) => {
    stopCamera();
    const url = qrData.startsWith('/') ? qrData : `/${qrData}`;
    
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
      const url = manualInput.startsWith('/') ? manualInput : `/${manualInput}`;
      
      if (onNavigate) {
        onNavigate(url);
      } else {
        window.location.href = url;
      }
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
              <div className="error" style={{ color: 'red', marginTop: '10px' }}>
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