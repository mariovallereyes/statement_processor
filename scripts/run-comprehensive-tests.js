#!/usr/bin/env node

/**
 * Comprehensive test runner for the Bank Statement Processor
 * Runs all test suites and generates detailed reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.results = {
      unit: { passed: false, duration: 0, coverage: null },
      integration: { passed: false, duration: 0 },
      e2e: { passed: false, duration: 0 },
      performance: { passed: false, duration: 0, metrics: {} },
      accessibility: { passed: false, duration: 0, violations: 0 }
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logSection(title) {
    this.log(`\n${'='.repeat(60)}`, 'cyan');
    this.log(`${title}`, 'cyan');
    this.log(`${'='.repeat(60)}`, 'cyan');
  }

  async runCommand(command, testType) {
    const startTime = Date.now();
    
    try {
      this.log(`Running: ${command}`, 'blue');
      const output = execSync(command, { 
        stdio: 'pipe', 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      this.results[testType].passed = true;
      this.results[testType].duration = duration;
      
      this.log(`✅ ${testType} tests passed (${duration}ms)`, 'green');
      
      // Parse specific outputs
      if (testType === 'unit' && output.includes('Coverage')) {
        this.parseCoverage(output);
      }
      
      if (testType === 'performance') {
        this.parsePerformanceMetrics(output);
      }
      
      if (testType === 'accessibility') {
        this.parseAccessibilityResults(output);
      }
      
      return output;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results[testType].passed = false;
      this.results[testType].duration = duration;
      this.results[testType].error = error.message;
      
      this.log(`❌ ${testType} tests failed (${duration}ms)`, 'red');
      this.log(`Error: ${error.message}`, 'red');
      
      return null;
    }
  }

  parseCoverage(output) {
    // Extract coverage information from Jest output
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      this.results.unit.coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
    }
  }

  parsePerformanceMetrics(output) {
    // Extract performance metrics from test output
    const metrics = {};
    
    // Look for timing information in console logs
    const timingMatches = output.matchAll(/(\w+)\s+processing time:\s+([\d.]+)ms/g);
    for (const match of timingMatches) {
      metrics[match[1]] = parseFloat(match[2]);
    }
    
    // Look for memory usage
    const memoryMatch = output.match(/Memory increase during processing:\s+([\d.]+)MB/);
    if (memoryMatch) {
      metrics.memoryIncrease = parseFloat(memoryMatch[1]);
    }
    
    this.results.performance.metrics = metrics;
  }

  parseAccessibilityResults(output) {
    // Count accessibility violations
    const violationMatches = output.matchAll(/Expected the HTML found at/g);
    this.results.accessibility.violations = Array.from(violationMatches).length;
  }

  async runUnitTests() {
    this.logSection('UNIT TESTS');
    await this.runCommand('npm run test:coverage', 'unit');
  }

  async runIntegrationTests() {
    this.logSection('INTEGRATION TESTS');
    await this.runCommand('npm run test:integration', 'integration');
  }

  async runE2ETests() {
    this.logSection('END-TO-END TESTS');
    this.log('Starting development server for E2E tests...', 'yellow');
    
    // Start the dev server in background
    const serverProcess = require('child_process').spawn('npm', ['start'], {
      stdio: 'pipe',
      detached: true
    });
    
    // Wait for server to be ready
    await this.waitForServer();
    
    try {
      await this.runCommand('npm run test:e2e', 'e2e');
    } finally {
      // Clean up server
      this.log('Stopping development server...', 'yellow');
      process.kill(-serverProcess.pid);
    }
  }

  async runPerformanceTests() {
    this.logSection('PERFORMANCE TESTS');
    await this.runCommand('npm run test:performance', 'performance');
  }

  async runAccessibilityTests() {
    this.logSection('ACCESSIBILITY TESTS');
    await this.runCommand('npm run test:accessibility', 'accessibility');
  }

  async waitForServer(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const { execSync } = require('child_process');
        execSync('curl -f http://localhost:3000 > /dev/null 2>&1');
        this.log('Development server is ready', 'green');
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Development server failed to start within timeout');
  }

  generateReport() {
    this.logSection('TEST RESULTS SUMMARY');
    
    const totalDuration = Date.now() - this.startTime;
    let totalPassed = 0;
    let totalTests = 0;
    
    // Summary table
    this.log('Test Suite Results:', 'bright');
    this.log('┌─────────────────┬─────────┬─────────────┬─────────────┐', 'cyan');
    this.log('│ Test Suite      │ Status  │ Duration    │ Details     │', 'cyan');
    this.log('├─────────────────┼─────────┼─────────────┼─────────────┤', 'cyan');
    
    Object.entries(this.results).forEach(([testType, result]) => {
      totalTests++;
      if (result.passed) totalPassed++;
      
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`.padEnd(11);
      const details = this.getTestDetails(testType, result);
      
      this.log(`│ ${testType.padEnd(15)} │ ${status}  │ ${duration} │ ${details.padEnd(11)} │`, 
        result.passed ? 'green' : 'red');
    });
    
    this.log('└─────────────────┴─────────┴─────────────┴─────────────┘', 'cyan');
    
    // Overall summary
    this.log(`\nOverall Results:`, 'bright');
    this.log(`• Tests Passed: ${totalPassed}/${totalTests}`, totalPassed === totalTests ? 'green' : 'red');
    this.log(`• Total Duration: ${totalDuration}ms`, 'blue');
    
    // Coverage information
    if (this.results.unit.coverage) {
      this.log(`\nCode Coverage:`, 'bright');
      const coverage = this.results.unit.coverage;
      this.log(`• Statements: ${coverage.statements}%`, coverage.statements >= 80 ? 'green' : 'yellow');
      this.log(`• Branches: ${coverage.branches}%`, coverage.branches >= 80 ? 'green' : 'yellow');
      this.log(`• Functions: ${coverage.functions}%`, coverage.functions >= 80 ? 'green' : 'yellow');
      this.log(`• Lines: ${coverage.lines}%`, coverage.lines >= 80 ? 'green' : 'yellow');
    }
    
    // Performance metrics
    if (Object.keys(this.results.performance.metrics).length > 0) {
      this.log(`\nPerformance Metrics:`, 'bright');
      Object.entries(this.results.performance.metrics).forEach(([metric, value]) => {
        this.log(`• ${metric}: ${value}${metric.includes('time') ? 'ms' : metric.includes('Memory') ? 'MB' : ''}`, 'blue');
      });
    }
    
    // Accessibility results
    if (this.results.accessibility.violations !== undefined) {
      this.log(`\nAccessibility:`, 'bright');
      this.log(`• Violations Found: ${this.results.accessibility.violations}`, 
        this.results.accessibility.violations === 0 ? 'green' : 'red');
    }
    
    // Recommendations
    this.generateRecommendations();
    
    return totalPassed === totalTests;
  }

  getTestDetails(testType, result) {
    switch (testType) {
      case 'unit':
        return result.coverage ? `${result.coverage.lines}% cov` : 'No coverage';
      case 'performance':
        return Object.keys(result.metrics).length > 0 ? `${Object.keys(result.metrics).length} metrics` : 'No metrics';
      case 'accessibility':
        return result.violations !== undefined ? `${result.violations} violations` : 'No data';
      default:
        return result.passed ? 'Success' : 'Failed';
    }
  }

  generateRecommendations() {
    this.log(`\nRecommendations:`, 'bright');
    
    const recommendations = [];
    
    // Coverage recommendations
    if (this.results.unit.coverage) {
      const coverage = this.results.unit.coverage;
      if (coverage.lines < 80) {
        recommendations.push(`• Increase test coverage (currently ${coverage.lines}%, target: 80%+)`);
      }
      if (coverage.branches < 70) {
        recommendations.push(`• Add more branch coverage tests (currently ${coverage.branches}%)`);
      }
    }
    
    // Performance recommendations
    const perfMetrics = this.results.performance.metrics;
    if (perfMetrics.memoryIncrease && perfMetrics.memoryIncrease > 50) {
      recommendations.push(`• Optimize memory usage (current increase: ${perfMetrics.memoryIncrease}MB)`);
    }
    
    Object.entries(perfMetrics).forEach(([metric, value]) => {
      if (metric.includes('time') && value > 5000) {
        recommendations.push(`• Optimize ${metric} performance (current: ${value}ms)`);
      }
    });
    
    // Accessibility recommendations
    if (this.results.accessibility.violations > 0) {
      recommendations.push(`• Fix ${this.results.accessibility.violations} accessibility violations`);
    }
    
    // Failed test recommendations
    Object.entries(this.results).forEach(([testType, result]) => {
      if (!result.passed) {
        recommendations.push(`• Fix failing ${testType} tests`);
      }
    });
    
    if (recommendations.length === 0) {
      this.log('🎉 All tests are passing with good metrics!', 'green');
    } else {
      recommendations.forEach(rec => this.log(rec, 'yellow'));
    }
  }

  async saveReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalDuration: Date.now() - this.startTime,
        allPassed: Object.values(this.results).every(r => r.passed)
      }
    };
    
    const reportsDir = path.join(process.cwd(), 'test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportFile = path.join(reportsDir, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    
    this.log(`\nDetailed report saved to: ${reportFile}`, 'blue');
  }

  async run() {
    this.log('🚀 Starting Comprehensive Test Suite', 'bright');
    this.log(`Timestamp: ${new Date().toISOString()}`, 'blue');
    
    try {
      // Run all test suites
      await this.runUnitTests();
      await this.runIntegrationTests();
      await this.runE2ETests();
      await this.runPerformanceTests();
      await this.runAccessibilityTests();
      
      // Generate and save report
      const allPassed = this.generateReport();
      await this.saveReport();
      
      // Exit with appropriate code
      process.exit(allPassed ? 0 : 1);
      
    } catch (error) {
      this.log(`\n💥 Test runner failed: ${error.message}`, 'red');
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;