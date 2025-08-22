import { LearningEngine } from '../services/LearningEngine';
import { DatabaseService } from '../services/DatabaseService';
import { TransactionClassificationService } from '../services/TransactionClassificationService';
import { Transaction } from '../models/Transaction';
import { UserCorrection } from '../models/UserFeedback';

/**
 * Demo showing how the LearningEngine improves classification accuracy through user feedback
 */
export class LearningEngineDemo {
  private learningEngine: LearningEngine;
  private classificationService: TransactionClassificationService;
  private databaseService: DatabaseService;

  constructor() {
    this.databaseService = new DatabaseService();
    this.learningEngine = new LearningEngine(this.databaseService);
    this.classificationService = new TransactionClassificationService();
  }

  /**
   * Demonstrates the complete learning workflow
   */
  async runDemo(): Promise<void> {
    console.log('🧠 Learning Engine Demo Starting...\n');

    // Step 1: Create sample transactions
    const transactions = this.createSampleTransactions();
    console.log('📊 Sample Transactions Created:');
    transactions.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.description} - $${Math.abs(t.amount)}`);
    });
    console.log();

    // Step 2: Initial classification (before learning)
    console.log('🔍 Initial Classification (Before Learning):');
    const initialClassifications = transactions.map(transaction => {
      const result = this.classificationService.classifyTransaction(transaction);
      console.log(`  ${transaction.description} → ${result.category} (${(result.confidence * 100).toFixed(1)}%)`);
      return result;
    });
    console.log();

    // Step 3: Simulate user corrections
    console.log('✏️ User Corrections:');
    const corrections = this.createUserCorrections(transactions, initialClassifications);
    
    for (const correction of corrections) {
      console.log(`  Correcting "${correction.description}" from "${correction.originalClassification}" to "${correction.correctedClassification}"`);
      await this.learningEngine.learnFromCorrection(correction);
    }
    console.log();

    // Step 4: Show learning metrics
    const metrics = await this.learningEngine.getLearningMetrics();
    console.log('📈 Learning Metrics:');
    console.log(`  Total Corrections: ${metrics.totalCorrections}`);
    console.log(`  Patterns Learned: ${metrics.patternsLearned}`);
    console.log(`  Rules Created: ${metrics.rulesCreated}`);
    console.log(`  Accuracy Improvement: ${(metrics.accuracyImprovement * 100).toFixed(1)}%`);
    console.log();

    // Step 5: Test improved classification
    console.log('🎯 Improved Classification (After Learning):');
    const newTransactions = this.createTestTransactions();
    
    for (const transaction of newTransactions) {
      // Try ML prediction first
      const mlPrediction = await this.learningEngine.predictCategory(transaction);
      
      // Fallback to rule-based classification
      const ruleBasedResult = this.classificationService.classifyTransaction(transaction);
      
      if (mlPrediction && mlPrediction.confidence > 0.7) {
        console.log(`  ${transaction.description} → ${mlPrediction.category} (ML: ${(mlPrediction.confidence * 100).toFixed(1)}%)`);
      } else {
        console.log(`  ${transaction.description} → ${ruleBasedResult.category} (Rules: ${(ruleBasedResult.confidence * 100).toFixed(1)}%)`);
      }
    }
    console.log();

    // Step 6: Show created rules
    const rules = await this.databaseService.getUserRules();
    if (rules.length > 0) {
      console.log('📋 Auto-Created Rules:');
      rules.forEach((rule, i) => {
        console.log(`  ${i + 1}. ${rule.name}`);
      });
      console.log();
    }

    console.log('✅ Learning Engine Demo Complete!');
  }

  /**
   * Creates sample transactions for demonstration
   */
  private createSampleTransactions(): Transaction[] {
    return [
      {
        id: 'demo_1',
        date: new Date(),
        description: 'STARBUCKS STORE #1234',
        amount: -4.50,
        type: 'debit',
        merchantName: 'Starbucks',
        confidence: 0.3,
        extractionConfidence: 0.9,
        classificationConfidence: 0,
        userValidated: false,
        appliedRules: []
      },
      {
        id: 'demo_2',
        date: new Date(),
        description: 'WHOLE FOODS MARKET',
        amount: -67.89,
        type: 'debit',
        merchantName: 'Whole Foods',
        confidence: 0.3,
        extractionConfidence: 0.9,
        classificationConfidence: 0,
        userValidated: false,
        appliedRules: []
      },
      {
        id: 'demo_3',
        date: new Date(),
        description: 'SHELL GAS STATION #5678',
        amount: -35.20,
        type: 'debit',
        merchantName: 'Shell',
        confidence: 0.3,
        extractionConfidence: 0.9,
        classificationConfidence: 0,
        userValidated: false,
        appliedRules: []
      }
    ];
  }

  /**
   * Creates user corrections to simulate learning
   */
  private createUserCorrections(transactions: Transaction[], classifications: any[]): UserCorrection[] {
    return [
      {
        id: 'correction_1',
        transactionId: transactions[0].id,
        originalClassification: classifications[0].category,
        correctedClassification: 'Dining',
        originalConfidence: classifications[0].confidence,
        merchantName: transactions[0].merchantName,
        description: transactions[0].description,
        amount: transactions[0].amount,
        timestamp: new Date(),
        feedbackType: 'category_correction'
      },
      {
        id: 'correction_2',
        transactionId: transactions[1].id,
        originalClassification: classifications[1].category,
        correctedClassification: 'Groceries',
        originalConfidence: classifications[1].confidence,
        merchantName: transactions[1].merchantName,
        description: transactions[1].description,
        amount: transactions[1].amount,
        timestamp: new Date(),
        feedbackType: 'category_correction'
      },
      {
        id: 'correction_3',
        transactionId: transactions[2].id,
        originalClassification: classifications[2].category,
        correctedClassification: 'Transportation',
        originalConfidence: classifications[2].confidence,
        merchantName: transactions[2].merchantName,
        description: transactions[2].description,
        amount: transactions[2].amount,
        timestamp: new Date(),
        feedbackType: 'category_correction'
      }
    ];
  }

  /**
   * Creates test transactions to show improved classification
   */
  private createTestTransactions(): Transaction[] {
    return [
      {
        id: 'test_1',
        date: new Date(),
        description: 'STARBUCKS DOWNTOWN',
        amount: -6.75,
        type: 'debit',
        merchantName: 'Starbucks',
        confidence: 0.3,
        extractionConfidence: 0.9,
        classificationConfidence: 0,
        userValidated: false,
        appliedRules: []
      },
      {
        id: 'test_2',
        date: new Date(),
        description: 'WHOLE FOODS ORGANIC',
        amount: -45.32,
        type: 'debit',
        merchantName: 'Whole Foods',
        confidence: 0.3,
        extractionConfidence: 0.9,
        classificationConfidence: 0,
        userValidated: false,
        appliedRules: []
      },
      {
        id: 'test_3',
        date: new Date(),
        description: 'SHELL EXPRESS LANE',
        amount: -28.90,
        type: 'debit',
        merchantName: 'Shell',
        confidence: 0.3,
        extractionConfidence: 0.9,
        classificationConfidence: 0,
        userValidated: false,
        appliedRules: []
      }
    ];
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.learningEngine.dispose();
  }
}

// Example usage
export async function runLearningEngineDemo(): Promise<void> {
  const demo = new LearningEngineDemo();
  try {
    await demo.runDemo();
  } finally {
    demo.dispose();
  }
}