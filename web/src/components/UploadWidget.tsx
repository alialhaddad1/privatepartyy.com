import React, { useState, useRef } from 'react';

interface UploadWidgetProps {
  eventId: string;
  token: string;
  onUploadComplete?: (postId: string) => void;
  onError?: (error: string) => void;
}

interface SignedUrlResponse {
  signedUrl: string;
  fileKey: string;
  publicUrl: string;
}

const UploadWidget: React.FC<UploadWidgetProps> = ({
  eventId,
  token,
  onUploadComplete,
  onError
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [resizedBlob, setResizedBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Please select a valid image file');
      return;
    }

    setSelectedFile(file);
    setStatus('');
    resizeImage(file);
  };

  const resizeImage = (file: File) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxWidth = 1200;
      const maxHeight = 1200;
      let { width, height } = img;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and resize image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          setResizedBlob(blob);
          const resizedUrl = URL.createObjectURL(blob);
          setPreviewUrl(resizedUrl);
          setStatus(`Image resized to ${width}x${height}px`);
        }
      }, 'image/jpeg', 0.8);
    };

    img.src = URL.createObjectURL(file);
  };

  const getSignedUrl = async (filename: string, contentType: string): Promise<SignedUrlResponse> => {
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filename,
        contentType,
        eventId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get signed URL');
    }

    return response.json();
  };

  const uploadToSignedUrl = async (signedUrl: string, blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error('Upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));

      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', blob.type);
      xhr.send(blob);
    });
  };

  const createPost = async (fileKey: string, publicUrl: string): Promise<string> => {
    const response = await fetch(`/api/events/${eventId}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'image',
        imageUrl: publicUrl,
        fileKey,
        originalFilename: selectedFile?.name
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create post');
    }

    const result = await response.json();
    return result.postId;
  };

  const handleUpload = async () => {
    if (!resizedBlob || !selectedFile) {
      setStatus('No file selected');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setStatus('Starting upload...');

    try {
      // Step 1: Get signed URL
      setStatus('Getting upload URL...');
      const { signedUrl, fileKey, publicUrl } = await getSignedUrl(
        selectedFile.name,
        resizedBlob.type
      );

      // Step 2: Upload to signed URL
      setStatus('Uploading image...');
      await uploadToSignedUrl(signedUrl, resizedBlob);

      // Step 3: Create post metadata
      setStatus('Creating post...');
      const postId = await createPost(fileKey, publicUrl);

      setStatus('Upload complete!');
      setUploadProgress(100);

      if (onUploadComplete) {
        onUploadComplete(postId);
      }

      // Reset form
      setTimeout(() => {
        resetForm();
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setStatus(`Error: ${errorMessage}`);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setResizedBlob(null);
    setUploadProgress(0);
    setStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="upload-widget">
      <div className="upload-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          disabled={uploading}
          style={{ marginBottom: '15px' }}
        />

        {previewUrl && (
          <div className="preview-container">
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: '300px',
                maxHeight: '300px',
                objectFit: 'contain',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />

        {status && (
          <div className={`status ${status.startsWith('Error:') ? 'error' : ''}`}>
            {status}
          </div>
        )}

        {uploading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}

        <div className="button-container">
          <button
            onClick={handleUpload}
            disabled={!resizedBlob || uploading}
            className={`upload-button ${!resizedBlob || uploading ? 'disabled' : ''}`}
            aria-label="Upload"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>

          {(selectedFile || previewUrl) && !uploading && (
            <button
              onClick={resetForm}
              className="reset-button"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <style>{`
        .upload-widget {
          max-width: 400px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background-color: #f9f9f9;
        }

        .upload-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .preview-container {
          display: flex;
          justify-content: center;
        }

        .status {
          text-align: center;
          padding: 8px 12px;
          border-radius: 4px;
          background-color: #e7f3ff;
          color: #0066cc;
          font-size: 14px;
        }

        .status.error {
          background-color: #ffe7e7;
          color: #cc0000;
        }

        .progress-container {
          width: 100%;
          max-width: 300px;
        }

        .progress-bar {
          width: 100%;
          height: 20px;
          background-color: #f0f0f0;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 5px;
        }

        .progress-fill {
          height: 100%;
          background-color: #007bff;
          border-radius: 10px;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          color: #666;
          text-align: center;
          display: block;
        }

        .button-container {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .upload-button {
          padding: 12px 24px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .upload-button:hover:not(.disabled) {
          background-color: #0056b3;
        }

        .upload-button.disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }

        .reset-button {
          padding: 12px 24px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .reset-button:hover {
          background-color: #545b62;
        }

        input[type="file"] {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background-color: white;
        }

        input[type="file"]:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default UploadWidget;