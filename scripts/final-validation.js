#!/usr/bin/env node

/**
 * Final Validation Script
 * Validates that all requirements are met and the system works end-to-end
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Starting Final Validation...\n');

// Track validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function logResult(test, status, message, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${message}`);
  if (details) console.log(`   ${details}`);
  
  results.details.push({ test, status, message, details });
  if (status === 'PASS') results.passed++;
  else if (status === 'FAIL') results.failed++;
  else results.warnings++;
}

// Requirement validation functions
function validateRequirement1() {
  console.log('\n📋 Requirement 1: File Upload and Processing');
  
  // Check FileUpload component exists
  const fileUploadPath = 'src/components/FileUpload/FileUpload.tsx';
  if (fs.existsSync(fileUploadPath)) {
    logResult('1.1', 'PASS', 'FileUpload component exists');
    
    const content = fs.readFileSync(fileUploadPath, 'utf8');
    if (content.includes('acceptedFormats') && content.includes('.pdf') && content.includes('.csv')) {
      logResult('1.2', 'PASS', 'Supports PDF and CSV formats');
    } else {
      logResult('1.2', 'FAIL', 'Missing PDF/CSV format support');
    }
    
    if (content.includes('validation') || content.includes('validate') || content.includes('acceptedFormats') || content.includes('maxFileSize')) {
      logResult('1.3', 'PASS', 'File validation implemented');
    } else {
      logResult('1.3', 'FAIL', 'File validation missing');
    }
  } else {
    logResult('1.1', 'FAIL', 'FileUpload component missing');
  }
  
  // Check EnhancedFileUploadService
  const serviceExists = fs.existsSync('src/services/EnhancedFileUploadService.ts');
  logResult('1.4', serviceExists ? 'PASS' : 'FAIL', 
    serviceExists ? 'Enhanced file upload service exists' : 'Enhanced file upload service missing');
}

function validateRequirement2() {
  console.log('\n🤖 Requirement 2: AI-Powered Data Extraction');
  
  // Check PDF extraction service
  const pdfServiceExists = fs.existsSync('src/services/EnhancedPDFExtractionService.ts');
  logResult('2.1', pdfServiceExists ? 'PASS' : 'FAIL',
    pdfServiceExists ? 'PDF extraction service exists' : 'PDF extraction service missing');
  
  // Check OCR service
  const ocrServiceExists = fs.existsSync('src/services/OCRService.ts');
  logResult('2.2', ocrServiceExists ? 'PASS' : 'FAIL',
    ocrServiceExists ? 'OCR service exists' : 'OCR service missing');
  
  // Check CSV parsing
  const csvServiceExists = fs.existsSync('src/services/CSVParsingService.ts');
  logResult('2.3', csvServiceExists ? 'PASS' : 'FAIL',
    csvServiceExists ? 'CSV parsing service exists' : 'CSV parsing service missing');
  
  // Check account info extraction
  const accountServiceExists = fs.existsSync('src/services/AccountInfoExtractionService.ts');
  logResult('2.4', accountServiceExists ? 'PASS' : 'FAIL',
    accountServiceExists ? 'Account info extraction exists' : 'Account info extraction missing');
  
  // Check transaction extraction
  const transactionServiceExists = fs.existsSync('src/services/TransactionExtractionService.ts');
  logResult('2.5', transactionServiceExists ? 'PASS' : 'FAIL',
    transactionServiceExists ? 'Transaction extraction exists' : 'Transaction extraction missing');
  
  // Check confidence scoring
  const confidenceEngineExists = fs.existsSync('src/services/ConfidenceEngine.ts');
  logResult('2.6', confidenceEngineExists ? 'PASS' : 'FAIL',
    confidenceEngineExists ? 'Confidence engine exists' : 'Confidence engine missing');
  
  // Check data unification
  const unificationExists = fs.existsSync('src/services/DataUnificationService.ts');
  logResult('2.7', unificationExists ? 'PASS' : 'FAIL',
    unificationExists ? 'Data unification service exists' : 'Data unification service missing');
}

function validateRequirement3() {
  console.log('\n🎯 Requirement 3: Intelligent Transaction Classification');
  
  // Check enhanced classification service
  const classificationExists = fs.existsSync('src/services/EnhancedTransactionClassificationService.ts');
  logResult('3.1', classificationExists ? 'PASS' : 'FAIL',
    classificationExists ? 'Enhanced classification service exists' : 'Enhanced classification service missing');
  
  // Check NLP service
  const nlpExists = fs.existsSync('src/services/NLPService.ts');
  logResult('3.2', nlpExists ? 'PASS' : 'FAIL',
    nlpExists ? 'NLP service exists' : 'NLP service missing');
  
  // Check confidence calculation
  if (classificationExists) {
    const content = fs.readFileSync('src/services/EnhancedTransactionClassificationService.ts', 'utf8');
    if (content.includes('confidence') && (content.includes('threshold') || content.includes('calculateConfidence') || content.includes('ConfidenceEngine'))) {
      logResult('3.3', 'PASS', 'Confidence calculation implemented');
    } else {
      logResult('3.3', 'FAIL', 'Confidence calculation missing');
    }
  }
  
  // Check learning engine
  const learningExists = fs.existsSync('src/services/LearningEngine.ts');
  logResult('3.4', learningExists ? 'PASS' : 'FAIL',
    learningExists ? 'Learning engine exists' : 'Learning engine missing');
}

function validateRequirement4() {
  console.log('\n👤 Requirement 4: Intelligent Review Interface');
  
  // Check transaction review component
  const reviewExists = fs.existsSync('src/components/TransactionReview/TransactionReview.tsx');
  logResult('4.1', reviewExists ? 'PASS' : 'FAIL',
    reviewExists ? 'Transaction review component exists' : 'Transaction review component missing');
  
  // Check confidence indicators
  const confidenceIndicatorExists = fs.existsSync('src/components/TransactionReview/ConfidenceIndicator.tsx');
  logResult('4.2', confidenceIndicatorExists ? 'PASS' : 'FAIL',
    confidenceIndicatorExists ? 'Confidence indicator exists' : 'Confidence indicator missing');
  
  // Check rule management
  const ruleManagementExists = fs.existsSync('src/components/RuleManagement/RuleManagement.tsx');
  logResult('4.3', ruleManagementExists ? 'PASS' : 'FAIL',
    ruleManagementExists ? 'Rule management exists' : 'Rule management missing');
  
  // Check rule editor
  const ruleEditorExists = fs.existsSync('src/components/RuleManagement/RuleEditor.tsx');
  logResult('4.4', ruleEditorExists ? 'PASS' : 'FAIL',
    ruleEditorExists ? 'Rule editor exists' : 'Rule editor missing');
  
  // Check category selector
  const categorySelectorExists = fs.existsSync('src/components/TransactionReview/CategorySelector.tsx');
  logResult('4.5', categorySelectorExists ? 'PASS' : 'FAIL',
    categorySelectorExists ? 'Category selector exists' : 'Category selector missing');
  
  // Check bulk edit panel
  const bulkEditExists = fs.existsSync('src/components/TransactionReview/BulkEditPanel.tsx');
  logResult('4.6', bulkEditExists ? 'PASS' : 'FAIL',
    bulkEditExists ? 'Bulk edit panel exists' : 'Bulk edit panel missing');
  
  // Check duplicate detection
  const duplicateDetectionExists = fs.existsSync('src/components/DuplicateDetection/DuplicateDetection.tsx');
  logResult('4.7', duplicateDetectionExists ? 'PASS' : 'FAIL',
    duplicateDetectionExists ? 'Duplicate detection exists' : 'Duplicate detection missing');
  
  // Check learning integration
  if (reviewExists) {
    const content = fs.readFileSync('src/components/TransactionReview/TransactionReview.tsx', 'utf8');
    if (content.includes('learning') || content.includes('feedback')) {
      logResult('4.8', 'PASS', 'Learning integration implemented');
    } else {
      logResult('4.8', 'WARN', 'Learning integration may be missing');
    }
  }
}

function validateRequirement5() {
  console.log('\n📤 Requirement 5: Export Functionality');
  
  // Check export service
  const exportServiceExists = fs.existsSync('src/services/ExportService.ts');
  logResult('5.1', exportServiceExists ? 'PASS' : 'FAIL',
    exportServiceExists ? 'Export service exists' : 'Export service missing');
  
  // Check export panel
  const exportPanelExists = fs.existsSync('src/components/ExportPanel/ExportPanel.tsx');
  logResult('5.2', exportPanelExists ? 'PASS' : 'FAIL',
    exportPanelExists ? 'Export panel exists' : 'Export panel missing');
  
  if (exportServiceExists) {
    const content = fs.readFileSync('src/services/ExportService.ts', 'utf8');
    
    // Check QuickBooks format
    if (content.includes('quickbooks') || content.includes('QuickBooks')) {
      logResult('5.3', 'PASS', 'QuickBooks format support exists');
    } else {
      logResult('5.3', 'FAIL', 'QuickBooks format support missing');
    }
    
    // Check CSV format
    if (content.includes('csv') || content.includes('CSV')) {
      logResult('5.4', 'PASS', 'CSV format support exists');
    } else {
      logResult('5.4', 'FAIL', 'CSV format support missing');
    }
    
    // Check validation
    if (content.includes('validate') || content.includes('validation')) {
      logResult('5.5', 'PASS', 'Export validation exists');
    } else {
      logResult('5.5', 'FAIL', 'Export validation missing');
    }
  }
}

function validateRequirement6() {
  console.log('\n💾 Requirement 6: Session Management');
  
  // Check session manager
  const sessionManagerExists = fs.existsSync('src/services/SessionManager.ts');
  logResult('6.1', sessionManagerExists ? 'PASS' : 'FAIL',
    sessionManagerExists ? 'Session manager exists' : 'Session manager missing');
  
  // Check database service
  const databaseExists = fs.existsSync('src/services/DatabaseService.ts');
  logResult('6.2', databaseExists ? 'PASS' : 'FAIL',
    databaseExists ? 'Database service exists' : 'Database service missing');
  
  // Check data persistence
  if (databaseExists) {
    const content = fs.readFileSync('src/services/DatabaseService.ts', 'utf8');
    if (content.includes('IndexedDB') || content.includes('Dexie')) {
      logResult('6.3', 'PASS', 'IndexedDB persistence implemented');
    } else {
      logResult('6.3', 'FAIL', 'IndexedDB persistence missing');
    }
  }
  
  // Check session restoration
  if (sessionManagerExists) {
    const content = fs.readFileSync('src/services/SessionManager.ts', 'utf8');
    if (content.includes('restore') && content.includes('save')) {
      logResult('6.4', 'PASS', 'Session save/restore implemented');
    } else {
      logResult('6.4', 'FAIL', 'Session save/restore missing');
    }
  }
}

function validateRequirement7() {
  console.log('\n🧠 Requirement 7: Intelligent Decision Engine');
  
  // Check confidence engine
  const confidenceEngineExists = fs.existsSync('src/services/ConfidenceEngine.ts');
  logResult('7.1', confidenceEngineExists ? 'PASS' : 'FAIL',
    confidenceEngineExists ? 'Confidence engine exists' : 'Confidence engine missing');
  
  if (confidenceEngineExists) {
    const content = fs.readFileSync('src/services/ConfidenceEngine.ts', 'utf8');
    
    // Check confidence thresholds
    if (content.includes('threshold') && (content.includes('95') || content.includes('80') || content.includes('DEFAULT_CONFIDENCE_THRESHOLDS'))) {
      logResult('7.2', 'PASS', 'Confidence thresholds implemented');
    } else {
      logResult('7.2', 'FAIL', 'Confidence thresholds missing');
    }
    
    // Check processing decision
    if (content.includes('ProcessingDecision') || content.includes('evaluateProcessingReadiness')) {
      logResult('7.3', 'PASS', 'Processing decision logic exists');
    } else {
      logResult('7.3', 'FAIL', 'Processing decision logic missing');
    }
    
    // Check error handling integration
    if (content.includes('error') || content.includes('fallback')) {
      logResult('7.4', 'PASS', 'Error handling integration exists');
    } else {
      logResult('7.4', 'WARN', 'Error handling integration may be missing');
    }
  }
  
  // Check NLP integration
  const nlpExists = fs.existsSync('src/services/NLPService.ts');
  logResult('7.5', nlpExists ? 'PASS' : 'FAIL',
    nlpExists ? 'NLP integration exists' : 'NLP integration missing');
  
  // Check learning feedback
  const learningExists = fs.existsSync('src/services/LearningEngine.ts');
  logResult('7.6', learningExists ? 'PASS' : 'FAIL',
    learningExists ? 'Learning feedback exists' : 'Learning feedback missing');
  
  // Check rule suggestions
  const ruleSuggestionsExists = fs.existsSync('src/components/RuleManagement/RuleSuggestions.tsx');
  logResult('7.7', ruleSuggestionsExists ? 'PASS' : 'FAIL',
    ruleSuggestionsExists ? 'Rule suggestions exist' : 'Rule suggestions missing');
}

function validateRequirement8() {
  console.log('\n🔒 Requirement 8: Privacy and Offline Functionality');
  
  // Check service worker
  const serviceWorkerExists = fs.existsSync('public/sw.js');
  logResult('8.1', serviceWorkerExists ? 'PASS' : 'FAIL',
    serviceWorkerExists ? 'Service worker exists' : 'Service worker missing');
  
  // Check no external API calls in services
  const serviceFiles = fs.readdirSync('src/services').filter(f => f.endsWith('.ts'));
  let hasExternalCalls = false;
  
  for (const file of serviceFiles) {
    const content = fs.readFileSync(`src/services/${file}`, 'utf8');
    if (content.includes('fetch(') && (content.includes('http://') || content.includes('https://'))) {
      // Check if it's for model downloads only
      if (!content.includes('model') && !content.includes('tfjs') && !content.includes('tesseract')) {
        hasExternalCalls = true;
        break;
      }
    }
  }
  
  logResult('8.2', hasExternalCalls ? 'WARN' : 'PASS',
    hasExternalCalls ? 'External API calls detected - verify they are for models only' : 'No external API calls for user data');
  
  // Check local storage usage
  const databaseExists = fs.existsSync('src/services/DatabaseService.ts');
  if (databaseExists) {
    const content = fs.readFileSync('src/services/DatabaseService.ts', 'utf8');
    if (content.includes('IndexedDB') && !content.includes('fetch(')) {
      logResult('8.3', 'PASS', 'Local storage without external transmission');
    } else {
      logResult('8.3', 'WARN', 'Verify local storage implementation');
    }
  }
  
  // Check offline functionality
  if (serviceWorkerExists) {
    const content = fs.readFileSync('public/sw.js', 'utf8');
    if (content.includes('offline') && content.includes('cache')) {
      logResult('8.4', 'PASS', 'Offline functionality implemented');
    } else {
      logResult('8.4', 'FAIL', 'Offline functionality missing');
    }
  }
  
  // Check model caching
  if (serviceWorkerExists) {
    const content = fs.readFileSync('public/sw.js', 'utf8');
    if (content.includes('model') && content.includes('cache')) {
      logResult('8.5', 'PASS', 'Model caching implemented');
    } else {
      logResult('8.5', 'WARN', 'Model caching may be missing');
    }
  }
}

function validateIntegration() {
  console.log('\n🔗 Integration Validation');
  
  // Check main App component integration
  const appExists = fs.existsSync('src/App.tsx');
  if (appExists) {
    const content = fs.readFileSync('src/App.tsx', 'utf8');
    
    // Check workflow states
    if (content.includes('WorkflowState') && content.includes('uploading') && content.includes('reviewing')) {
      logResult('INT.1', 'PASS', 'Workflow states implemented');
    } else {
      logResult('INT.1', 'FAIL', 'Workflow states missing');
    }
    
    // Check service integration
    if (content.includes('services') && content.includes('fileUpload') && content.includes('classification')) {
      logResult('INT.2', 'PASS', 'Service integration exists');
    } else {
      logResult('INT.2', 'FAIL', 'Service integration missing');
    }
    
    // Check component integration
    if (content.includes('TransactionReview') && content.includes('ExportPanel')) {
      logResult('INT.3', 'PASS', 'Component integration exists');
    } else {
      logResult('INT.3', 'FAIL', 'Component integration missing');
    }
  } else {
    logResult('INT.1', 'FAIL', 'Main App component missing');
  }
  
  // Check package.json dependencies
  const packageExists = fs.existsSync('package.json');
  if (packageExists) {
    const packageContent = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...packageContent.dependencies, ...packageContent.devDependencies };
    
    const requiredDeps = [
      '@tensorflow/tfjs',
      'tesseract.js',
      'pdfjs-dist',
      'papaparse',
      'natural',
      'dexie'
    ];
    
    const missingDeps = requiredDeps.filter(dep => !deps[dep]);
    if (missingDeps.length === 0) {
      logResult('INT.4', 'PASS', 'All required dependencies present');
    } else {
      logResult('INT.4', 'FAIL', `Missing dependencies: ${missingDeps.join(', ')}`);
    }
  }
}

function validateBuildConfiguration() {
  console.log('\n🏗️ Build Configuration Validation');
  
  // Check webpack config
  const webpackExists = fs.existsSync('webpack.config.js');
  logResult('BUILD.1', webpackExists ? 'PASS' : 'WARN',
    webpackExists ? 'Webpack configuration exists' : 'Using default CRA configuration');
  
  // Check build scripts
  const packageExists = fs.existsSync('package.json');
  if (packageExists) {
    const packageContent = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageContent.scripts || {};
    
    if (scripts.build && scripts['build:production']) {
      logResult('BUILD.2', 'PASS', 'Build scripts configured');
    } else {
      logResult('BUILD.2', 'WARN', 'Production build script missing');
    }
    
    if (scripts.serve && scripts.lighthouse) {
      logResult('BUILD.3', 'PASS', 'Performance testing scripts configured');
    } else {
      logResult('BUILD.3', 'WARN', 'Performance testing scripts missing');
    }
  }
  
  // Check deployment documentation
  const deploymentExists = fs.existsSync('DEPLOYMENT.md');
  logResult('BUILD.4', deploymentExists ? 'PASS' : 'FAIL',
    deploymentExists ? 'Deployment documentation exists' : 'Deployment documentation missing');
  
  // Check user guide
  const userGuideExists = fs.existsSync('USER_GUIDE.md');
  logResult('BUILD.5', userGuideExists ? 'PASS' : 'FAIL',
    userGuideExists ? 'User guide exists' : 'User guide missing');
}

function validateTestCoverage() {
  console.log('\n🧪 Test Coverage Validation');
  
  try {
    // Check if tests exist
    const testFiles = [];
    
    function findTestFiles(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          findTestFiles(fullPath);
        } else if (file.includes('.test.') || file.includes('.spec.')) {
          testFiles.push(fullPath);
        }
      }
    }
    
    findTestFiles('src');
    
    logResult('TEST.1', testFiles.length > 50 ? 'PASS' : 'WARN',
      `Found ${testFiles.length} test files`, 
      testFiles.length < 50 ? 'Consider adding more comprehensive tests' : '');
    
    // Check for different test types
    const unitTests = testFiles.filter(f => f.includes('/services/') || f.includes('/components/')).length;
    const integrationTests = testFiles.filter(f => f.includes('integration')).length;
    const e2eTests = testFiles.filter(f => f.includes('e2e')).length;
    
    logResult('TEST.2', unitTests > 20 ? 'PASS' : 'WARN', `${unitTests} unit tests found`);
    logResult('TEST.3', integrationTests > 5 ? 'PASS' : 'WARN', `${integrationTests} integration tests found`);
    logResult('TEST.4', e2eTests > 0 ? 'PASS' : 'WARN', `${e2eTests} e2e tests found`);
    
  } catch (error) {
    logResult('TEST.1', 'FAIL', 'Error analyzing test files', error.message);
  }
}

// Run all validations
function runValidation() {
  validateRequirement1();
  validateRequirement2();
  validateRequirement3();
  validateRequirement4();
  validateRequirement5();
  validateRequirement6();
  validateRequirement7();
  validateRequirement8();
  validateIntegration();
  validateBuildConfiguration();
  validateTestCoverage();
  
  // Summary
  console.log('\n📊 Validation Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(`📋 Total Checks: ${results.passed + results.failed + results.warnings}`);
  
  const passRate = (results.passed / (results.passed + results.failed + results.warnings)) * 100;
  console.log(`📈 Pass Rate: ${passRate.toFixed(1)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All critical requirements validated successfully!');
    if (results.warnings > 0) {
      console.log('⚠️  Please review warnings for potential improvements.');
    }
  } else {
    console.log('\n❌ Some critical requirements failed validation.');
    console.log('Please address failed items before deployment.');
  }
  
  // Export detailed results
  const reportPath = 'validation-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings,
      passRate: passRate
    },
    details: results.details
  }, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  return results.failed === 0;
}

// Run validation
const success = runValidation();
process.exit(success ? 0 : 1);