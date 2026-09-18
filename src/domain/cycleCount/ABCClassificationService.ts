import { CycleCount } from './CycleCount';

export class ABCClassificationService {
  public classifySku(sku: string, annualUsageValue: number): 'A' | 'B' | 'C';
  public classifySku(
    totalUsageValue: number,
    totalOrgValue: number,
    thresholds?: { aThreshold: number; bThreshold: number }
  ): 'A' | 'B' | 'C';
  public classifySku(
    first: string | number,
    second: number,
    third?: { aThreshold: number; bThreshold: number }
  ): 'A' | 'B' | 'C' {
    if (typeof first === 'string') {
      if (second >= 10000) return 'A';
      if (second >= 1000) return 'B';
      return 'C';
    }
    const totalUsageValue = first;
    const totalOrgValue = second;
    const thresholds = third || { aThreshold: 0.90, bThreshold: 0.70 };
    if (totalOrgValue === 0) return 'C';
    const ratio = totalUsageValue / totalOrgValue;
    if (ratio >= thresholds.aThreshold) return 'A';
    if (ratio >= thresholds.bThreshold) return 'B';
    return 'C';
  }

  public getRecommendedFrequency(abcClass: 'A' | 'B' | 'C'): number {
    switch (abcClass) {
      case 'A': return 30; // days
      case 'B': return 90;
      case 'C': return 180;
    }
  }
}
