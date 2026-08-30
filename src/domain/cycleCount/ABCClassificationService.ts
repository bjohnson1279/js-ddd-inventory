import { CycleCount } from './CycleCount';

export class ABCClassificationService {
  public classifySku(sku: string, annualUsageValue: number): 'A' | 'B' | 'C' {
    if (annualUsageValue > 10000) return 'A';
    if (annualUsageValue > 1000) return 'B';
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
