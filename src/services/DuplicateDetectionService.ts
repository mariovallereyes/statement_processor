import { Transaction } from '../models/Transaction';

export interface DuplicateGroup {
    id: string;
    transactions: Transaction[];
    similarityScore: number;
    duplicateType: 'exact' | 'likely' | 'possible';
    reason: string[];
}

export interface DuplicateDetectionResult {
    duplicateGroups: DuplicateGroup[];
    totalDuplicates: number;
    suggestions: DuplicateResolutionSuggestion[];
}

export interface DuplicateResolutionSuggestion {
    groupId: string;
    action: 'auto-remove' | 'flag-for-review' | 'merge' | 'keep-all';
    confidence: number;
    reasoning: string;
}

export interface DuplicateDetectionSettings {
    dateToleranceDays: number;
    amountTolerancePercent: number;
    descriptionSimilarityThreshold: number;
    exactMatchThreshold: number;
    likelyMatchThreshold: number;
    possibleMatchThreshold: number;
    enableAutoRemoval: boolean;
    autoRemovalConfidenceThreshold: number;
}

export class DuplicateDetectionService {
    private settings: DuplicateDetectionSettings;

    constructor(settings?: Partial<DuplicateDetectionSettings>) {
        this.settings = {
            dateToleranceDays: 1,
            amountTolerancePercent: 0.01, // 1%
            descriptionSimilarityThreshold: 0.8,
            exactMatchThreshold: 0.98,
            likelyMatchThreshold: 0.85,
            possibleMatchThreshold: 0.7,
            enableAutoRemoval: false,
            autoRemovalConfidenceThreshold: 0.98,
            ...settings
        };
    }

    /**
     * Detect duplicate transactions in a list
     */
    detectDuplicates(transactions: Transaction[]): DuplicateDetectionResult {
        const duplicateGroups: DuplicateGroup[] = [];
        const processedTransactions = new Set<string>();

        for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];

            if (processedTransactions.has(transaction.id)) {
                continue;
            }

            const similarTransactions = this.findSimilarTransactions(
                transaction,
                transactions.slice(i + 1)
            );

