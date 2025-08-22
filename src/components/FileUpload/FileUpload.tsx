import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { FileUploadServiceImpl } from '../../services/FileUploadService';
import { UploadResult } from '../../models';
import './FileUpload.css';

interface FileUploadProps {
  onFileSelect: (uploadResult: UploadResult) => void;
  onError: (error: string) => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
  disabled?: boolean;
}

interface UploadState {
  isDragOver: boolean;
  isUploading: boolean;
  uploadProgress: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  onError,
  acceptedFormats = ['.pdf', '.csv'],
  maxFileSize = 50 * 1024 * 1024, // 50MB
  disabled = false
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isDragOver: false,
    isUploading: false,
    uploadProgress: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadService = new FileUploadServiceImpl();

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setUploadState(prev => ({ ...prev, isDragOver: true }));
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadState(prev => ({ ...prev, isDragOver: false }));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setUploadState(prev => ({ ...prev, isDragOver: false }));
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setUploadState(prev => ({ 
      ...prev, 
      isUploading: true, 
      uploadProgress: 0 
    }));

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          uploadProgress: Math.min(prev.uploadProgress + 10, 90)
        }));
      }, 100);

      const uploadResult = await fileUploadService.uploadFile(file);
      
      clearInterval(progressInterval);
      setUploadState(prev => ({ 
        ...prev, 
        uploadProgress: 100 
      }));

      // Small delay to show 100% progress
      setTimeout(() => {
        setUploadState({
          isDragOver: false,
          isUploading: false,
          uploadProgress: 0
        });
        onFileSelect(uploadResult);
      }, 500);

    } catch (error) {
      setUploadState({
        isDragOver: false,
        isUploading: false,
        uploadProgress: 0
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      onError(errorMessage);
    }
  };

  const handleBrowseClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDropZoneClassName = (): string => {
    let className = 'file-upload-dropzone';
    if (uploadState.isDragOver) className += ' drag-over';
    if (disabled) className += ' disabled';
    if (uploadState.isUploading) className += ' uploading';
    return className;
  };

  return (
    <div className="file-upload-container">
      <div
        className={getDropZoneClassName()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        
        {uploadState.isUploading ? (
          <div className="upload-progress">
            <div className="upload-icon">📤</div>
            <div className="upload-text">
              <h3>Uploading...</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadState.uploadProgress}%` }}
                />
              </div>
              <p>{uploadState.uploadProgress}% complete</p>
            </div>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">
              {uploadState.isDragOver ? '📁' : '📄'}
            </div>
            <div className="upload-text">
              <h3>
                {uploadState.isDragOver 
                  ? 'Drop your Bank of America statement here' 
                  : 'Upload Bank of America Statement'
                }
              </h3>
              <p>
                Drag and drop your file here, or{' '}
                <span className="browse-link">browse</span> to select
              </p>
              <div className="upload-info">
                <p>Supported formats: {acceptedFormats.join(', ')}</p>
                <p>Maximum file size: {formatFileSize(maxFileSize)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="upload-requirements">
        <h4>Requirements for Bank of America Statements:</h4>
        <ul>
          <li>PDF statements must contain "Bank of America" text</li>
          <li>CSV files must have standard BoA headers (Date, Description, Amount, etc.)</li>
          <li>Files must be under {formatFileSize(maxFileSize)}</li>
          <li>Only PDF and CSV formats are supported</li>
        </ul>
      </div>
    </div>
  );
};