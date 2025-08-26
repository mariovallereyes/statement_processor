# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Start development server
npm start

# Build for production
npm run build

# Build with bundle analysis
npm run build:analyze

# Run all tests
npm test

# Run specific test suites
npm run test:watch          # Watch mode for unit tests
npm run test:integration    # Integration tests only
npm run test:e2e           # End-to-end tests with Puppeteer
npm run test:performance   # Performance benchmarks
npm run test:accessibility # Accessibility tests with axe-core
npm run test:comprehensive # All tests with detailed reporting

# Generate test coverage report
npm run test:coverage

# Run comprehensive validation
node scripts/run-comprehensive-tests.js
```

## Architecture Overview

This is an AI-powered bank statement processor built with React/TypeScript that processes financial documents entirely client-side for privacy. The application follows a layered architecture:

### Core Processing Pipeline
1. **File Upload** → Enhanced validation and preprocessing
2. **Document Extraction** → PDF.js + Tesseract OCR for text extraction
3. **Transaction Parsing** → Natural language processing with confidence scoring
4. **AI Classification** → TensorFlow.js models for transaction categorization
5. **User Review** → Interactive validation and rule management
6. **Export** → Multiple format support (CSV, JSON, etc.)

### Key Architectural Patterns

**Service-Oriented Architecture**: Business logic is organized into focused services in `src/services/`:
- `EnhancedFileUploadService` - File validation and preprocessing
- `EnhancedPDFExtractionService` - PDF text extraction with OCR fallback
- `TransactionExtractionService` - Parse transactions from raw text
- `EnhancedTransactionClassificationService` - AI-powered categorization
- `ConfidenceEngine` - Confidence scoring and decision making
- `LearningEngine` - User feedback integration and model improvement
- `DatabaseService` - Dexie/IndexedDB local storage management

**Confidence-Based Processing**: All operations include confidence scores that drive UI presentation and processing decisions. See `src/utils/confidenceUtils.ts` for scoring logic.

**Error Handling System**: Comprehensive error handling with recovery strategies in `src/services/ErrorHandlingService.ts` and `src/models/ErrorHandling.ts`.

## Data Models

Core interfaces in `src/models/`:
- `Transaction` - Central transaction model with metadata, confidence scores, and classification data
- `ExtractionResult` - Results from document processing pipeline
- `ClassificationResult` - AI categorization results with confidence
- `ProcessingDecision` - Confidence-based processing decisions
- `UserFeedback` - User corrections and learning data

## Local Storage Architecture

Uses Dexie (IndexedDB wrapper) for client-side persistence:
- **Sessions** - Processing sessions with transactions and rules
- **Files** - Uploaded documents with raw content
- **MLModels** - Local TensorFlow.js models and vocabularies
- **UserCorrections** - Learning data from user feedback

## Configuration

**Webpack Configuration**: `craco.config.js` includes Node.js polyfills for browser compatibility with libraries like `natural` and `crypto`.

**Browser Support**: Configured for modern browsers with fallbacks for PDF.js worker and TensorFlow.js.

## Testing Strategy

Multi-layered testing approach:
- **Unit Tests** - Co-located with source files (`.test.ts`)
- **Integration Tests** - Cross-service communication testing
- **E2E Tests** - Full workflows with Puppeteer
- **Performance Tests** - Large dataset processing benchmarks
- **Accessibility Tests** - Screen reader and keyboard navigation

Use `npm run test:comprehensive` for complete validation before deployment.

## Important Implementation Notes

**Privacy First**: All processing happens client-side. No financial data leaves the browser.

**Progressive Enhancement**: Application works offline after initial load. Service worker provides offline capabilities.

**Responsive Design**: UI adapts to mobile/tablet with breakpoint utilities in `src/components/UI/`.

**Accessibility**: Full keyboard navigation and screen reader support throughout the application.

**Bundle Management**: Uses code splitting and dynamic imports for optimal loading. Check bundle size with `npm run build:analyze`.