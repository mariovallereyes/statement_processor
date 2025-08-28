import React, { useRef, useEffect, useState } from 'react';
import { UploadResult } from '../../models';

interface IFrameUploadProps {
  onFileSelect: (uploadResult: UploadResult) => void;
  onError: (error: string) => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
}

/**
 * Extension-proof file upload using iframe isolation
 * Browser security prevents extensions from accessing iframe content
 */
export const IFrameUpload: React.FC<IFrameUploadProps> = ({
  onFileSelect,
  onError,
  acceptedFormats = ['.pdf', '.csv'],
  maxFileSize = 50 * 1024 * 1024
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      switch (event.data.type) {
        case 'IFRAME_UPLOAD_READY':
          setIsReady(true);
          // Send configuration to iframe
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'IFRAME_UPLOAD_CONFIG',
              config: {
                acceptedFormats,
                maxFileSize
              }
            }, '*');
          }
          break;

        case 'IFRAME_UPLOAD_SUCCESS':
          try {
            const uploadResult = event.data.uploadResult;
            onFileSelect(uploadResult);
          } catch (error) {
            console.error('Error processing upload result:', error);
            onError('Failed to process uploaded file');
          }
          break;

        case 'IFRAME_UPLOAD_ERROR':
          onError(event.data.error || 'Upload failed');
          break;

        default:
          console.log('Unknown iframe message:', event.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback timeout - if iframe doesn't load in 5 seconds, show fallback
    const fallbackTimeout = setTimeout(() => {
      if (!isReady) {
        console.warn('IFrame upload failed to load, switching to fallback');
        setFallbackMode(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(fallbackTimeout);
    };
  }, [onFileSelect, onError, acceptedFormats, maxFileSize]);

  // Fallback upload component
  const FallbackUpload = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        // Validation
        if (file.size > maxFileSize) {
          onError(`File too large. Maximum size: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`);
          return;
        }

        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!acceptedFormats.includes(fileExtension)) {
          onError(`Unsupported file type. Accepted formats: ${acceptedFormats.join(', ')}`);
          return;
        }

        // Create upload result
        const fileContent = await file.arrayBuffer();
        const uploadResult: UploadResult = {
          fileId: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          fileType: fileExtension === '.pdf' ? 'pdf' : 'csv',
          metadata: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified)
          },
          rawContent: fileContent
        };

        onFileSelect(uploadResult);
        
        // Clear input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        onError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    return (
      <div style={{
        maxWidth: '400px',
        margin: '20px auto',
        padding: '20px',
        border: '2px solid #dc3545',
        borderRadius: '8px',
        background: '#fff3cd',
        textAlign: 'center' as const
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ color: '#856404', margin: '0 0 8px 0' }}>⚠️ Fallback Upload Mode</h3>
          <p style={{ color: '#856404', margin: '0', fontSize: '14px' }}>
            Protected upload method unavailable. Using basic file selection.
          </p>
        </div>
        
        <div 
          style={{
            border: '2px dashed #ffc107',
            borderRadius: '6px',
            padding: '20px',
            cursor: 'pointer',
            background: '#fff'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
          <strong style={{ color: '#dc3545' }}>Click to select file</strong>
          <br />
          <small style={{ color: '#856404', fontSize: '12px' }}>
            {acceptedFormats.join(', ')} files (max {(maxFileSize / 1024 / 1024).toFixed(1)}MB)
          </small>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    );
  };

  if (fallbackMode) {
    return <FallbackUpload />;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Loading overlay while iframe loads */}
      {!isReady && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
            <div style={{ color: '#666' }}>Loading secure upload...</div>
          </div>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        src="/upload-iframe.html"
        style={{
          width: '100%',
          height: '400px',
          border: 'none',
          borderRadius: '8px',
          background: 'white'
        }}
        title="Secure File Upload"
        sandbox="allow-scripts allow-same-origin"
        loading="eager"
      />
    </div>
  );
};