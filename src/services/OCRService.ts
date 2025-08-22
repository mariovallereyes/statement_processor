import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import { TextQualityMetrics, assessTextQuality, calculateTextConfidence } from '../utils/textPreprocessingUtils';

export interface OCROptions {
  language?: string;
  psm?: number; // Page segmentation mode
  oem?: number; // OCR Engine mode
  whitelist?: string;
  blacklist?: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  qualityMetrics: TextQualityMetrics;
  processingTime: number;
  wordsCount: number;
  linesCount: number;
}

export interface OCRProgress {
  status: string;
  progress: number;
}

/**
 * OCR Service using Tesseract.js for extracting text from images and scanned PDFs
 */
export class OCRService {
  private worker: Worker | null = null;
  private isInitialized = false;

  /**
   * Initialize the OCR worker
   */
  async initialize(options: OCROptions = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.worker = await createWorker();

      const {
        language = 'eng',
        psm = 6, // Uniform block of text
        oem = 3, // Default OCR Engine Mode
        whitelist,
        blacklist
      } = options;

      await (this.worker as any).loadLanguage(language);
      await (this.worker as any).initialize(language);

      // Configure Tesseract parameters for financial documents
      await (this.worker as any).setParameters({
        tessedit_pageseg_mode: psm,
        tessedit_ocr_engine_mode: oem,
        tessedit_char_whitelist: whitelist,
        tessedit_char_blacklist: blacklist,
        // Optimize for financial documents
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        // Improve number recognition
        classify_enable_learning: '0',
        classify_enable_adaptive_matcher: '0'
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
      throw new Error('OCR service initialization failed');
    }
  }

  /**
   * Extract text from an image or canvas element
   */
  async extractText(
    imageSource: string | ImageData | HTMLCanvasElement | HTMLImageElement,
    options: OCROptions = {}
  ): Promise<OCRResult> {
    if (!this.isInitialized || !this.worker) {
      await this.initialize(options);
    }

    const startTime = Date.now();

    try {
      const { data } = await (this.worker! as any).recognize(imageSource);
      const processingTime = Date.now() - startTime;

      const qualityMetrics = assessTextQuality(data.text);
      const textConfidence = calculateTextConfidence(qualityMetrics);
      
      // Combine Tesseract confidence with our text quality assessment
      const combinedConfidence = (data.confidence / 100) * 0.7 + textConfidence * 0.3;

      return {
        text: data.text,
        confidence: combinedConfidence,
        qualityMetrics,
        processingTime,
        wordsCount: data.words?.length || 0,
        linesCount: data.lines?.length || 0
      };
    } catch (error) {
      console.error('OCR text extraction failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Extract text from multiple images (for multi-page documents)
   */
  async extractTextFromPages(
    imagesSources: (string | ImageData | HTMLCanvasElement | HTMLImageElement)[],
    options: OCROptions = {}
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (let i = 0; i < imagesSources.length; i++) {
      try {
        const result = await this.extractText(imagesSources[i], options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process page ${i + 1}:`, error);
        // Continue with other pages even if one fails
        results.push({
          text: '',
          confidence: 0,
          qualityMetrics: assessTextQuality(''),
          processingTime: 0,
          wordsCount: 0,
          linesCount: 0
        });
      }
    }

    return results;
  }

  /**
   * Get optimized OCR options for Bank of America statements
   */
  static getBankStatementOCROptions(): OCROptions {
    return {
      language: 'eng',
      psm: 6, // Uniform block of text
      oem: 3, // Default OCR Engine Mode
      // Whitelist common characters in bank statements
      whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,()-/$*#',
      // Remove characters that are commonly misrecognized
      blacklist: '|[]{}~`'
    };
  }

  /**
   * Preprocess image for better OCR results
   */
  static preprocessImageForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      
      // Increase contrast (simple threshold)
      const enhanced = gray > 128 ? 255 : 0;
      
      data[i] = enhanced;     // Red
      data[i + 1] = enhanced; // Green
      data[i + 2] = enhanced; // Blue
      // Alpha channel remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Cleanup resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await (this.worker as any).terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

// Singleton instance for reuse
let ocrServiceInstance: OCRService | null = null;

/**
 * Get shared OCR service instance
 */
export function getOCRService(): OCRService {
  if (!ocrServiceInstance) {
    ocrServiceInstance = new OCRService();
  }
  return ocrServiceInstance;
}