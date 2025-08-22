import React, { useState } from 'react';
import { ExportService } from '../../services/ExportService';
import { Transaction } from '../../models/Transaction';
import { ExportResult, ExportPreview, ExportFormat } from '../../models/ExportResult';
import './ExportPanel.css';

interface ExportPanelProps {
  transactions: Transaction[];
  onExportComplete?: (result: ExportResult) => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ 
  transactions, 
  onExportComplete 
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportService = new ExportService();

  const handleFormatChange = (format: ExportFormat) => {
    setSelectedFormat(format);
    setPreview(null);
    setExportResult(null);
    setError(null);
  };

  const generatePreview = async () => {
    try {
      setError(null);
      const previewData = exportService.generateExportPreview(transactions, selectedFormat);
      setPreview(previewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      let result: ExportResult;

      switch (selectedFormat) {
        case 'csv':
          result = await exportService.exportToQuickBooks(transactions);
          break;
        case 'qbo':
          result = await exportService.exportToQBO(transactions);
          break;
        case 'json':
          result = await exportService.exportToJSON(transactions);
          break;
        default:
          throw new Error('Unsupported export format');
      }

      setExportResult(result);
      
      // Trigger download
      const blob = new Blob([result.fileContent], { 
        type: selectedFormat === 'json' ? 'application/json' : 'text/plain' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (onExportComplete) {
        onExportComplete(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const validation = exportService.validateExportData(transactions);

  return (
    <div className="export-panel">
      <h3>Export Transactions</h3>
      
      {/* Format Selection */}
      <div className="format-selection">
        <label>Export Format:</label>
        <div className="format-options">
          <label>
            <input
              type="radio"
              value="csv"
              checked={selectedFormat === 'csv'}
              onChange={() => handleFormatChange('csv')}
            />
            QuickBooks CSV
          </label>
          <label>
            <input
              type="radio"
              value="qbo"
              checked={selectedFormat === 'qbo'}
              onChange={() => handleFormatChange('qbo')}
            />
            QBO Format
          </label>
          <label>
            <input
              type="radio"
              value="json"
              checked={selectedFormat === 'json'}
              onChange={() => handleFormatChange('json')}
            />
            JSON Export
          </label>
        </div>
      </div>

      {/* Validation Status */}
      <div className="validation-status">
        {validation.isValid ? (
          <div className="validation-success">
            ✓ {transactions.length} transactions ready for export
          </div>
        ) : (
          <div className="validation-errors">
            <h4>Validation Errors:</h4>
            <ul>
              {validation.errors.map((error, index) => (
                <li key={index}>
                  Transaction {error.transactionId}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {validation.warnings.length > 0 && (
          <div className="validation-warnings">
            <h4>Warnings:</h4>
            <ul>
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="export-actions">
        <button 
          onClick={generatePreview}
          disabled={!validation.isValid || transactions.length === 0}
          className="preview-button"
        >
          Generate Preview
        </button>
        
        <button 
          onClick={handleExport}
          disabled={!validation.isValid || transactions.length === 0 || isExporting}
          className="export-button"
        >
          {isExporting ? 'Exporting...' : `Export ${selectedFormat.toUpperCase()}`}
        </button>
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="export-preview">
          <h4>Export Preview ({preview.format.toUpperCase()})</h4>
          <div className="preview-info">
            <p>Total rows: {preview.totalRows}</p>
            <p>Columns: {preview.columns.join(', ')}</p>
          </div>
          <div className="preview-content">
            <pre>
              {preview.sampleRows.slice(0, 10).join('\n')}
              {preview.sampleRows.length > 10 && '\n... (truncated)'}
            </pre>
          </div>
        </div>
      )}

      {/* Export Result */}
      {exportResult && (
        <div className="export-success">
          <h4>Export Completed Successfully!</h4>
          <div className="export-metadata">
            <p>File: {exportResult.fileName}</p>
            <p>Format: {exportResult.format.toUpperCase()}</p>
            <p>Transactions: {exportResult.metadata.transactionCount}</p>
            <p>Date Range: {exportResult.metadata.dateRange.startDate.toLocaleDateString()} - {exportResult.metadata.dateRange.endDate.toLocaleDateString()}</p>
            <p>Total Amount: ${exportResult.metadata.totalAmount.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="export-error">
          <h4>Export Error</h4>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};