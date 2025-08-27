import React, { useRef } from 'react';
import { UploadResult } from '../../models';
import './FallbackFileUpload.css';

interface FallbackFileUploadProps {
  onFileSelect: (uploadResult: UploadResult) => void;
  onError: (error: string) => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
}

/**
 * Bulletproof file upload component using minimal DOM manipulation
 * Designed to work even when browser extensions interfere with React
 */
export const FallbackFileUpload: React.FC<FallbackFileUploadProps> = ({
  onFileSelect,
  onError,
  acceptedFormats = ['.pdf', '.csv'],
  maxFileSize = 50 * 1024 * 1024 // 50MB
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    try {
      // Basic validation
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

      // Clear the input for next upload
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      onError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fallback-file-upload">
      <div className="upload-header">
        <h3>📁 Upload Bank Statement</h3>
        <p>Simple file upload (extension-safe mode)</p>
      </div>
      
      <div className="upload-area" onClick={triggerFileSelect}>
        <div className="upload-icon">📄</div>
        <div className="upload-text">
          <strong>Click to select file</strong>
          <br />
          <small>Supports: {acceptedFormats.join(', ')} files</small>
          <br />
          <small>Max size: {(maxFileSize / 1024 / 1024).toFixed(1)}MB</small>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="upload-methods">
        <h4>Alternative Methods:</h4>
        <ul>
          <li><strong>Drag & Drop:</strong> Currently unavailable in fallback mode</li>
          <li><strong>Copy & Paste:</strong> Use Ctrl+V after copying file</li>
          <li><strong>File Browser:</strong> Click the area above to browse</li>
        </ul>
      </div>

      <div className="format-info">
        <details>
          <summary>📋 Supported File Formats</summary>
          <ul>
            <li><strong>.PDF:</strong> Bank of America PDF statements</li>
            <li><strong>.CSV:</strong> Bank of America CSV exports</li>
          </ul>
        </details>
      </div>

    </div>
  );
};