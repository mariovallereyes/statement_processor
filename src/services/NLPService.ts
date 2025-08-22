import * as natural from 'natural';
import { Transaction } from '../models/Transaction';

export interface MerchantAnalysis {
  merchantName: string;
  businessType: string;
  location?: string;
  confidence: number;
  extractedEntities: string[];
  semanticTokens: string[];
}

export interface LocationInfo {
  city?: string;
  state?: string;
  zipCode?: string;
  address?: string;
  confidence: number;
}

export interface ContextualInfo {
  transactionType: string;
  paymentMethod?: string;
  timeContext?: string;
  amountContext?: string;
  confidence: number;
}

export interface SemanticSimilarity {
  merchantName: string;
  similarity: number;
  matchedTokens: string[];
}

export class NLPService {
  private tokenizer: natural.WordTokenizer;
  private stemmer: typeof natural.PorterStemmer;
  private sentiment: typeof natural.SentimentAnalyzer;
  private tfidf: natural.TfIdf;
  private businessTypePatterns: Map<string, RegExp[]> = new Map();
  private locationPatterns: RegExp[] = [];
  private paymentMethodPatterns: Map<string, RegExp[]> = new Map();
  private knownMerchants: Map<string, MerchantAnalysis>;

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.sentiment = natural.SentimentAnalyzer;
    this.tfidf = new natural.TfIdf();
    this.knownMerchants = new Map();
    
