export const calculateOverallConfidence = (scores: number[]): number => {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

export const isHighConfidence = (confidence: number): boolean => {
  return confidence >= 0.85;
};

export const isMediumConfidence = (confidence: number): boolean => {
  return confidence >= 0.6 && confidence < 0.85;
};

export const isLowConfidence = (confidence: number): boolean => {
  return confidence < 0.6;
};