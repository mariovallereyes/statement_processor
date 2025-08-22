# Comprehensive Testing Suite

This document describes the comprehensive testing suite for the Bank Statement Processor application.

## Overview

The testing suite includes multiple types of tests to ensure the application works correctly across all scenarios:

- **Unit Tests**: Test individual components and services
- **Integration Tests**: Test cross-component communication and data flow
- **End-to-End Tests**: Test complete user workflows from upload to export
- **Performance Tests**: Test processing speed and memory usage with large datasets
- **Accessibility Tests**: Test screen reader compatibility and keyboard navigation

## Test Structure

```
src/
├── **/*.test.ts           # Unit tests (co-located with source files)
├── integration/           # Integration tests
├── e2e/                   # End-to-end tests
├── performance/           # Performance tests
├── accessibility/         # Accessibility tests
└── test-utils/            # Test utilities and data generators
```

## Running Tests

### Individual Test Suites

```bash
# Unit tests with coverage
npm run test:coverage

# Integration tests
npm run test:integration

# End-to-end tests (requires dev server)
npm run test:e2e

# Performance tests
npm run test:performance

# Accessibility tests
npm run test:accessibility
```

### All Tests

```bash
# Run all test suites sequentially
npm run test:all

# Run comprehensive test suite with detailed reporting
npm run test:comprehensive

# CI/CD pipeline tests
npm run test:ci
```

## Test Data Generation

The `BankStatementTestDataGenerator` class provides synthetic Bank of America statement data for testing:

### Basic Usage

```typescript
import { BankStatementTestDataGenerator } from '../test-utils/testDataGenerators';

// Generate transactions
const transactions = BankStatementTestDataGenerator.generateTransactions({
  transactionCount: 20,
  includeProblematicData: false,
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31')
  }
});

// Generate account info
const accountInfo = BankStatementTestDataGenerator.generateAccountInfo('checking');

// Generate CSV content
const csvContent = BankStatementTestDataGenerator.generateCSVContent(transactions);

// Generate PDF-like text content
const pdfContent = BankStatementTestDataGenerator.generatePDFTextContent(transactions, accountInfo);
```

### Large Datasets for Performance Testing

```typescript
// Generate datasets of different sizes
const smallDataset = BankStatementTestDataGenerator.generateLargeDataset('small');   // 100 transactions
const mediumDataset = BankStatementTestDataGenerator.generateLargeDataset('medium'); // 1,000 transactions
const largeDataset = BankStatementTestDataGenerator.generateLargeDataset('large');   // 5,000 transactions
const xlargeDataset = BankStatementTestDataGenerator.generateLargeDataset('xlarge'); // 10,000 transactions
```

## Test Categories

### Unit Tests

Located alongside source files with `.test.ts` extension.

**Coverage Requirements:**
- Statements: 80%+
- Branches: 70%+
- Functions: 80%+
- Lines: 80%+

**Key Areas:**
- Service layer logic
- Data models and validation
- Utility functions
- Component rendering and behavior

### Integration Tests

Located in `src/integration/` directory.

**Focus Areas:**
- Cross-component communication
- Service integration
- Data flow between layers
- Error handling across components
- Session management
- Real-time updates

### End-to-End Tests

Located in `src/e2e/` directory.

**Test Scenarios:**
- Complete PDF processing workflow
- Complete CSV processing workflow
- Multi-file processing
- Machine learning and rule creation
- Error handling and recovery
- Session restoration
- Advanced rule management
- Export functionality
- Offline functionality

### Performance Tests

Located in `src/performance/` directory.

**Performance Benchmarks:**
- Small dataset (100 transactions): < 2 seconds
- Medium dataset (1,000 transactions): < 10 seconds
- Large dataset (5,000 transactions): < 30 seconds
- Single transaction classification: < 100ms
- Batch of 10 transactions: < 500ms
- Confidence calculation: < 50ms
- Memory usage: < 100MB increase