            if (similarTransactions.length > 0) {
                const group = this.createDuplicateGroup([transaction, ...similarTransactions]);
                duplicateGroups.push(group);

                // Mark all transactions in this group as processed
                [transaction, ...similarTransactions].forEach(t =>
                    processedTransactions.add(t.id)
                );
            }
        }

        const suggestions = this.generateResolutionSuggestions(duplicateGroups);

        return {
            duplicateGroups,
            totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.transactions.length, 0),
            suggestions
        };
    }

    /**
     * Find transactions similar to the given transaction
     */
    private findSimilarTransactions(
        target: Transaction,
        candidates: Transaction[]
    ): Transaction[] {
        return candidates.filter(candidate => {
            const similarity = this.calculateSimilarity(target, candidate);
            return similarity >= this.settings.possibleMatchThreshold;
        });
    }

    /**
     * Calculate similarity score between two transactions
     */
    calculateSimilarity(t1: Transaction, t2: Transaction): number {
        const dateSimilarity = this.calculateDateSimilarity(t1.date, t2.date);
        const amountSimilarity = this.calculateAmountSimilarity(t1.amount, t2.amount);
        const descriptionSimilarity = this.calculateDescriptionSimilarity(
            t1.description,
            t2.description
        );
        const typeSimilarity = t1.type === t2.type ? 1 : 0;

        // Weighted average of similarity scores
        const weights = {
            date: 0.2,
            amount: 0.3,
            description: 0.4,
            type: 0.1
        };

        return (
            dateSimilarity * weights.date +
            amountSimilarity * weights.amount +
            descriptionSimilarity * weights.description +
            typeSimilarity * weights.type
        );
    }

    /**
     * Calculate date similarity (1.0 for same date, decreasing with distance)
     */
    private calculateDateSimilarity(date1: Date, date2: Date): number {
        const daysDiff = Math.abs(
            (date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 0) return 1.0;
        if (daysDiff <= this.settings.dateToleranceDays) return 0.9;
        if (daysDiff <= 7) return 0.6;
        if (daysDiff <= 30) return 0.2;
        return 0.0;
    }

    /**
     * Calculate amount similarity (1.0 for exact match, decreasing with difference)
     */
    private calculateAmountSimilarity(amount1: number, amount2: number): number {
        if (amount1 === amount2) return 1.0;

        const percentDiff = Math.abs(amount1 - amount2) / Math.max(Math.abs(amount1), Math.abs(amount2));

        if (percentDiff <= this.settings.amountTolerancePercent) return 0.95;
        if (percentDiff <= 0.05) return 0.8;
        if (percentDiff <= 0.1) return 0.6;
        if (percentDiff <= 0.2) return 0.3;
        return 0.0;
    }

    /**
     * Calculate description similarity using Levenshtein distance and common words
     */
    private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
        if (desc1 === desc2) return 1.0;

        const normalized1 = this.normalizeDescription(desc1);
        const normalized2 = this.normalizeDescription(desc2);

        if (normalized1 === normalized2) return 0.95;

        // Calculate Levenshtein distance
        const levenshteinSimilarity = this.calculateLevenshteinSimilarity(normalized1, normalized2);

        // Calculate word overlap
        const wordSimilarity = this.calculateWordSimilarity(normalized1, normalized2);

        // Return the higher of the two similarities
        return Math.max(levenshteinSimilarity, wordSimilarity);
    }

    /**
     * Normalize description for comparison
     */
    private normalizeDescription(description: string): string {
        return description
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculate similarity using Levenshtein distance
     */
    private calculateLevenshteinSimilarity(str1: string, str2: string): number {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return maxLength === 0 ? 1 : 1 - distance / maxLength;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Calculate similarity based on word overlap
     */
    private calculateWordSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.split(' ').filter(word => word.length > 2));
        const words2 = new Set(str2.split(' ').filter(word => word.length > 2));

        if (words1.size === 0 && words2.size === 0) return 1.0;
        if (words1.size === 0 || words2.size === 0) return 0.0;

        const intersection = new Set(Array.from(words1).filter(word => words2.has(word)));
        const union = new Set([...Array.from(words1), ...Array.from(words2)]);

        return intersection.size / union.size;
    }

    /**
     * Create a duplicate group from similar transactions
     */
    private createDuplicateGroup(transactions: Transaction[]): DuplicateGroup {
        const similarities = [];

        for (let i = 0; i < transactions.length - 1; i++) {
            for (let j = i + 1; j < transactions.length; j++) {
                similarities.push(this.calculateSimilarity(transactions[i], transactions[j]));
            }
        }

        const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

        let duplicateType: 'exact' | 'likely' | 'possible';
        if (avgSimilarity >= this.settings.exactMatchThreshold) {
            duplicateType = 'exact';
        } else if (avgSimilarity >= this.settings.likelyMatchThreshold) {
            duplicateType = 'likely';
        } else {
            duplicateType = 'possible';
        }

        const reasons = this.generateDuplicateReasons(transactions);

        return {
            id: `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            transactions,
            similarityScore: avgSimilarity,
            duplicateType,
            reason: reasons
        };
    }

    /**
     * Generate reasons why transactions are considered duplicates
     */
    private generateDuplicateReasons(transactions: Transaction[]): string[] {
        const reasons: string[] = [];

        if (transactions.length < 2) return reasons;

        const first = transactions[0];
        const others = transactions.slice(1);

        // Check for exact amount matches
        if (others.every(t => t.amount === first.amount)) {
            reasons.push('Identical amounts');
        }

        // Check for same date
        if (others.every(t => t.date.getTime() === first.date.getTime())) {
            reasons.push('Same transaction date');
        }

        // Check for similar descriptions
        const descSimilarities = others.map(t =>
            this.calculateDescriptionSimilarity(first.description, t.description)
        );
        if (descSimilarities.every(sim => sim > 0.8)) {
            reasons.push('Very similar descriptions');
        }

        // Check for same merchant
        if (first.merchantName && others.every(t => t.merchantName === first.merchantName)) {
            reasons.push('Same merchant');
        }

        // Check for same reference number
        if (first.referenceNumber && others.every(t => t.referenceNumber === first.referenceNumber)) {
            reasons.push('Same reference number');
        }

        return reasons;
    }

    /**
     * Generate resolution suggestions for duplicate groups
     */
    private generateResolutionSuggestions(groups: DuplicateGroup[]): DuplicateResolutionSuggestion[] {
        return groups.map(group => {
            let action: DuplicateResolutionSuggestion['action'];
            let confidence: number;
            let reasoning: string;

            if (this.settings.enableAutoRemoval &&
                group.duplicateType === 'exact' &&
                group.similarityScore >= this.settings.autoRemovalConfidenceThreshold) {
                action = 'auto-remove';
                confidence = group.similarityScore;
                reasoning = 'Transactions are nearly identical and can be safely auto-removed';
            } else if (group.duplicateType === 'exact' || group.duplicateType === 'likely') {
                action = 'flag-for-review';
                confidence = group.similarityScore;
                reasoning = 'High similarity detected, manual review recommended';
            } else {
                action = 'flag-for-review';
                confidence = group.similarityScore;
                reasoning = 'Possible duplicates detected, review to confirm';
            }

            return {
                groupId: group.id,
                action,
                confidence,
                reasoning
            };
        });
    }

    /**
     * Update detection settings
     */
    updateSettings(newSettings: Partial<DuplicateDetectionSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
    }

    /**
     * Get current settings
     */
    getSettings(): DuplicateDetectionSettings {
        return { ...this.settings };
    }
}