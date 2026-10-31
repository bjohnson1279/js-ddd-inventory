import { InspectionId } from './valueObjects/InspectionId';

export enum InspectionStatus {
  PENDING = 'PENDING',
  ANALYZED = 'ANALYZED',
  FLAGGED = 'FLAGGED',
  PASSED = 'PASSED'
}

export enum DimensionUnit {
  CM = 'CM',
  INCH = 'INCH'
}

export interface VolumeDimensions {
  length: number;
  width: number;
  height: number;
  unit: DimensionUnit;
}

export interface InspectionResult {
  inspectionId: InspectionId | string;
  detectedBarcode: string;
  dimensions: VolumeDimensions;
  damageScore: number;
  anomaliesDetected: string[];
}

export class VisionInspection {
  public readonly inspectionId: InspectionId;

  constructor(
    inspectionId: InspectionId | string,
    public tenantId: string,
    public dockStationId: string,
    public capturedAt: Date,
    public imageUrl: string,
    public status: InspectionStatus = InspectionStatus.PENDING
  ) {
    this.inspectionId = typeof inspectionId === 'string'
      ? InspectionId.create(inspectionId)
      : (inspectionId || InspectionId.create());
  }

  public passInspection(): void {
    if (this.status !== InspectionStatus.PENDING && this.status !== InspectionStatus.ANALYZED) {
      throw new Error("Invalid status transition to PASSED");
    }
    this.status = InspectionStatus.PASSED;
  }

  public flagInspection(): void {
    if (this.status !== InspectionStatus.PENDING && this.status !== InspectionStatus.ANALYZED) {
      throw new Error("Invalid status transition to FLAGGED");
    }
    this.status = InspectionStatus.FLAGGED;
  }
}
