import React, { useEffect, useRef } from 'react';
import { UploadResult } from '../../models';

interface ExtensionProofUploadProps {
  onFileSelect: (uploadResult: UploadResult) => void;
  onError: (error: string) => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
}

/**
 * BULLETPROOF file upload that works even when browser extensions break React
 * Uses direct DOM manipulation to bypass React render cycles
 */
export const ExtensionProofUpload: React.FC<ExtensionProofUploadProps> = ({
  onFileSelect,
  onError,
  acceptedFormats = ['.pdf', '.csv'],
  maxFileSize = 50 * 1024 * 1024
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create bulletproof HTML structure directly in DOM
    const html = `
      <div style="
        max-width: 500px;
        margin: 20px auto;
        padding: 20px;
        border: 2px solid #007bff;
        border-radius: 8px;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="color: #333; margin: 0 0 8px 0;">📁 Upload Bank Statement</h3>
          <p style="color: #666; margin: 0; font-size: 14px;">Extension-proof file upload</p>
        </div>
        
        <div id="upload-area" style="
          border: 3px dashed #ccc;
          border-radius: 8px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: #f8f9fa;
        ">
          <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
          <div>
            <strong style="color: #007bff; font-size: 18px;">Click to select file</strong>
            <br />
            <small style="color: #666; font-size: 12px;">Supports: ${acceptedFormats.join(', ')} files</small>
            <br />
            <small style="color: #666; font-size: 12px;">Max size: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB</small>
          </div>
        </div>

        <input 
          type="file" 
          id="file-input" 
          accept="${acceptedFormats.join(',')}" 
          style="display: none;"
        />
        
        <div style="margin-top: 16px; padding: 12px; background: #e3f2fd; border-radius: 4px;">
          <p style="margin: 0; color: #1976d2; font-size: 13px;">
            ✅ This upload method works even when browser extensions cause problems
          </p>
        </div>
      </div>
    `;

    containerRef.current.innerHTML = html;

    // Add event listeners using vanilla JS (immune to React/extension conflicts)
    const uploadArea = containerRef.current.querySelector('#upload-area') as HTMLDivElement;
    const fileInput = containerRef.current.querySelector('#file-input') as HTMLInputElement;

    if (uploadArea && fileInput) {
      // Click handler
      const handleClick = () => {
        fileInput.click();
      };

      // File change handler
      const handleFileChange = async (event: Event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        
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

          // Show success feedback
          uploadArea.style.borderColor = '#28a745';
          uploadArea.style.background = '#d4edda';
          uploadArea.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <div>
              <strong style="color: #155724;">File uploaded successfully!</strong>
              <br />
              <small style="color: #155724;">${file.name}</small>
            </div>
          `;

          onFileSelect(uploadResult);

          // Reset after 2 seconds
          setTimeout(() => {
            uploadArea.style.borderColor = '#ccc';
            uploadArea.style.background = '#f8f9fa';
            uploadArea.innerHTML = `
              <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
              <div>
                <strong style="color: #007bff; font-size: 18px;">Click to select another file</strong>
              </div>
            `;
          }, 2000);

          // Clear input
          fileInput.value = '';

        } catch (error) {
          onError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Show error feedback
          uploadArea.style.borderColor = '#dc3545';
          uploadArea.style.background = '#f8d7da';
          uploadArea.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <div>
              <strong style="color: #721c24;">Upload failed</strong>
              <br />
              <small style="color: #721c24;">Please try again</small>
            </div>
          `;
        }
      };

      // Hover effects
      const handleMouseEnter = () => {
        uploadArea.style.borderColor = '#007bff';
        uploadArea.style.background = '#e3f2fd';
      };

      const handleMouseLeave = () => {
        uploadArea.style.borderColor = '#ccc';
        uploadArea.style.background = '#f8f9fa';
      };

      // Attach listeners
      uploadArea.addEventListener('click', handleClick);
      uploadArea.addEventListener('mouseenter', handleMouseEnter);
      uploadArea.addEventListener('mouseleave', handleMouseLeave);
      fileInput.addEventListener('change', handleFileChange);

      // Cleanup function
      return () => {
        uploadArea?.removeEventListener('click', handleClick);
        uploadArea?.removeEventListener('mouseenter', handleMouseEnter);
        uploadArea?.removeEventListener('mouseleave', handleMouseLeave);
        fileInput?.removeEventListener('change', handleFileChange);
      };
    }
  }, [onFileSelect, onError, acceptedFormats, maxFileSize]);

  return <div ref={containerRef}></div>;
};