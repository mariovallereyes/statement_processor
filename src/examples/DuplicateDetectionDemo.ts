import { DuplicateDetectionService } from '../services/DuplicateDetectionService';
import { Transaction } from '../models/Transaction';

/**
 * Demonstrates the duplicate detection functionality with various scenarios
 */
export class DuplicateDetectionDemo {
  private service: DuplicateDetectionService;

  constructor() {
    this.service = new DuplicateDetectionService();
  }

  /**
   * Run all duplicate detection demos
   */
  runAllDemos(): void {
    console.log('=== Duplicate Detection Demo ===\n');
    
    this.demoExactDuplicates();
    this.demoLikelyDuplicates();
    this.demoPossibleDuplicates();
    this.demoNoDuplicates();
    this.demoCustomSettings();
  }

  /**
   * Demo: Exact duplicate detection
   */
  private demoExactDuplicates(): void {
    console.log('1. Exact Duplicates Demo');
    console.log('------------------------');

    const transactions: Transaction[] = [
      this.createTransaction({
        id: 'tx1',
        description: 'STARBUCKS STORE #1234',
        amount: -4.95,
        date: new Date('2024-01-15')
      }),
      this.createTransaction({
        id: 'tx2',
        description: 'STARBUCKS STORE #1234',
        amount: -4.95,
        date: new Date('2024-01-15')
      }),
      this.createTransaction({
        id: 'tx3',
        description: 'WALMART SUPERCENTER',
        amount: -25.50,
        date: new Date('2024-01-16')
      })
    ];

    const result = this.service.detectDuplicates(transactions);
    
    console.log(`Found ${result.duplicateGroups.length} duplicate groups`);
    console.log(`Total duplicates: ${result.totalDuplicates}`);
    
    result.duplicateGroups.forEach((group, index) => {
      console.log(`\nGroup ${index + 1}:`);
      console.log(`  Type: ${group.duplicateType}`);
      console.log(`  Similarity: ${Math.round(group.similarityScore * 100)}%`);
      console.log(`  Reason: ${group.reason.join(', ')}`);
      console.log(`  Transactions: ${group.transactions.length}`);
    });

    result.suggestions.forEach((suggestion, index) => {
      console.log(`\nSuggestion ${index + 1}:`);
      console.log(`  Action: ${suggestion.action}`);
      console.log(`  Confidence: ${Math.round(suggestion.confidence * 100)}%`);
      console.log(`  Reasoning: ${suggestion.reasoning}`);
    });

    console.log('\n');
  }

  /**
   * Demo: Likely duplicate detection
   */
  private demoLikelyDuplicates(): void {
    console.log('2. Likely Duplicates Demo');
    console.log('-------------------------');

    const transactions: Transaction[] = [
      this.createTransaction({
        id: 'tx1',
        description: 'AMAZON.COM*AMZN.COM/BILL WA',
        amount: -29.99,
        date: new Date('2024-01-15'),
        merchantName: 'Amazon'
      }),
      this.createTransaction({
        id: 'tx2',
        description: 'AMAZON.COM PURCHASE',
        amount: -29.99,
        date: new Date('2024-01-15'),
        merchantName: 'Amazon'
      })
    ];

    const result = this.service.detectDuplicates(transactions);
    
    console.log(`Found ${result.duplicateGroups.length} duplicate groups`);
    
    result.duplicateGroups.forEach((group, index) => {
      console.log(`\nGroup ${index + 1}:`);
      console.log(`  Type: ${group.duplicateType}`);
      console.log(`  Similarity: ${Math.round(group.similarityScore * 100)}%`);
      console.log(`  Reason: ${group.reason.join(', ')}`);
    });

    console.log('\n');
  }

  /**
   * Demo: Possible duplicate detection
   */
  private demoPossibleDuplicates(): void {
    console.log('3. Possible Duplicates Demo');
    console.log('---------------------------');

    const transactions: Transaction[] = [
      this.createTransaction({
        id: 'tx1',
        description: 'RESTAURANT ABC',
        amount: -45.00,
        date: new Date('2024-01-15')
      }),
      this.createTransaction({
        id: 'tx2',
        description: 'RESTAURANT ABC',
        amount: -54.00, // Different amount (tip included)
        date: new Date('2024-01-15')
      })
    ];

    const result = this.service.detectDuplicates(transactions);
    
    console.log(`Found ${result.duplicateGroups.length} duplicate groups`);
    
    result.duplicateGroups.forEach((group, index) => {
      console.log(`\nGroup ${index + 1}:`);
      console.log(`  Type: ${group.duplicateType}`);
      console.log(`  Similarity: ${Math.round(group.similarityScore * 100)}%`);
      console.log(`  Reason: ${group.reason.join(', ')}`);
    });

    console.log('\n');
  }

  /**
   * Demo: No duplicates scenario
   */
  private demoNoDuplicates(): void {
    console.log('4. No Duplicates Demo');
    console.log('---------------------');

    const transactions: Transaction[] = [
      this.createTransaction({
        id: 'tx1',
        description: 'STARBUCKS STORE #1234',
        amount: -4.95,
        date: new Date('2024-01-15')
      }),
      this.createTransaction({
        id: 'tx2',
        description: 'WALMART SUPERCENTER',
        amount: -25.50,
        date: new Date('2024-01-16')
      }),
      this.createTransaction({
        id: 'tx3',
        description: 'GAS STATION SHELL',
        amount: -35.00,
        date: new Date('2024-01-17')
      })
    ];

    const result = this.service.detectDuplicates(transactions);
    
    console.log(`Found ${result.duplicateGroups.length} duplicate groups`);
    console.log('All transactions are unique!\n');
  }

  /**
   * Demo: Custom settings impact
   */
  private demoCustomSettings(): void {
    console.log('5. Custom Settings Demo');
    console.log('-----------------------');

    // Create service with strict settings
    const strictService = new DuplicateDetectionService({
      dateToleranceDays: 0,
      amountTolerancePercent: 0,
      descriptionSimilarityThreshold: 0.95,
      exactMatchThreshold: 0.99,
      likelyMatchThreshold: 0.95,
      possibleMatchThreshold: 0.9
    });

    const transactions: Transaction[] = [
      this.createTransaction({
        id: 'tx1',
        description: 'STARBUCKS STORE #1234',
        amount: -4.95,
        date: new Date('2024-01-15')
      }),
      this.createTransaction({
        id: 'tx2',
        description: 'STARBUCKS STORE #1235', // Different store number
        amount: -4.95,
        date: new Date('2024-01-15')
      })
    ];

    console.log('Default settings:');
    const defaultResult = this.service.detectDuplicates(transactions);
    console.log(`  Found ${defaultResult.duplicateGroups.length} duplicate groups`);

    console.log('\nStrict settings:');
    const strictResult = strictService.detectDuplicates(transactions);
    console.log(`  Found ${strictResult.duplicateGroups.length} duplicate groups`);

    console.log('\n');
  }

  /**
   * Helper method to create a transaction
   */
  private createTransaction(overrides: Partial<Transaction>): Transaction {
    return {
      id: `tx_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date(),
      description: 'DEFAULT TRANSACTION',
      amount: -10.00,
      type: 'debit',
      confidence: 0.9,
      extractionConfidence: 0.9,
      classificationConfidence: 0.8,
      userValidated: false,
      ...overrides
    };
  }
}

// Example usage
if (require.main === module) {
  const demo = new DuplicateDetectionDemo();
  demo.runAllDemos();
}