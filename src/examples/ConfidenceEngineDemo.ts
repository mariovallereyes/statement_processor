/**
 * Demonstration of how to use the ConfidenceEngine in the Bank Statement Processor
 * This example shows the complete workflow from extraction to decision making
 */

import { ConfidenceEngine } from '../services/ConfidenceEngine';
import { ExtractionResult } from '../models/ExtractionResult';
import { ClassificationResult } from '../models/ClassificationResult';
import { Transaction } from '../models/Transaction';
import { AccountInfo } from '../models/AccountInfo';

export class ConfidenceEngineDemo {
    private confidenceEngine: ConfidenceEngine;

    constructor() {
        // Initialize with default thresholds
        this.confidenceEngine = new ConfidenceEngine();
    }

    /**
     * Demonstrates the complete confidence evaluation workflow
     */
    async demonstrateConfidenceEvaluation(): Promise<void> {
        console.log('=== Bank Statement Processor - Confidence Engine Demo ===\n');

        // Scenario 1: High confidence - auto-processing
        console.log('Scenario 1: High Confidence Statement');
        const highConfidenceResult = this.createHighConfidenceScenario();
        const highConfidenceDecision = this.confidenceEngine.evaluateProcessingReadiness(
            highConfidenceResult.extraction,
            highConfidenceResult.classifications
        );

        console.log(`Recommended Action: ${highConfidenceDecision.recommendedAction}`);
        console.log(`Can Auto-Process: ${highConfidenceDecision.canAutoProcess}`);
        console.log(`Overall Confidence: ${(highConfidenceDecision.overallConfidence * 100).toFixed(1)}%`);
        console.log(`Items Requiring Review: ${highConfidenceDecision.requiresReview.length}`);
        console.log(`Reasoning: ${highConfidenceDecision.reasoning}\n`);

        // Scenario 2: Moderate confidence - targeted review
        console.log('Scenario 2: Moderate Confidence Statement');
        const moderateConfidenceResult = this.createModerateConfidenceScenario();
        const moderateConfidenceDecision = this.confidenceEngine.evaluateProcessingReadiness(
            moderateConfidenceResult.extraction,
            moderateConfidenceResult.classifications
        );

        console.log(`Recommended Action: ${moderateConfidenceDecision.recommendedAction}`);
        console.log(`Can Auto-Process: ${moderateConfidenceDecision.canAutoProcess}`);
        console.log(`Overall Confidence: ${(moderateConfidenceDecision.overallConfidence * 100).toFixed(1)}%`);
        console.log(`Items Requiring Review: ${moderateConfidenceDecision.requiresReview.length}`);
        console.log('Review Items:');
        moderateConfidenceDecision.requiresReview.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.description} (${(item.confidence * 100).toFixed(1)}% confidence)`);
            console.log(`     Suggested Action: ${item.suggestedAction}`);
        });
        console.log(`Reasoning: ${moderateConfidenceDecision.reasoning}\n`);

        // Scenario 3: Low confidence - full review
        console.log('Scenario 3: Low Confidence Statement');
        const lowConfidenceResult = this.createLowConfidenceScenario();
        const lowConfidenceDecision = this.confidenceEngine.evaluateProcessingReadiness(
            lowConfidenceResult.extraction,
            lowConfidenceResult.classifications
        );

        console.log(`Recommended Action: ${lowConfidenceDecision.recommendedAction}`);
        console.log(`Can Auto-Process: ${lowConfidenceDecision.canAutoProcess}`);
        console.log(`Overall Confidence: ${(lowConfidenceDecision.overallConfidence * 100).toFixed(1)}%`);
        console.log(`Items Requiring Review: ${lowConfidenceDecision.requiresReview.length}`);
        console.log(`Reasoning: ${lowConfidenceDecision.reasoning}\n`);

        // Demonstrate custom thresholds
        console.log('Scenario 4: Custom Thresholds (Stricter Requirements)');
        this.demonstrateCustomThresholds();
    }

    /**
     * Creates a high confidence scenario for demonstration
     */
    private createHighConfidenceScenario(): { extraction: ExtractionResult, classifications: ClassificationResult[] } {
        const transactions: Transaction[] = [
            {
                id: '1',
                date: new Date('2024-01-15'),
                description: 'AMAZON.COM AMZN.COM/BILL WA',
                amount: -129.99,
                type: 'debit',
                merchantName: 'Amazon',
                referenceNumber: 'REF123456789',
                extractionConfidence: 0.98,
                classificationConfidence: 0,
                userValidated: false,
                appliedRules: [],
                confidence: 0.98
            },
            {
                id: '2',
                date: new Date('2024-01-16'),
                description: 'SHELL OIL 12345678901 SEATTLE WA',
                amount: -45.20,
                type: 'debit',
                merchantName: 'Shell',
                extractionConfidence: 0.97,
                classificationConfidence: 0,
                userValidated: false,
                appliedRules: [],
                confidence: 0.97
            }
        ];

        const accountInfo: AccountInfo = {
            accountNumber: '****1234',
            accountType: 'Checking',
            bankName: 'Bank of America',
            customerName: 'John Doe',
            statementPeriod: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            },
            openingBalance: 1500.00,
            closingBalance: 1325.81
        };

        const extraction: ExtractionResult = {
            transactions,
            accountInfo,
            statementPeriod: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            },
            confidence: {
                overall: 0.97,
                extraction: 0.98,
                classification: 0.96,
                accountInfo: 0.97
            },
            extractionMetadata: {
                processingTime: 1200,
                documentType: 'pdf',
                ocrUsed: false,
                layoutRecognized: true,
                totalTransactions: 2
            }
        };

        const classifications: ClassificationResult[] = [
            {
                transactionId: '1',
                category: 'Online Shopping',
                confidence: 0.96,
                reasoning: ['Amazon.com identified as major online retailer'],
                suggestedRules: []
            },
            {
                transactionId: '2',
                category: 'Gas & Fuel',
                confidence: 0.98,
                reasoning: ['Shell identified as gas station chain'],
                suggestedRules: []
            }
        ];

        return { extraction, classifications };
    }

    /**
     * Creates a moderate confidence scenario for demonstration
     */
    private createModerateConfidenceScenario(): { extraction: ExtractionResult, classifications: ClassificationResult[] } {
        const transactions: Transaction[] = [
            {
                id: '1',
                date: new Date('2024-01-15'),
                description: 'WALMART SUPERCENTER #1234',
                amount: -89.45,
                type: 'debit',
                merchantName: 'Walmart',
                extractionConfidence: 0.92,
                classificationConfidence: 0,
                userValidated: false,
                appliedRules: [],
                confidence: 0.92
            },
            {
                id: '2',
                date: new Date('2024-01-16'),
                description: 'UNCLEAR MERCHANT NAME 123',
                amount: -25.00,
                type: 'debit',
                extractionConfidence: 0.75, // Low extraction confidence
                classificationConfidence: 0,
                userValidated: false,
                appliedRules: [],
                confidence: 0.75
            },
            {
                id: '3',
                date: new Date('2024-01-17'),
                description: 'LOCAL BUSINESS XYZ',
                amount: -50.00,
                type: 'debit',
                merchantName: 'Local Business XYZ',
                extractionConfidence: 0.88,
                classificationConfidence: 0,
                userValidated: false,
                appliedRules: [],
                confidence: 0.88
            }
        ];

        const accountInfo: AccountInfo = {
            accountNumber: '****1234',
            accountType: 'Checking',
            bankName: 'Bank of America',
            customerName: 'John Doe',
            statementPeriod: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            },
            openingBalance: 1500.00,
            closingBalance: 1335.55
        };

        const extraction: ExtractionResult = {
            transactions,
            accountInfo,
            statementPeriod: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            },
            confidence: {
                overall: 0.85,
                extraction: 0.85,
                classification: 0.80,
                accountInfo: 0.90
            },
            extractionMetadata: {
                processingTime: 2500,
                documentType: 'pdf',
                ocrUsed: true,
                layoutRecognized: true,
                totalTransactions: 3
            }
        };

        const classifications: ClassificationResult[] = [
            {
                transactionId: '1',
                category: 'Groceries',
                confidence: 0.88,
                reasoning: ['Walmart identified as retail store, likely groceries'],
                suggestedRules: []
            },
            {
                transactionId: '2',
                category: 'Miscellaneous',
                confidence: 0.60, // Low classification confidence
                reasoning: ['Unable to determine merchant category from unclear name'],
                suggestedRules: []
            },
            {
                transactionId: '3',
                category: 'Services',
                confidence: 0.70, // Moderate classification confidence
                reasoning: ['Local business pattern suggests service provider'],
                suggestedRules: []
            }
        ];

        return { extraction, classifications };
    }

    /**
     * Creates a low confidence scenario for demonstration
     */
    private createLowConfidenceScenario(): { extraction: ExtractionResult, classifications: ClassificationResult[] } {
        const transactions: Transaction[] = [
            {
                id: '1',
                date: undefined as any, // Missing critical data
                description: 'GARBLED TEXT ###',
                amount: 0, // Invalid amount
                type: 'debit',
                extractionConfidence: 0.45,
                classificationConfidence: 0,
                userValidated: false,
                appliedRules: [],
                confidence: 0.45
            },
            {
                id: '2',
                date: new Date('2024-01-16'),
                description: 'UNREADABLE MERCHANT',
                amount: -50.00,
                type: 'debit',
                extractionConfidence: 0.55,
                classificationConfidence: 0,
                userValidated: false,
                appliedRules: [],
                confidence: 0.55
            }
        ];

        const accountInfo: AccountInfo = {
            accountNumber: 'UNKNOWN',
            accountType: 'Unknown',
            bankName: 'Bank of America',
            customerName: 'UNREADABLE',
            statementPeriod: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            },
            openingBalance: 0,
            closingBalance: 0
        };

        const extraction: ExtractionResult = {
            transactions,
            accountInfo,
            statementPeriod: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            },
            confidence: {
                overall: 0.45,
                extraction: 0.50,
                classification: 0.40,
                accountInfo: 0.30
            },
            extractionMetadata: {
                processingTime: 5000,
                documentType: 'pdf',
                ocrUsed: true,
                layoutRecognized: false,
                totalTransactions: 2
            }
        };

        const classifications: ClassificationResult[] = [
            {
                transactionId: '1',
                category: 'Unknown',
                confidence: 0.20,
                reasoning: ['Unable to classify due to poor extraction quality'],
                suggestedRules: []
            },
            {
                transactionId: '2',
                category: 'Miscellaneous',
                confidence: 0.35,
                reasoning: ['Low confidence classification'],
                suggestedRules: []
            }
        ];

        return { extraction, classifications };
    }

    /**
     * Demonstrates using custom confidence thresholds
     */
    private demonstrateCustomThresholds(): void {
        // Create a stricter confidence engine
        const strictEngine = new ConfidenceEngine({
            autoProcessing: 0.99,        // Very high threshold for auto-processing
            targetedReviewMin: 0.90,     // Higher minimum for targeted review
            targetedReviewMax: 0.99,     // Higher maximum for targeted review
            fullReviewThreshold: 0.90    // Higher threshold for full review
        });

        const moderateResult = this.createModerateConfidenceScenario();
        const strictDecision = strictEngine.evaluateProcessingReadiness(
            moderateResult.extraction,
            moderateResult.classifications
        );

        console.log('With stricter thresholds:');
        console.log(`Recommended Action: ${strictDecision.recommendedAction}`);
        console.log(`Overall Confidence: ${(strictDecision.overallConfidence * 100).toFixed(1)}%`);
        console.log(`Reasoning: ${strictDecision.reasoning}`);

        // Show threshold comparison
        console.log('\nThreshold Comparison:');
        console.log('Default Thresholds:');
        console.log(`  Auto-processing: >95%`);
        console.log(`  Targeted review: 80-95%`);
        console.log(`  Full review: <80%`);
        console.log('Strict Thresholds:');
        console.log(`  Auto-processing: >99%`);
        console.log(`  Targeted review: 90-99%`);
        console.log(`  Full review: <90%`);
    }
}

// Example usage
export async function runConfidenceEngineDemo(): Promise<void> {
    const demo = new ConfidenceEngineDemo();
    await demo.demonstrateConfidenceEvaluation();
}

// Uncomment to run the demo
// runConfidenceEngineDemo().catch(console.error);