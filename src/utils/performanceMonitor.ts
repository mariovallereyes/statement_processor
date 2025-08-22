/**
 * Performance Monitoring Utilities
 * Tracks application performance metrics and provides optimization insights
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'loading' | 'runtime' | 'memory' | 'ai' | 'user';
}

interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    totalLoadTime: number;
    aiProcessingTime: number;
    memoryUsage: number;
    cacheHitRate: number;
  };
  recommendations: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private startTimes: Map<string, number> = new Map();

  constructor() {
    this.initializeObservers();
    this.trackWebVitals();
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers(): void {
    if (typeof window === 'undefined') return;

    // Observe navigation timing
    if ('PerformanceObserver' in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              name: entry.name,
              value: entry.duration,
              timestamp: Date.now(),
              category: 'loading'
            });
          }
        });
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);

        // Observe resource timing
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name.includes('model') || entry.name.includes('tfjs') || entry.name.includes('tesseract')) {
              this.recordMetric({
                name: `ai-resource-${entry.name.split('/').pop()}`,
                value: entry.duration,
                timestamp: Date.now(),
                category: 'ai'
              });
            }
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);

        // Observe long tasks
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              name: 'long-task',
              value: entry.duration,
              timestamp: Date.now(),
              category: 'runtime'
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('Performance observers not fully supported:', error);
      }
    }
  }

  /**
   * Track Core Web Vitals
   */
  private trackWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Track Largest Contentful Paint (LCP)
    this.trackLCP();
    
    // Track First Input Delay (FID)
    this.trackFID();
    
    // Track Cumulative Layout Shift (CLS)
    this.trackCLS();
  }

  private trackLCP(): void {
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric({
            name: 'largest-contentful-paint',
            value: lastEntry.startTime,
            timestamp: Date.now(),
            category: 'loading'
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (error) {
        console.warn('LCP tracking not supported:', error);
      }
    }
  }

  private trackFID(): void {
    if ('PerformanceObserver' in window) {
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              name: 'first-input-delay',
              value: (entry as any).processingStart - entry.startTime,
              timestamp: Date.now(),
              category: 'user'
            });
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (error) {
        console.warn('FID tracking not supported:', error);
      }
    }
  }

  private trackCLS(): void {
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.recordMetric({
            name: 'cumulative-layout-shift',
            value: clsValue,
            timestamp: Date.now(),
            category: 'user'
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (error) {
        console.warn('CLS tracking not supported:', error);
      }
    }
  }

  /**
   * Start timing a custom operation
   */
  startTiming(operationName: string): void {
    this.startTimes.set(operationName, performance.now());
  }

  /**
   * End timing a custom operation
   */
  endTiming(operationName: string, category: PerformanceMetric['category'] = 'runtime'): void {
    const startTime = this.startTimes.get(operationName);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.recordMetric({
        name: operationName,
        value: duration,
        timestamp: Date.now(),
        category
      });
      this.startTimes.delete(operationName);
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.recordMetric({
        name: 'memory-used-js-heap',
        value: memory.usedJSHeapSize,
        timestamp: Date.now(),
        category: 'memory'
      });
      this.recordMetric({
        name: 'memory-total-js-heap',
        value: memory.totalJSHeapSize,
        timestamp: Date.now(),
        category: 'memory'
      });
      this.recordMetric({
        name: 'memory-js-heap-limit',
        value: memory.jsHeapSizeLimit,
        timestamp: Date.now(),
        category: 'memory'
      });
    }
  }

  /**
   * Track AI model performance
   */
  trackAIOperation(operationName: string, duration: number, accuracy?: number): void {
    this.recordMetric({
      name: `ai-${operationName}-duration`,
      value: duration,
      timestamp: Date.now(),
      category: 'ai'
    });

    if (accuracy !== undefined) {
      this.recordMetric({
        name: `ai-${operationName}-accuracy`,
        value: accuracy,
        timestamp: Date.now(),
        category: 'ai'
      });
    }
  }

  /**
   * Track cache performance
   */
  trackCacheHit(cacheType: string, hit: boolean): void {
    this.recordMetric({
      name: `cache-${cacheType}-${hit ? 'hit' : 'miss'}`,
      value: hit ? 1 : 0,
      timestamp: Date.now(),
      category: 'runtime'
    });
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 300000); // Last 5 minutes

    const loadingMetrics = recentMetrics.filter(m => m.category === 'loading');
    const aiMetrics = recentMetrics.filter(m => m.category === 'ai');
    const memoryMetrics = recentMetrics.filter(m => m.category === 'memory');
    const cacheMetrics = recentMetrics.filter(m => m.name.includes('cache'));

    // Calculate summary
    const totalLoadTime = loadingMetrics.reduce((sum, m) => sum + m.value, 0);
    const aiProcessingTime = aiMetrics
      .filter(m => m.name.includes('duration'))
      .reduce((sum, m) => sum + m.value, 0);
    
    const latestMemoryUsage = memoryMetrics
      .filter(m => m.name === 'memory-used-js-heap')
      .sort((a, b) => b.timestamp - a.timestamp)[0]?.value || 0;

    const cacheHits = cacheMetrics.filter(m => m.name.includes('hit')).length;
    const cacheMisses = cacheMetrics.filter(m => m.name.includes('miss')).length;
    const cacheHitRate = cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(recentMetrics);

    return {
      metrics: recentMetrics,
      summary: {
        totalLoadTime,
        aiProcessingTime,
        memoryUsage: latestMemoryUsage,
        cacheHitRate
      },
      recommendations
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    // Check loading performance
    const lcp = metrics.find(m => m.name === 'largest-contentful-paint');
    if (lcp && lcp.value > 2500) {
      recommendations.push('Consider optimizing images and reducing bundle size to improve loading performance');
    }

    // Check AI performance
    const aiDurations = metrics.filter(m => m.name.includes('ai-') && m.name.includes('duration'));
    const avgAIDuration = aiDurations.reduce((sum, m) => sum + m.value, 0) / aiDurations.length;
    if (avgAIDuration > 5000) {
      recommendations.push('AI processing is slow. Consider model optimization or progressive loading');
    }

    // Check memory usage
    const memoryUsage = metrics.filter(m => m.name === 'memory-used-js-heap');
    const latestMemory = memoryUsage.sort((a, b) => b.timestamp - a.timestamp)[0];
    if (latestMemory && latestMemory.value > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected. Consider implementing memory cleanup strategies');
    }

    // Check long tasks
    const longTasks = metrics.filter(m => m.name === 'long-task');
    if (longTasks.length > 5) {
      recommendations.push('Multiple long tasks detected. Consider breaking up heavy operations');
    }

    // Check cache performance
    const cacheHits = metrics.filter(m => m.name.includes('cache-') && m.name.includes('hit')).length;
    const cacheMisses = metrics.filter(m => m.name.includes('cache-') && m.name.includes('miss')).length;
    const hitRate = cacheHits / (cacheHits + cacheMisses);
    if (hitRate < 0.7) {
      recommendations.push('Low cache hit rate. Review caching strategy for better performance');
    }

    return recommendations;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      metrics: this.metrics,
      report: this.generateReport()
    }, null, 2);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.startTimes.clear();
  }

  /**
   * Cleanup observers
   */
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.clearMetrics();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export utilities for manual tracking
export const trackOperation = (name: string, operation: () => Promise<any>, category: PerformanceMetric['category'] = 'runtime') => {
  return async (...args: any[]) => {
    performanceMonitor.startTiming(name);
    try {
      const result = await operation();
      return result;
    } finally {
      performanceMonitor.endTiming(name, category);
    }
  };
};

export const withPerformanceTracking = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string,
  category: PerformanceMetric['category'] = 'runtime'
): T => {
  return (async (...args: any[]) => {
    performanceMonitor.startTiming(operationName);
    try {
      const result = await fn(...args);
      return result;
    } finally {
      performanceMonitor.endTiming(operationName, category);
    }
  }) as T;
};

export default performanceMonitor;