import { CreatePurchaseOrder, CreatePurchaseOrderDTO } from '../../../src/application/useCases/CreatePurchaseOrder';
import { IPurchaseOrderRepository } from '../../../src/domain/repositories/IPurchaseOrderRepository';
import { ApprovalWorkflowService } from '../../../src/domain/approval/ApprovalWorkflowService';
import { PurchaseOrderStatus } from '../../../src/domain/procurement/enums/PurchaseOrderStatus';

describe('CreatePurchaseOrder Interception', () => {
  let mockPoRepo: jest.Mocked<IPurchaseOrderRepository>;
  let mockApprovalService: jest.Mocked<ApprovalWorkflowService>;
  
  const dto: CreatePurchaseOrderDTO = {
    purchaseOrderNumber: 'PO-123',
    vendorId: 'v-1',
    tenantId: 't-1',
    locationId: 'l-1',
    requesterId: 'req-1',
    items: [{ variantId: 'var-1', quantity: 10, unitCostCents: 100 }]
  };

  beforeEach(() => {
    mockPoRepo = {
      save: jest.fn(),
      findByNumber: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IPurchaseOrderRepository>;

    mockApprovalService = {
      evaluateAndIntercept: jest.fn(),
    } as unknown as jest.Mocked<ApprovalWorkflowService>;
  });

  it('PO creation proceeds normally when no approval service provided', async () => {
    const useCase = new CreatePurchaseOrder(mockPoRepo);
    const result = await useCase.execute(dto);
    
    expect(mockPoRepo.save).toHaveBeenCalled();
    expect(result.status).toBe(PurchaseOrderStatus.Draft);
    expect(result.purchaseOrderNumber).toBe('PO-123');
  });

  it('PO creation proceeds when approval service returns { intercepted: false }', async () => {
    mockApprovalService.evaluateAndIntercept.mockResolvedValue({ intercepted: false });
    const useCase = new CreatePurchaseOrder(mockPoRepo, mockApprovalService);
    
    const result = await useCase.execute(dto);
    
    expect(mockApprovalService.evaluateAndIntercept).toHaveBeenCalledWith(
      't-1', 'purchase_order.place', 'PurchaseOrder', expect.any(String), 'req-1', { totalValueCents: 1000 }
    );
    expect(mockPoRepo.save).toHaveBeenCalled();
    expect(result.status).toBe(PurchaseOrderStatus.Draft);
  });

  it('PO creation returns PENDING_APPROVAL when intercepted', async () => {
    mockApprovalService.evaluateAndIntercept.mockResolvedValue({ intercepted: true, requestId: 'req-id-1' });
    const useCase = new CreatePurchaseOrder(mockPoRepo, mockApprovalService);
    
    const result = await useCase.execute(dto);
    
    expect(mockApprovalService.evaluateAndIntercept).toHaveBeenCalled();
    expect(mockPoRepo.save).toHaveBeenCalled();
    expect(result).toHaveProperty('status', 'PENDING_APPROVAL');
    expect(result).toHaveProperty('requestId', 'req-id-1');
  });

  it('PO status is PendingApproval when intercepted', async () => {
    mockApprovalService.evaluateAndIntercept.mockResolvedValue({ intercepted: true, requestId: 'req-id-1' });
    const useCase = new CreatePurchaseOrder(mockPoRepo, mockApprovalService);
    
    const result = await useCase.execute(dto);
    
    expect(mockPoRepo.save).toHaveBeenCalled();
    // The returned object from intercepted has { status: 'PENDING_APPROVAL', purchaseOrder: po }
    expect(result.purchaseOrder.status).toBe(PurchaseOrderStatus.PendingApproval);
  });
});