    this.initializeBusinessTypePatterns();
    this.initializeLocationPatterns();
    this.initializePaymentMethodPatterns();
  }

  /**
   * Analyze transaction description using advanced NLP techniques
   */
  public analyzeTransactionDescription(transaction: Transaction): {
    merchantAnalysis: MerchantAnalysis;
    locationInfo: LocationInfo;
    contextualInfo: ContextualInfo;
  } {
    const description = transaction.description.toLowerCase();
    
    return {
      merchantAnalysis: this.analyzeMerchant(description),
      locationInfo: this.extractLocationInfo(description),
      contextualInfo: this.extractContextualInfo(description, transaction.amount)
    };
  }

  /**
   * Analyze merchant information from transaction description
   */
  private analyzeMerchant(description: string): MerchantAnalysis {
    // Clean and tokenize the description
    const cleanDescription = this.preprocessText(description);
    const tokens = this.tokenizer.tokenize(cleanDescription) || [];
    const stemmedTokens = tokens.map(token => this.stemmer.stem(token));

    // Extract potential merchant name
    const merchantName = this.extractMerchantName(description);
    
    // Determine business type
    const businessType = this.classifyBusinessType(description, tokens);
    
    // Extract entities (locations, numbers, etc.)
    const extractedEntities = this.extractEntities(description);
    
    // Calculate confidence based on various factors
    const confidence = this.calculateMerchantConfidence(merchantName, businessType, extractedEntities);

    return {
      merchantName,
      businessType,
      extractedEntities,
      semanticTokens: stemmedTokens,
      confidence
    };
  }

  /**
   * Extract location information from transaction description
   */
  private extractLocationInfo(description: string): LocationInfo {
    let confidence = 0;
    let city: string | undefined;
    let state: string | undefined;
    let zipCode: string | undefined;
    let address: string | undefined;

    // Extract ZIP code first
    const zipMatch = description.match(/\b\d{5}(-\d{4})?\b/);
    if (zipMatch) {
      zipCode = zipMatch[0];
      confidence += 0.3;
    }

    // Extract city and state together (prioritize this pattern)
    // Look for patterns like "SAN FRANCISCO CA" or "ANYTOWN CA 90210"
    const cityStateZipMatch = description.match(/([A-Z][A-Z\s]+?)\s+([A-Z]{2})\s+\d{5}/i);
    if (cityStateZipMatch && !['ST', 'RD', 'DR', 'LN', 'CT', 'AV'].includes(cityStateZipMatch[2].toUpperCase())) {
      city = cityStateZipMatch[1].trim().toUpperCase();
      state = cityStateZipMatch[2].toUpperCase();
      confidence += 0.5;
    } else {
      // Try simpler city state pattern
      const cityStateMatch = description.match(/([A-Z][A-Z\s]+?)\s+([A-Z]{2})\b/i);
      if (cityStateMatch && !['ST', 'RD', 'DR', 'LN', 'CT', 'AV'].includes(cityStateMatch[2].toUpperCase())) {
        city = cityStateMatch[1].trim().toUpperCase();
        state = cityStateMatch[2].toUpperCase();
        confidence += 0.4;
      } else {
        // Fallback: extract state abbreviations (case insensitive)
        const stateMatch = description.match(/\b([A-Z]{2})\b/i);
        if (stateMatch && !['ST', 'RD', 'DR', 'LN', 'CT', 'AV'].includes(stateMatch[1].toUpperCase())) {
          state = stateMatch[1].toUpperCase();
          confidence += 0.2;
        }
      }
    }

    // Extract street addresses (case insensitive)
    const addressMatch = description.match(/\d+\s+[A-Z][A-Z\s]+?\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct)\b/i);
    if (addressMatch) {
      address = addressMatch[0].toLowerCase();
      confidence += 0.3;
    }

    return {
      city,
      state,
      zipCode,
      address,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Extract contextual information from transaction
   */
  private extractContextualInfo(description: string, amount: number): ContextualInfo {
    let confidence = 0.5; // Base confidence
    
    // Determine transaction type
    const transactionType = this.classifyTransactionType(description, amount);
    confidence += 0.2;

    // Extract payment method
    const paymentMethod = this.extractPaymentMethod(description);
    if (paymentMethod) {
      confidence += 0.2;
    }

    // Extract time context
    const timeContext = this.extractTimeContext(description);
    if (timeContext) {
      confidence += 0.1;
    }

    // Analyze amount context
    const amountContext = this.analyzeAmountContext(amount, description);

    return {
      transactionType,
      paymentMethod,
      timeContext,
      amountContext,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Find semantically similar merchants
   */
  public findSimilarMerchants(merchantName: string, threshold: number = 0.7): SemanticSimilarity[] {
    const similarities: SemanticSimilarity[] = [];
    const targetTokens = this.tokenizer.tokenize(merchantName.toLowerCase()) || [];
    const targetStemmed = targetTokens.map(token => this.stemmer.stem(token));

    for (const [knownMerchant, analysis] of Array.from(this.knownMerchants.entries())) {
      if (knownMerchant === merchantName.toLowerCase()) continue;

      const similarity = this.calculateSemanticSimilarity(targetStemmed, analysis.semanticTokens);
      
      if (similarity >= threshold) {
        const matchedTokens = this.findMatchedTokens(targetStemmed, analysis.semanticTokens);
        similarities.push({
          merchantName: knownMerchant,
          similarity,
          matchedTokens
        });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Learn from merchant analysis to improve future classifications
   */
  public learnMerchant(merchantName: string, analysis: MerchantAnalysis): void {
    this.knownMerchants.set(merchantName.toLowerCase(), analysis);
    
    // Add to TF-IDF corpus for improved similarity matching
    this.tfidf.addDocument(analysis.semanticTokens);
  }

  /**
   * Preprocess text for better analysis
   */
  private preprocessText(text: string): string {
    return text
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Extract merchant name from description
   */
  private extractMerchantName(description: string): string {
    // Remove common prefixes and suffixes
    let merchantName = description
      .replace(/^(purchase\s+|payment\s+to\s+|debit\s+card\s+|credit\s+card\s+)/i, '')
      .replace(/(\s+\d{2}\/\d{2}|\s+#\d+|\s+\*+\d+).*$/i, '') // Remove dates and reference numbers
      .replace(/\s+[A-Z]{2}\s*\d{5}.*$/i, '') // Remove state and zip
      .trim();

    // Extract the main merchant name (usually the first few words)
    const words = merchantName.split(/\s+/);
    if (words.length > 3) {
      merchantName = words.slice(0, 3).join(' ');
    }

    return merchantName;
  }

  /**
   * Classify business type based on description patterns
   */
  private classifyBusinessType(description: string, tokens: string[]): string {
    for (const [businessType, patterns] of Array.from(this.businessTypePatterns.entries())) {
      for (const pattern of patterns) {
        if (pattern.test(description)) {
          return businessType;
        }
      }
    }

    // Fallback: analyze tokens for business indicators
    const businessIndicators = tokens.filter(token => 
      ['store', 'shop', 'market', 'restaurant', 'cafe', 'gas', 'station', 'bank', 'pharmacy'].includes(token)
    );

    if (businessIndicators.length > 0) {
      return businessIndicators[0];
    }

    return 'unknown';
  }

  /**
   * Extract entities like phone numbers, reference numbers, etc.
   */
  private extractEntities(description: string): string[] {
    const entities: string[] = [];

    // Phone numbers
    const phoneMatch = description.match(/\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g);
    if (phoneMatch) {
      entities.push(...phoneMatch.map(phone => `phone:${phone}`));
    }

    // Reference numbers (preserve original case but convert to lowercase for matching)
    const refMatch = description.match(/\b(?:ref|reference|conf|confirmation)[\s#:]*([a-z0-9]+)\b/gi);
    if (refMatch) {
      entities.push(...refMatch.map(ref => `reference:${ref.toLowerCase()}`));
    }

    // Card numbers (last 4 digits)
    const cardMatch = description.match(/\*+(\d{4})\b/g);
    if (cardMatch) {
      entities.push(...cardMatch.map(card => `card:${card}`));
    }

    return entities;
  }

  /**
   * Calculate confidence for merchant analysis
   */
  private calculateMerchantConfidence(merchantName: string, businessType: string, entities: string[]): number {
    let confidence = 0.1; // Lower base confidence

    // Boost confidence for clear merchant names
    if (merchantName.length > 3 && !merchantName.includes('unknown') && merchantName.trim() !== '') {
      confidence += 0.4;
    }

    // Boost confidence for recognized business types
    if (businessType !== 'unknown') {
      confidence += 0.3;
    }

    // Boost confidence for extracted entities
    confidence += Math.min(entities.length * 0.1, 0.2);

    return Math.min(confidence, 1.0);
  }

  /**
   * Classify transaction type based on description and amount
   */
  private classifyTransactionType(description: string, amount: number): string {
    if (amount > 0) {
      if (description.includes('deposit') || description.includes('transfer in')) {
        return 'deposit';
      }
      if (description.includes('refund') || description.includes('return')) {
        return 'refund';
      }
      return 'credit';
    } else {
      if (description.includes('withdrawal') || description.includes('atm')) {
        return 'withdrawal';
      }
      if (description.includes('fee') || description.includes('charge')) {
        return 'fee';
      }
      if (description.includes('payment') || description.includes('purchase')) {
        return 'purchase';
      }
      return 'debit';
    }
  }

  /**
   * Extract payment method from description
   */
  private extractPaymentMethod(description: string): string | undefined {
    for (const [method, patterns] of Array.from(this.paymentMethodPatterns.entries())) {
      for (const pattern of patterns) {
        if (pattern.test(description)) {
          return method;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract time context from description
   */
  private extractTimeContext(description: string): string | undefined {
    const timePatterns = [
      { pattern: /\b\d{1,2}:\d{2}\s*(am|pm)\b/i, type: 'time' },
      { pattern: /\b(morning|afternoon|evening|night)\b/i, type: 'time_of_day' },
      { pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, type: 'day_of_week' }
    ];

    for (const { pattern, type } of timePatterns) {
      const match = description.match(pattern);
      if (match) {
        return `${type}:${match[0]}`;
      }
    }

    return undefined;
  }

  /**
   * Analyze amount context
   */
  private analyzeAmountContext(amount: number, description: string): string {
    const absAmount = Math.abs(amount);
    
    if (absAmount < 10) {
      return 'small_amount';
    } else if (absAmount < 100) {
      return 'medium_amount';
    } else if (absAmount < 1000) {
      return 'large_amount';
    } else {
      return 'very_large_amount';
    }
  }

  /**
   * Calculate semantic similarity between token sets
   */
  private calculateSemanticSimilarity(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0;
    }

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);

    // Jaccard similarity
    const jaccardSimilarity = intersection.size / union.size;

    // Also consider partial matches (substring matching)
    let partialMatches = 0;
    for (const token1 of tokens1) {
      for (const token2 of tokens2) {
        if (token1.includes(token2) || token2.includes(token1)) {
          partialMatches++;
          break;
        }
      }
    }
    const partialSimilarity = partialMatches / Math.max(tokens1.length, tokens2.length);

    // Also consider token order similarity (simple approach)
    let orderSimilarity = 0;
    const minLength = Math.min(tokens1.length, tokens2.length);
    for (let i = 0; i < minLength; i++) {
      if (tokens1[i] === tokens2[i]) {
        orderSimilarity += 1 / minLength;
      }
    }

    // Weighted combination
    return (jaccardSimilarity * 0.5) + (partialSimilarity * 0.3) + (orderSimilarity * 0.2);
  }

  /**
   * Find matched tokens between two token sets
   */
  private findMatchedTokens(tokens1: string[], tokens2: string[]): string[] {
    const set2 = new Set(tokens2);
    return tokens1.filter(token => set2.has(token));
  }

  /**
   * Initialize business type patterns
   */
  private initializeBusinessTypePatterns(): void {
    this.businessTypePatterns = new Map([
      ['grocery', [
        /\b(grocery|supermarket|market|food|kroger|safeway|walmart|target)\b/i,
        /\b(whole foods|trader joe|costco|sam's club)\b/i
      ]],
      ['gas_station', [
        /\b(gas|fuel|station|shell|exxon|bp|chevron|mobil|texaco|arco|citgo)\b/i
      ]],
      ['restaurant', [
        /\b(restaurant|cafe|diner|pizza|mcdonald|burger|subway|starbucks)\b/i,
        /\b(dining|food|eat|kitchen|grill|bistro)\b/i
      ]],
      ['retail', [
        /\b(store|shop|retail|amazon|ebay|best buy|home depot|lowes)\b/i,
        /\b(mall|outlet|department)\b/i
      ]],
      ['pharmacy', [
        /\b(pharmacy|cvs|walgreens|rite aid|drug|medical)\b/i
      ]],
      ['bank', [
        /\b(bank|atm|credit union|financial|chase|wells fargo|citi)\b/i
      ]],
      ['utility', [
        /\b(electric|power|gas|water|sewer|utility|pge|edison)\b/i,
        /\b(internet|phone|cable|wireless|verizon|at&t|comcast)\b/i
      ]],
      ['entertainment', [
        /\b(movie|theater|cinema|netflix|spotify|hulu|disney|entertainment)\b/i,
        /\b(streaming|subscription|music|video|game)\b/i
      ]],
      ['healthcare', [
        /\b(hospital|clinic|doctor|medical|health|dentist|vision)\b/i
      ]],
      ['transportation', [
        /\b(uber|lyft|taxi|bus|train|airline|parking|toll)\b/i
      ]]
    ]);
  }

  /**
   * Initialize location patterns
   */
  private initializeLocationPatterns(): void {
    this.locationPatterns = [
      /\b[A-Z][a-z]+\s+[A-Z]{2}\s+\d{5}\b/, // City State ZIP
      /\b\d+\s+[A-Z][a-z]+\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct)\b/i, // Street address
      /\b[A-Z]{2}\s+\d{5}\b/ // State ZIP
    ];
  }

  /**
   * Initialize payment method patterns
   */
  private initializePaymentMethodPatterns(): void {
    this.paymentMethodPatterns = new Map([
      ['debit_card', [
        /\bdebit\s+card\b/i,
        /\bcard\s+purchase\b/i,
        /\*+\d{4}\b/
      ]],
      ['credit_card', [
        /\bcredit\s+card\b/i,
        /\bvisa\b/i,
        /\bmastercard\b/i,
        /\bamex\b/i,
        /\bdiscover\b/i
      ]],
      ['ach', [
        /\bach\s+transfer\b/i,
        /\belectronic\s+transfer\b/i,
        /\bdirect\s+deposit\b/i
      ]],
      ['check', [
        /\bcheck\s+#?\d+\b/i,
        /\bpaper\s+check\b/i
      ]],
      ['atm', [
        /\batm\s+withdrawal\b/i,
        /\bcash\s+withdrawal\b/i
      ]],
      ['online', [
        /\bonline\s+payment\b/i,
        /\bweb\s+payment\b/i,
        /\binternet\s+banking\b/i
      ]]
    ]);
  }
}