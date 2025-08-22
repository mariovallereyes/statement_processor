import * as tf from '@tensorflow/tfjs';
import { UserCorrection, UserFeedback, LearningPattern, ModelTrainingData, LearningMetrics } from '../models/UserFeedback';
import { Rule, RuleCondition, RuleAction } from '../models/ClassificationResult';
import { Transaction } from '../models/Transaction';
import { DatabaseService } from './DatabaseService';

export interface LearningEngineConfig {
  minCorrectionsForRule: number;
  confidenceThreshold: number;
  maxPatternsToStore: number;
  retrainingInterval: number; // in milliseconds
}

export class LearningEngine {
  private config: LearningEngineConfig;
  private databaseService: DatabaseService;
  private model: tf.LayersModel | null = null;
  private vocabulary: Map<string, number> = new Map();
  private categories: string[] = [];
  private isTraining = false;

  constructor(
    databaseService: DatabaseService,
    config: Partial<LearningEngineConfig> = {}
  ) {
    this.databaseService = databaseService;
    this.config = {
      minCorrectionsForRule: 3,
      confidenceThreshold: 0.8,
      maxPatternsToStore: 1000,
      retrainingInterval: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
    
    this.initializeModel();
  }

  /**
   * Initialize or load the TensorFlow.js model
   */
  private async initializeModel(): Promise<void> {
    try {
      // Try to load existing model from IndexedDB
      const savedModel = await this.databaseService.getMLModel();
      if (savedModel) {
        this.model = await tf.loadLayersModel(tf.io.fromMemory(savedModel.modelData));
        this.vocabulary = new Map(savedModel.vocabulary);
        this.categories = savedModel.categories;
        console.log('Loaded existing ML model from storage');
      } else {
        // Create new model
        await this.createNewModel();
        console.log('Created new ML model');
      }
    } catch (error) {
      console.warn('Error initializing ML model, running without TensorFlow:', error);
      this.model = null;
    }
  }

  /**
   * Create a new neural network model for transaction classification
   */
  private async createNewModel(): Promise<void> {
    try {
      // Simple feedforward neural network for text classification
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [100], // Feature vector size
            units: 64,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 10, // Will be adjusted based on number of categories
            activation: 'softmax'
          })
        ]
      });

      if (this.model) {
        this.model.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy']
        });
      }
    } catch (error) {
      console.warn('Failed to create TensorFlow model, running in fallback mode:', error);
      this.model = null;
    }
  }

  /**
   * Learn from user correction and update the model
   */
  public async learnFromCorrection(correction: UserCorrection): Promise<void> {
    try {
      // Store the correction
      await this.databaseService.addUserCorrection(correction);

      // Extract learning pattern
      const pattern = await this.extractLearningPattern(correction);
      if (pattern) {
        await this.databaseService.addLearningPattern(pattern);
      }

      // Check if we should create a rule
      const ruleSuggestion = await this.analyzeForRuleCreation(correction);
      if (ruleSuggestion) {
        await this.createAutomaticRule(ruleSuggestion, correction);
      }

      // Schedule model retraining if enough new data
      await this.scheduleRetraining();

    } catch (error) {
      console.error('Error learning from correction:', error);
    }
  }

  /**
   * Extract learning pattern from user correction
   */
  private async extractLearningPattern(correction: UserCorrection): Promise<LearningPattern | null> {
    try {
      // Extract meaningful patterns from the transaction description and merchant name
      const text = `${correction.description} ${correction.merchantName || ''}`.toLowerCase();
      const words = text.split(/\s+/).filter(word => word.length > 2);
      
      // Find the most significant words (simple approach)
      const significantWords = words.filter(word => 
        !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word)
      );

      if (significantWords.length === 0) return null;

      // Create pattern from most common words
      const pattern = significantWords.slice(0, 3).join(' ');

      return {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        pattern,
        category: correction.correctedClassification,
        confidence: 0.7, // Initial confidence
        occurrences: 1,
        lastSeen: new Date(),
        source: 'user_correction'
      };
    } catch (error) {
      console.error('Error extracting learning pattern:', error);
      return null;
    }
  }

  /**
   * Analyze if a rule should be created based on correction patterns
   */
  private async analyzeForRuleCreation(correction: UserCorrection): Promise<Rule | null> {
    try {
      // Get similar corrections
      const allCorrections = await this.databaseService.getUserCorrections();
      const similarCorrections = allCorrections.filter(c => 
        c.correctedClassification === correction.correctedClassification &&
        (c.merchantName === correction.merchantName || 
         this.calculateTextSimilarity(c.description, correction.description) > 0.7)
      );

      if (similarCorrections.length >= this.config.minCorrectionsForRule) {
        // Create rule based on merchant name or description pattern
        if (correction.merchantName) {
          return {
            id: `auto_rule_${Date.now()}`,
            name: `Auto-classify ${correction.merchantName} as ${correction.correctedClassification}`,
            conditions: [{
              field: 'merchantName',
              operator: 'contains',
              value: correction.merchantName.toLowerCase()
            }],
            action: {
              type: 'setCategory',
              value: correction.correctedClassification
            },
            confidence: 0.9,
            createdDate: new Date()
          };
        } else {
          // Create rule based on description pattern
          const commonWords = this.findCommonWords(similarCorrections.map(c => c.description));
          if (commonWords.length > 0) {
            return {
              id: `auto_rule_${Date.now()}`,
              name: `Auto-classify transactions containing "${commonWords[0]}" as ${correction.correctedClassification}`,
              conditions: [{
                field: 'description',
                operator: 'contains',
                value: commonWords[0].toLowerCase()
              }],
              action: {
                type: 'setCategory',
                value: correction.correctedClassification
              },
              confidence: 0.8,
              createdDate: new Date()
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error analyzing for rule creation:', error);
      return null;
    }
  }

  /**
   * Create an automatic rule and store it
   */
  private async createAutomaticRule(rule: Rule, triggerCorrection: UserCorrection): Promise<void> {
    try {
      await this.databaseService.addUserRule(rule);
      
      // Record rule creation
      const ruleCreation = {
        id: `rule_creation_${Date.now()}`,
        ruleId: rule.id,
        triggerCorrections: [triggerCorrection.id],
        timestamp: new Date()
      };
      
      await this.databaseService.addRuleCreation(ruleCreation);
      console.log(`Created automatic rule: ${rule.name}`);
    } catch (error) {
      console.error('Error creating automatic rule:', error);
    }
  }

  /**
   * Schedule model retraining if conditions are met
   */
  private async scheduleRetraining(): Promise<void> {
    if (this.isTraining) return;

    try {
      const corrections = await this.databaseService.getUserCorrections();
      const lastTraining = await this.databaseService.getLastTrainingDate();
      const now = new Date();

      // Retrain if we have enough new corrections or enough time has passed
      const shouldRetrain = 
        corrections.length >= 10 && 
        (!lastTraining || (now.getTime() - lastTraining.getTime()) > this.config.retrainingInterval);

      if (shouldRetrain) {
        setTimeout(() => this.retrainModel(), 1000); // Delay to avoid blocking UI
      }
    } catch (error) {
      console.error('Error scheduling retraining:', error);
    }
  }

  /**
   * Retrain the model with accumulated user feedback
   */
  public async retrainModel(): Promise<void> {
    if (this.isTraining) return;
    
    this.isTraining = true;
    console.log('Starting model retraining...');

    try {
      const trainingData = await this.prepareTrainingData();
      if (trainingData.features.length === 0) {
        console.log('No training data available');
        return;
      }

      // Update model architecture if needed
      await this.updateModelArchitecture(trainingData.labels);

      // Convert to tensors
      const xs = tf.tensor2d(trainingData.features);
      const ys = tf.tensor2d(this.encodeLabels(trainingData.labels));

      // Train the model if it exists
      if (this.model) {
        await this.model.fit(xs, ys, {
          epochs: 10,
          batchSize: 32,
          validationSplit: 0.2,
          shuffle: true,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              console.log(`Epoch ${epoch + 1}: loss = ${logs?.loss?.toFixed(4)}, accuracy = ${logs?.acc?.toFixed(4)}`);
            }
          }
        });
      } else {
        console.warn('No model available for training');
      }

      // Clean up tensors
      if (xs && xs.dispose) xs.dispose();
      if (ys && ys.dispose) ys.dispose();

      // Save the updated model
      await this.saveModel();
      await this.databaseService.setLastTrainingDate(new Date());

      console.log('Model retraining completed');
    } catch (error) {
      console.error('Error during model retraining:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Prepare training data from user corrections and patterns
   */
  private async prepareTrainingData(): Promise<ModelTrainingData> {
    try {
      const corrections = await this.databaseService.getUserCorrections();
      const patterns = await this.databaseService.getLearningPatterns();

      const features: number[][] = [];
      const labels: string[] = [];

      // Process corrections
      for (const correction of corrections) {
        const feature = this.extractFeatures(correction.description, correction.merchantName);
        features.push(feature);
        labels.push(correction.correctedClassification);
      }

      // Process patterns
      for (const pattern of patterns) {
        const feature = this.extractFeatures(pattern.pattern);
        features.push(feature);
        labels.push(pattern.category);
      }

      return { features, labels };
    } catch (error) {
      console.error('Error preparing training data:', error);
      return { features: [], labels: [] };
    }
  }

  /**
   * Extract numerical features from text for ML model
   */
  private extractFeatures(description: string, merchantName?: string): number[] {
    const text = `${description} ${merchantName || ''}`.toLowerCase();
    const words = text.split(/\s+/).filter(word => word.length > 0);
    
    // Create feature vector (bag of words approach)
    const features = new Array(100).fill(0);
    
    words.forEach(word => {
      if (!this.vocabulary.has(word)) {
        this.vocabulary.set(word, this.vocabulary.size);
      }
      
      const index = this.vocabulary.get(word)! % 100;
      features[index] += 1;
    });

    // Normalize features
    const sum = features.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      return features.map(f => f / sum);
    }
    
    return features;
  }

  /**
   * Update model architecture if new categories are found
   */
  private async updateModelArchitecture(labels: string[]): Promise<void> {
    const uniqueLabels = Array.from(new Set(labels));
    
    if (uniqueLabels.length > this.categories.length) {
      this.categories = uniqueLabels;
      
      // Only rebuild if we have a valid model
      if (this.model && this.model.layers && this.model.layers.length > 0) {
        try {
          // Rebuild model with new output size
          const inputShape = (this.model.layers[0].getConfig().batchInputShape as number[])[1];
          
          this.model = tf.sequential({
            layers: [
              tf.layers.dense({
                inputShape: [inputShape],
                units: 64,
                activation: 'relu'
              }),
              tf.layers.dropout({ rate: 0.3 }),
              tf.layers.dense({
                units: 32,
                activation: 'relu'
              }),
              tf.layers.dropout({ rate: 0.2 }),
              tf.layers.dense({
                units: this.categories.length,
                activation: 'softmax'
              })
            ]
          });

          if (this.model) {
            this.model.compile({
              optimizer: tf.train.adam(0.001),
              loss: 'categoricalCrossentropy',
              metrics: ['accuracy']
            });
          }
        } catch (error) {
          console.warn('Failed to update model architecture:', error);
        }
      } else {
        // Create new model if none exists
        await this.createNewModel();
      }
    }
  }

  /**
   * Encode labels as one-hot vectors
   */
  private encodeLabels(labels: string[]): number[][] {
    return labels.map(label => {
      const encoded = new Array(this.categories.length).fill(0);
      const index = this.categories.indexOf(label);
      if (index >= 0) {
        encoded[index] = 1;
      }
      return encoded;
    });
  }

  /**
   * Save the model to IndexedDB
   */
  private async saveModel(): Promise<void> {
    if (!this.model) return;

    try {
      const modelData = await this.model.save(tf.io.withSaveHandler(async (artifacts) => ({ 
        modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' },
        ...artifacts 
      })));
      
      await this.databaseService.saveMLModel({
        modelData,
        vocabulary: Array.from(this.vocabulary.entries()),
        categories: this.categories,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.warn('Error saving model, continuing without persistence:', error);
    }
  }

  /**
   * Predict category for a transaction using the trained model
   */
  public async predictCategory(transaction: Transaction): Promise<{ category: string; confidence: number } | null> {
    if (!this.model || this.categories.length === 0) return null;

    try {
      const features = this.extractFeatures(transaction.description, transaction.merchantName);
      const prediction = this.model.predict(tf.tensor2d([features])) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Find the category with highest probability
      let maxIndex = 0;
      let maxProb = probabilities[0];
      
      for (let i = 1; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          maxIndex = i;
        }
      }

      prediction.dispose();

      if (maxProb > this.config.confidenceThreshold && maxIndex < this.categories.length) {
        return {
          category: this.categories[maxIndex],
          confidence: maxProb
        };
      }

      return null;
    } catch (error) {
      console.error('Error predicting category:', error);
      return null;
    }
  }

  /**
   * Get learning metrics and statistics
   */
  public async getLearningMetrics(): Promise<LearningMetrics> {
    try {
      const corrections = await this.databaseService.getUserCorrections();
      const patterns = await this.databaseService.getLearningPatterns();
      const rules = await this.databaseService.getUserRules();
      const lastTraining = await this.databaseService.getLastTrainingDate();

      return {
        totalCorrections: corrections.length,
        accuracyImprovement: this.calculateAccuracyImprovement(corrections),
        patternsLearned: patterns.length,
        rulesCreated: rules.filter(r => r.id.startsWith('auto_rule_')).length,
        lastTrainingDate: lastTraining || undefined
      };
    } catch (error) {
      console.error('Error getting learning metrics:', error);
      return {
        totalCorrections: 0,
        accuracyImprovement: 0,
        patternsLearned: 0,
        rulesCreated: 0
      };
    }
  }

  /**
   * Calculate accuracy improvement based on corrections
   */
  private calculateAccuracyImprovement(corrections: UserCorrection[]): number {
    if (corrections.length === 0) return 0;

    // Simple heuristic: assume each correction represents a 1% improvement
    // In a real system, this would be based on validation data
    return Math.min(corrections.length * 0.01, 0.5); // Cap at 50% improvement
  }

  /**
   * Calculate text similarity between two strings
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Find common words across multiple descriptions
   */
  private findCommonWords(descriptions: string[]): string[] {
    if (descriptions.length === 0) return [];

    const wordCounts = new Map<string, number>();
    
    descriptions.forEach(desc => {
      const words = desc.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      const uniqueWords = new Set(words);
      
      uniqueWords.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });
    });

    // Return words that appear in at least half of the descriptions
    const threshold = Math.ceil(descriptions.length / 2);
    return Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([word, _]) => word);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}