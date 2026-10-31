import { VisionInspection, InspectionStatus } from '../../../src/domain/vision/VisionEntities';
import { ComputerVisionService, QaGatewayService } from '../../../src/domain/vision/VisionServices';
import { InspectionId } from '../../../src/domain/vision/valueObjects/InspectionId';

describe('Vision Services', () => {
  it('QaGatewayService passes good image', () => {
    const cvService = new ComputerVisionService();
    const qaService = new QaGatewayService();

    const inspection = new VisionInspection(
      "INS1", "T1", "DOCK1", new Date(), "http://storage.com/image.jpg"
    );

    expect(inspection.inspectionId).toBeInstanceOf(InspectionId);
    expect(inspection.inspectionId.getValue()).toBe("INS1");

    const result = cvService.analyzeImage(inspection.imageUrl, inspection.inspectionId);
    qaService.processInspection(inspection, result);

    expect(inspection.status).toBe(InspectionStatus.PASSED);
    expect(result.damageScore).toBe(0.05);
    expect(result.inspectionId).toBe(inspection.inspectionId);
  });

  it('QaGatewayService flags damaged image', () => {
    const cvService = new ComputerVisionService();
    const qaService = new QaGatewayService();

    const inspectionIdObj = InspectionId.create("INS2");
    const inspection = new VisionInspection(
      inspectionIdObj, "T1", "DOCK1", new Date(), "http://storage.com/damaged_box.jpg"
    );

    expect(inspection.inspectionId.equals(inspectionIdObj)).toBe(true);

    const result = cvService.analyzeImage(inspection.imageUrl, inspection.inspectionId);
    qaService.processInspection(inspection, result, 0.5);

    expect(inspection.status).toBe(InspectionStatus.FLAGGED);
    expect(result.damageScore).toBe(0.85);
    expect(result.anomaliesDetected).toContain("CRUSHED_CORNER");
  });
});
