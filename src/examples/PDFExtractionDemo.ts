/**
 * Demonstration of PDF Text Extraction Engine
 * 
 * This file shows how to use the PDF extraction services to:
 * 1. Extract text from PDF files using PDF.js
 * 2. Use OCR fallback for scanned documents
 * 3. Assess text quality and confidence
 * 4. Clean and normalize extracted text
 */

import { getPDFExtractionService, PDFExtractionService } from '../services/PDFExtractionService';
import { getOCRService } from '../services/OCRService';
import { 
  cleanExtractedText, 
  normalizeTextForParsing, 
  assessTextQuality, 
  calculateTextConfidence 
} from '../utils/textPreprocessingUtils';

/**
 * Example: Extract text from a Bank of America PDF statement
 */
export async function extractFromBankStatement(pdfFile: File): Promise<void> {
  console.log('🔍 Starting PDF text extraction...');
  
  try {
    // Step 1: Validate the PDF file
    const isValidPDF = await PDFExtractionService.validatePDF(pdfFile);
    if (!isValidPDF) {
      throw new Error('Invalid PDF file');
    }
    console.log('✅ PDF validation passed');

    // Step 2: Get PDF metadata
    const metadata = await PDFExtractionService.getPDFMetadata(pdfFile);
    console.log('📄 PDF Metadata:', {
      pages: metadata.numPages,
      title: metadata.title,
      author: metadata.author,
      creationDate: metadata.creationDate
    });

    // Step 3: Extract text with OCR fallback
    const pdfService = getPDFExtractionService();
    const extractionResult = await pdfService.extractFromPDF(pdfFile, {
      useOCRFallback: true,
      ocrThreshold: 0.7, // Use OCR if text confidence is below 70%
      cleanText: true,
      normalizeText: true,
      maxPages: 10
    });

    console.log('📊 Extraction Results:', {
      totalPages: extractionResult.totalPages,
      overallConfidence: Math.round(extractionResult.overallConfidence * 100) + '%',
      documentType: extractionResult.extractionMetadata.documentType,
      processingTime: extractionResult.extractionMetadata.totalProcessingTime + 'ms',
      pagesWithOCR: extractionResult.extractionMetadata.pagesWithOCR,
      pagesWithText: extractionResult.extractionMetadata.pagesWithText
    });

    // Step 4: Process each page
    extractionResult.pages.forEach((page, index) => {
      console.log(`\n📄 Page ${page.pageNumber}:`);
      console.log(`  Method: ${page.extractionMethod}`);
      console.log(`  Confidence: ${Math.round(page.confidence * 100)}%`);
      console.log(`  Processing time: ${page.processingTime}ms`);
      console.log(`  Text length: ${page.text.length} characters`);
      
      // Show quality metrics
      console.log(`  Quality metrics:`, {
        alphanumericRatio: Math.round(page.qualityMetrics.alphanumericRatio * 100) + '%',
        suspiciousPatterns: page.qualityMetrics.suspiciousPatterns.length,
        averageWordLength: Math.round(page.qualityMetrics.averageWordLength * 10) / 10
      });

      // Show first 200 characters of extracted text
      if (page.text.length > 0) {
        console.log(`  Preview: "${page.text.substring(0, 200)}..."`);
      }
    });

    // Step 5: Show combined text sample
    console.log('\n📝 Combined Text Sample:');
    console.log(extractionResult.combinedText.substring(0, 500) + '...');

    // Cleanup
    await pdfService.cleanup();
    console.log('✅ PDF extraction completed successfully');

  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    throw error;
  }
}

/**
 * Example: Demonstrate text quality assessment
 */
export function demonstrateTextQuality(): void {
  console.log('\n🔍 Text Quality Assessment Demo:');

  // Example 1: High quality text
  const goodText = 'Bank of America Statement Period: 01/01/2024 - 01/31/2024';
  const goodMetrics = assessTextQuality(goodText);
  const goodConfidence = calculateTextConfidence(goodMetrics);
  
  console.log('\n✅ High Quality Text:');
  console.log(`Text: "${goodText}"`);
  console.log(`Confidence: ${Math.round(goodConfidence * 100)}%`);
  console.log(`Alphanumeric ratio: ${Math.round(goodMetrics.alphanumericRatio * 100)}%`);
  console.log(`Suspicious patterns: ${goodMetrics.suspiciousPatterns.join(', ') || 'None'}`);

  // Example 2: Poor quality text (OCR errors)
  const poorText = '###B@nk 0f Am3r1c@ St@t3m3nt###';
  const poorMetrics = assessTextQuality(poorText);
  const poorConfidence = calculateTextConfidence(poorMetrics);
  
  console.log('\n❌ Poor Quality Text:');
  console.log(`Text: "${poorText}"`);
  console.log(`Confidence: ${Math.round(poorConfidence * 100)}%`);
  console.log(`Alphanumeric ratio: ${Math.round(poorMetrics.alphanumericRatio * 100)}%`);
  console.log(`Suspicious patterns: ${poorMetrics.suspiciousPatterns.join(', ')}`);
}

