import { 
  ProcessingDecision, 
  UncertainItem, 
  ConfidenceThresholds, 
  ProcessingConfidenceScores,
  ItemConfidenceScore,
  DEFAULT_CONFIDENCE_THRESHOLDS 
} from '../models/ProcessingDecision';
import { ExtractionResult } from '../models/ExtractionResult';
import { Transaction } from '../models/Transaction';
import { ClassificationResult } from '../models/ClassificationResult';

export class ConfidenceEngine {
  private thresholds: ConfidenceThresholds;

  constructor(thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Evaluates overall processing readiness based on extraction and classification confidence scores
   */
  evaluateProcessingReadiness(
    extractionResult: ExtractionResult,
    classificationResults: ClassificationResult[]
  ): ProcessingDecision {
    const confidenceScores = this.calculateConfidenceScores(extractionResult, classificationResults);
    const uncertainItems = this.identifyUncertainItems(extractionResult, classificationResults);
    
    const recommendedAction = this.determineRecommendedAction(confidenceScores);
    const canAutoProcess = recommendedAction === 'auto-export';
    const reasoning = this.generateReasoning(confidenceScores, uncertainItems, recommendedAction);

    return {
      canAutoProcess,
      requiresReview: uncertainItems,
      recommendedAction,
      reasoning,
      overallConfidence: confidenceScores.overall,
      extractionConfidence: confidenceScores.extraction,
      classificationConfidence: confidenceScores.classification,
      thresholds: this.thresholds
    };
  }

  /**
   * Calculates overall confidence scores from extraction and classification results
   */
  calculateConfidenceScores(
    extractionResult: ExtractionResult,
    classificationResults: ClassificationResult[]
  ): ProcessingConfidenceScores {
    const itemScores: ItemConfidenceScore[] = [];
    
    // Calculate extraction confidence for transactions
    let totalExtractionConfidence = 0;
    let extractionCount = 0;

    extractionResult.transactions.forEach(transaction => {
      const extractionConfidence = transaction.extractionConfidence || 0;
      totalExtractionConfidence += extractionConfidence;
      extractionCount++;

      itemScores.push({
        itemId: transaction.id,
        itemType: 'transaction',
        extractionConfidence,
        validationConfidence: this.calculateValidationConfidence(transaction)
      });
    });

    // Add account info confidence
    if (extractionResult.accountInfo) {
      const accountConfidence = extractionResult.confidence?.accountInfo || 0.8;
      totalExtractionConfidence += accountConfidence;
      extractionCount++;

      itemScores.push({
        itemId: 'account_info',
        itemType: 'account_info',
        extractionConfidence: accountConfidence,
        validationConfidence: this.calculateAccountInfoValidation(extractionResult.accountInfo)
      });
    }

    // Calculate classification confidence
    let totalClassificationConfidence = 0;
    let classificationCount = 0;

    classificationResults.forEach(result => {
      const confidence = result.confidence || 0;
      totalClassificationConfidence += confidence;
      classificationCount++;

      // Update corresponding item score
      const itemScore = itemScores.find(item => item.itemId === result.transactionId);
      if (itemScore) {
        itemScore.classificationConfidence = confidence;
      }
    });

    const extractionConfidence = extractionCount > 0 ? totalExtractionConfidence / extractionCount : 0;
    const classificationConfidence = classificationCount > 0 ? totalClassificationConfidence / classificationCount : 0;
    
    // Overall confidence is weighted average (extraction 60%, classification 40%)
    const overallConfidence = (extractionConfidence * 0.6) + (classificationConfidence * 0.4);

    return {
      extraction: extractionConfidence,
      classification: classificationConfidence,
      overall: overallConfidence,
      itemScores
    };
  }

  /**
   * Identifies items that require user review based on confidence thresholds
   */
  identifyUncertainItems(
    extractionResult: ExtractionResult,
    classificationResults: ClassificationResult[]
  ): UncertainItem[] {
    const uncertainItems: UncertainItem[] = [];

    // Check extraction uncertainties
    extractionResult.transactions.forEach(transaction => {
      const extractionConfidence = transaction.extractionConfidence || 0;
      
      if (extractionConfidence < this.thresholds.fullReviewThreshold) {
        uncertainItems.push({
          id: `extraction_${transaction.id}`,
          type: 'extraction',
          description: `Low confidence in transaction extraction: ${transaction.description}`,
          confidence: extractionConfidence,
          suggestedAction: 'Verify transaction details and amounts',
          affectedTransactions: [transaction.id]
        });
      }

      // Check for missing critical data
      if (!transaction.date || !transaction.amount) {
        uncertainItems.push({
          id: `validation_${transaction.id}`,
          type: 'validation',
          description: `Missing critical transaction data: ${transaction.description}`,
          confidence: 0,
          suggestedAction: 'Manually enter missing date or amount',
          affectedTransactions: [transaction.id]
        });
      }
    });

    // Check classification uncertainties
    classificationResults.forEach(result => {
      if (result.confidence < this.thresholds.targetedReviewMax) {
        const transaction = extractionResult.transactions.find(t => t.id === result.transactionId);
        uncertainItems.push({
          id: `classification_${result.transactionId}`,
          type: 'classification',
          description: `Uncertain category classification for: ${transaction?.description || 'Unknown transaction'}`,
          confidence: result.confidence,
          suggestedAction: `Review suggested category: ${result.category}`,
          affectedTransactions: [result.transactionId]
        });
      }
    });

    // Check account info confidence
    if (extractionResult.confidence?.accountInfo && 
        extractionResult.confidence.accountInfo < this.thresholds.targetedReviewMax) {
      uncertainItems.push({
        id: 'account_info_validation',
        type: 'validation',
        description: 'Account information extraction has low confidence',
        confidence: extractionResult.confidence.accountInfo,
        suggestedAction: 'Verify account number, type, and statement period'
      });
    }

    return uncertainItems;
  }

  /**
   * Determines recommended action based on confidence scores
   */
  private determineRecommendedAction(confidenceScores: ProcessingConfidenceScores): 'auto-export' | 'targeted-review' | 'full-review' {
    const { extraction, classification, overall } = confidenceScores;

    // Auto-processing: both extraction and classification are high confidence
    if (extraction >= this.thresholds.autoProcessing && 
        classification >= this.thresholds.autoProcessing && 
        overall >= this.thresholds.autoProcessing) {
      return 'auto-export';
    }

    // Full review: either extraction or overall confidence is very low
    if (extraction < this.thresholds.fullReviewThreshold || 
        overall < this.thresholds.fullReviewThreshold) {
      return 'full-review';
    }

    // Targeted review: moderate confidence levels
    return 'targeted-review';
  }

  /**
   * Generates human-readable reasoning for the processing decision
   */
  private generateReasoning(
    confidenceScores: ProcessingConfidenceScores,
    uncertainItems: UncertainItem[],
    recommendedAction: string
  ): string {
    const { extraction, classification, overall } = confidenceScores;
    
    let reasoning = `Overall confidence: ${(overall * 100).toFixed(1)}% `;
    reasoning += `(Extraction: ${(extraction * 100).toFixed(1)}%, Classification: ${(classification * 100).toFixed(1)}%). `;

    switch (recommendedAction) {
      case 'auto-export':
        reasoning += 'High confidence in all areas allows for automatic processing. ';
        reasoning += 'All transactions have been successfully extracted and classified with high accuracy.';
        break;
      
      case 'targeted-review':
        reasoning += 'Moderate confidence requires targeted review of specific items. ';
        if (uncertainItems.length > 0) {
          reasoning += `${uncertainItems.length} item(s) need attention: `;
          reasoning += uncertainItems.slice(0, 3).map(item => item.description).join(', ');
          if (uncertainItems.length > 3) {
            reasoning += ` and ${uncertainItems.length - 3} more`;
          }
          reasoning += '.';
        }
        break;
      
      case 'full-review':
        reasoning += 'Low confidence requires comprehensive review before processing. ';
        if (extraction < this.thresholds.fullReviewThreshold) {
          reasoning += 'Extraction quality is below acceptable threshold. ';
        }
        if (overall < this.thresholds.fullReviewThreshold) {
          reasoning += 'Overall processing confidence is insufficient for reliable results.';
        }
        break;
    }

    return reasoning;
  }

  /**
   * Calculates validation confidence for a transaction based on data completeness
   */
  private calculateValidationConfidence(transaction: Transaction): number {
    let score = 0;
    let maxScore = 0;

    // Required fields
    if (transaction.date) { score += 30; }
    maxScore += 30;

    if (transaction.amount && transaction.amount !== 0) { score += 30; }
    maxScore += 30;

    if (transaction.description && transaction.description.trim().length > 0) { score += 20; }
    maxScore += 20;

    // Optional but valuable fields
    if (transaction.merchantName) { score += 10; }
    maxScore += 10;

    if (transaction.type) { score += 5; }
    maxScore += 5;

    if (transaction.referenceNumber || transaction.checkNumber) { score += 5; }
    maxScore += 5;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Calculates validation confidence for account information
   */
  private calculateAccountInfoValidation(accountInfo: any): number {
    let score = 0;
    let maxScore = 0;

    if (accountInfo.accountNumber) { score += 25; }
    maxScore += 25;

    if (accountInfo.accountType) { score += 15; }
    maxScore += 15;

    if (accountInfo.statementPeriod?.startDate && accountInfo.statementPeriod?.endDate) { score += 25; }
    maxScore += 25;

    if (accountInfo.openingBalance !== undefined) { score += 15; }
    maxScore += 15;

    if (accountInfo.closingBalance !== undefined) { score += 15; }
    maxScore += 15;

    if (accountInfo.customerName) { score += 5; }
    maxScore += 5;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Updates confidence thresholds
   */
  updateThresholds(newThresholds: Partial<ConfidenceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Gets current confidence thresholds
   */
  getThresholds(): ConfidenceThresholds {
    return { ...this.thresholds };
  }
}