### Accessibility Tests

Located in `src/accessibility/` directory.

**Accessibility Requirements:**
- WCAG 2.1 AA compliance
- Screen reader compatibility
- Keyboard navigation support
- Focus management
- Color contrast requirements
- Alternative text for images
- Proper ARIA labels and roles

## Test Configuration

### Jest Configurations

- `jest.config.js` - Default unit test configuration
- `jest.e2e.config.js` - End-to-end test configuration
- `jest.performance.config.js` - Performance test configuration
- `jest.accessibility.config.js` - Accessibility test configuration

### Test Environment Setup

The test environment includes:
- Mocked TensorFlow.js for AI model testing
- Fake IndexedDB for database testing
- Puppeteer for E2E browser automation
- Jest-axe for accessibility testing
- Performance monitoring utilities

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Comprehensive Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run test:ci
```

### Test Reports

Test reports are generated in the `test-reports/` directory:
- Coverage reports (HTML and JSON)
- Performance metrics
- Accessibility violation reports
- E2E test screenshots and videos

## Best Practices

### Writing Tests

1. **Descriptive Test Names**: Use clear, descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **Test Data**: Use the test data generators for consistent, realistic test data
4. **Mocking**: Mock external dependencies and focus on testing the unit in isolation
5. **Edge Cases**: Include tests for error conditions and edge cases

### Test Data

1. **Realistic Data**: Use data that closely matches real Bank of America statement formats
2. **Variety**: Include diverse transaction types, merchants, and amounts
3. **Edge Cases**: Include problematic data for testing error handling
4. **Performance**: Use large datasets to test performance characteristics

### Performance Testing

1. **Baseline Metrics**: Establish baseline performance metrics for comparison
2. **Memory Monitoring**: Monitor memory usage during large file processing
3. **Timeout Handling**: Set appropriate timeouts for different test scenarios
4. **Batch Processing**: Test both individual and batch processing scenarios

### Accessibility Testing

1. **Automated Testing**: Use jest-axe for automated accessibility violation detection
2. **Manual Testing**: Include manual testing scenarios for keyboard navigation
3. **Screen Reader Testing**: Test with actual screen reader software when possible
4. **Focus Management**: Verify proper focus management in interactive components

## Troubleshooting

### Common Issues

1. **E2E Test Failures**: Ensure development server is running and accessible
2. **Performance Test Timeouts**: Adjust timeout values for slower environments
3. **Memory Issues**: Increase Node.js memory limit for large dataset tests
4. **Accessibility Violations**: Check component markup and ARIA attributes

### Debug Mode

Run tests in debug mode for troubleshooting:

```bash
# Debug unit tests
npm run test -- --verbose

# Debug E2E tests with browser visible
HEADLESS=false npm run test:e2e

# Debug performance tests with detailed logging
DEBUG=true npm run test:performance
```

## Metrics and Reporting

### Coverage Metrics

The test suite tracks code coverage across:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

### Performance Metrics

Performance tests measure:
- Processing time for different dataset sizes
- Memory usage during processing
- Model inference speed
- File parsing performance

### Accessibility Metrics

Accessibility tests track:
- WCAG violation count
- Keyboard navigation completeness
- Screen reader compatibility
- Focus management correctness

## Contributing

When adding new features:

1. Write unit tests for new components/services
2. Add integration tests for cross-component interactions
3. Update E2E tests for new user workflows
4. Include performance tests for data-intensive features
5. Add accessibility tests for new UI components
6. Update test data generators as needed

### Test Review Checklist

- [ ] All test types are included (unit, integration, E2E, performance, accessibility)
- [ ] Test coverage meets minimum requirements (80% lines, 70% branches)
- [ ] Performance benchmarks are met
- [ ] No accessibility violations
- [ ] Test data is realistic and comprehensive
- [ ] Error scenarios are covered
- [ ] Documentation is updated