/**
 * Example: Demonstrate text cleaning and normalization
 */
export function demonstrateTextCleaning(): void {
  console.log('\n🧹 Text Cleaning Demo:');

  const rawText = `Bank of America
Member FDIC
Statement Period: 01/01/2024 - 01/31/2024


Previous Balance: $1,234.56
01/02  GROCERY STORE           $45.67
01/03  ATM WITHDRAWAL          $100.00


Page 1 of 2`;

  console.log('📄 Raw extracted text:');
  console.log(`"${rawText}"`);

  // Step 1: Clean the text
  const cleanedText = cleanExtractedText(rawText);
  console.log('\n🧹 After cleaning:');
  console.log(`"${cleanedText}"`);

  // Step 2: Normalize for parsing
  const normalizedText = normalizeTextForParsing(cleanedText);
  console.log('\n🔧 After normalization:');
  console.log(`"${normalizedText}"`);

  // Step 3: Assess final quality
  const finalMetrics = assessTextQuality(normalizedText);
  const finalConfidence = calculateTextConfidence(finalMetrics);
  
  console.log('\n📊 Final quality assessment:');
  console.log(`Confidence: ${Math.round(finalConfidence * 100)}%`);
  console.log(`Character count: ${finalMetrics.totalCharacters}`);
  console.log(`Alphanumeric ratio: ${Math.round(finalMetrics.alphanumericRatio * 100)}%`);
}

/**
 * Example: OCR service demonstration
 */
export async function demonstrateOCR(): Promise<void> {
  console.log('\n🔍 OCR Service Demo:');

  try {
    const ocrService = getOCRService();
    
    // Initialize with bank statement optimized settings
    console.log('⚙️ Initializing OCR with bank statement settings...');
    await ocrService.initialize({
      language: 'eng',
      psm: 6, // Uniform block of text
      whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,()-/$'
    });
    console.log('✅ OCR service initialized');

    // Create a sample canvas (in real usage, this would be from a PDF page)
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw sample bank statement text
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 200);
      ctx.fillStyle = 'black';
      ctx.font = '16px Arial';
      ctx.fillText('Bank of America', 20, 40);
      ctx.fillText('Statement Period: 01/01/2024', 20, 70);
      ctx.fillText('01/02 GROCERY STORE $45.67', 20, 100);
      
      console.log('🖼️ Created sample canvas with bank statement text');
      
      // Extract text using OCR
      console.log('🔍 Running OCR extraction...');
      const ocrResult = await ocrService.extractText(canvas);
      
      console.log('📊 OCR Results:');
      console.log(`Text: "${ocrResult.text}"`);
      console.log(`Confidence: ${Math.round(ocrResult.confidence * 100)}%`);
      console.log(`Processing time: ${ocrResult.processingTime}ms`);
      console.log(`Words detected: ${ocrResult.wordsCount}`);
      console.log(`Lines detected: ${ocrResult.linesCount}`);
    }

    // Cleanup
    await ocrService.terminate();
    console.log('✅ OCR demo completed');

  } catch (error) {
    console.error('❌ OCR demo failed:', error);
  }
}

/**
 * Run all demonstrations
 */
export async function runAllDemos(): Promise<void> {
  console.log('🚀 PDF Text Extraction Engine Demo\n');
  
  // Text processing demos (no file required)
  demonstrateTextQuality();
  demonstrateTextCleaning();
  
  // OCR demo (requires canvas support)
  if (typeof document !== 'undefined') {
    await demonstrateOCR();
  } else {
    console.log('\n⚠️ OCR demo skipped (no DOM environment)');
  }
  
  console.log('\n✅ All demos completed!');
  console.log('\n📝 To test PDF extraction, call extractFromBankStatement(pdfFile) with a real PDF file.');
}