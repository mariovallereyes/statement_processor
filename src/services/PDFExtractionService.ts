import * as pdfjsLib from 'pdfjs-dist';
import { getOCRService, OCRService, OCRResult } from './OCRService';
import { 
  cleanExtractedText, 
  normalizeTextForParsing, 
  assessTextQuality, 
  calculateTextConfidence,
  TextQualityMetrics 
} from '../utils/textPreprocessingUtils';

// Configure PDF.js worker - use bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.js`;

export interface PDFExtractionOptions {
  useOCRFallback?: boolean;
  ocrThreshold?: number; // Confidence threshold below which OCR is used
  maxPages?: number;
  cleanText?: boolean;
  normalizeText?: boolean;
}

export interface PDFPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  extractionMethod: 'text' | 'ocr';
  qualityMetrics: TextQualityMetrics;
  processingTime: number;
}

export interface PDFExtractionResult {
  pages: PDFPageResult[];
  combinedText: string;
  totalPages: number;
  overallConfidence: number;
  extractionMetadata: {
    totalProcessingTime: number;
    pagesWithOCR: number;
    pagesWithText: number;
    averageConfidence: number;
    documentType: 'text-based' | 'image-based' | 'mixed';
  };
}

/**
 * PDF Text Extraction Service using PDF.js with OCR fallback
 */
export class PDFExtractionService {
  private ocrService: OCRService;

  constructor() {
    this.ocrService = getOCRService();
  }

  /**
   * Extract text from a PDF file
   */
  async extractFromPDF(
    pdfFile: File | ArrayBuffer,
    options: PDFExtractionOptions = {}
  ): Promise<PDFExtractionResult> {
    const {
      useOCRFallback = true,
      ocrThreshold = 0.5,
      maxPages = 50,
      cleanText = true,
      normalizeText = true
    } = options;

    const startTime = Date.now();
    
    try {
      // Load PDF document
      const pdfData = pdfFile instanceof File ? await pdfFile.arrayBuffer() : pdfFile;
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      
      const totalPages = Math.min(pdf.numPages, maxPages);
      const pages: PDFPageResult[] = [];

      // Process each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageResult = await this.extractFromPage(
          pdf, 
          pageNum, 
          { useOCRFallback, ocrThreshold, cleanText, normalizeText }
        );
        pages.push(pageResult);
      }

      // Combine all text
      const combinedText = pages.map(page => page.text).join('\n\n');
      
      // Calculate overall metrics
      const totalProcessingTime = Date.now() - startTime;
      const pagesWithOCR = pages.filter(p => p.extractionMethod === 'ocr').length;
      const pagesWithText = pages.filter(p => p.extractionMethod === 'text').length;
      const averageConfidence = pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;
      
      let documentType: 'text-based' | 'image-based' | 'mixed';
      if (pagesWithOCR === 0) {
        documentType = 'text-based';
      } else if (pagesWithText === 0) {
        documentType = 'image-based';
      } else {
        documentType = 'mixed';
      }

      return {
        pages,
        combinedText,
        totalPages,
        overallConfidence: averageConfidence,
        extractionMetadata: {
          totalProcessingTime,
          pagesWithOCR,
          pagesWithText,
          averageConfidence,
          documentType
        }
      };

    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from a single PDF page
   */
  private async extractFromPage(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    options: {
      useOCRFallback: boolean;
      ocrThreshold: number;
      cleanText: boolean;
      normalizeText: boolean;
    }
  ): Promise<PDFPageResult> {
    const startTime = Date.now();
    
    try {
      const page = await pdf.getPage(pageNumber);
      
      // First, try to extract text directly
      const textContent = await page.getTextContent();
      let extractedText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      // Assess text quality
      let qualityMetrics = assessTextQuality(extractedText);
      let confidence = calculateTextConfidence(qualityMetrics);
      let extractionMethod: 'text' | 'ocr' = 'text';

      // Use OCR fallback if text quality is poor or OCR is forced
      if (options.useOCRFallback && confidence < options.ocrThreshold) {
        try {
          const ocrResult = await this.extractWithOCR(page);
          
          // Use OCR result if it's better than direct text extraction
          if (ocrResult.confidence > confidence) {
            extractedText = ocrResult.text;
            confidence = ocrResult.confidence;
            qualityMetrics = ocrResult.qualityMetrics;
            extractionMethod = 'ocr';
          }
        } catch (ocrError) {
          console.warn(`OCR failed for page ${pageNumber}:`, ocrError);
          // Continue with direct text extraction
        }
      }

      // Clean and normalize text if requested
      if (options.cleanText) {
        extractedText = cleanExtractedText(extractedText);
      }
      
      if (options.normalizeText) {
        extractedText = normalizeTextForParsing(extractedText);
      }

      const processingTime = Date.now() - startTime;

      return {
        pageNumber,
        text: extractedText,
        confidence,
        extractionMethod,
        qualityMetrics,
        processingTime
      };

    } catch (error) {
      console.error(`Failed to extract from page ${pageNumber}:`, error);
      
      // Return empty result for failed page
      return {
        pageNumber,
        text: '',
        confidence: 0,
        extractionMethod: 'text',
        qualityMetrics: assessTextQuality(''),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Extract text using OCR from a PDF page
   */
  private async extractWithOCR(page: pdfjsLib.PDFPageProxy): Promise<OCRResult> {
    // Render page to canvas
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not create canvas context for OCR');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise;

    // Initialize OCR service with bank statement optimized settings
    await this.ocrService.initialize(OCRService.getBankStatementOCROptions());

    // Preprocess image for better OCR results
    const preprocessedCanvas = OCRService.preprocessImageForOCR(canvas);

    // Extract text using OCR
    return await this.ocrService.extractText(preprocessedCanvas);
  }

  /**
   * Validate if a file is a valid PDF
   */
  static async validatePDF(file: File): Promise<boolean> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      return pdf.numPages > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get PDF metadata
   */
  static async getPDFMetadata(file: File): Promise<{
    numPages: number;
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const metadata = await pdf.getMetadata();

      return {
        numPages: pdf.numPages,
        title: (metadata.info as any)?.Title,
        author: (metadata.info as any)?.Author,
        subject: (metadata.info as any)?.Subject,
        creator: (metadata.info as any)?.Creator,
        producer: (metadata.info as any)?.Producer,
        creationDate: (metadata.info as any)?.CreationDate ? new Date((metadata.info as any).CreationDate) : undefined,
        modificationDate: (metadata.info as any)?.ModDate ? new Date((metadata.info as any).ModDate) : undefined
      };
    } catch (error) {
      throw new Error('Failed to extract PDF metadata');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.ocrService.terminate();
  }
}

// Export singleton instance
let pdfExtractionServiceInstance: PDFExtractionService | null = null;

export function getPDFExtractionService(): PDFExtractionService {
  if (!pdfExtractionServiceInstance) {
    pdfExtractionServiceInstance = new PDFExtractionService();
  }
  return pdfExtractionServiceInstance;
}