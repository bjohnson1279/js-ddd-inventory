import { CreatePurchaseOrder } from '../../../src/application/useCases/CreatePurchaseOrder';
import { PurchaseOrderStatus } from '../../../src/domain/procurement/enums/PurchaseOrderStatus';

describe('CreatePurchaseOrder Interception', () => {
  let poRepoMock: any;
  let wfServiceMock: any;

  beforeEach(() => {
    poRepoMock = {
      findByNumber: jest.fn().mockResolvedValue(null),
      save: jest.fn()
    };
    wfServiceMock = {
      evaluateAndIntercept: jest.fn()
    };
  });

  const dto = {
    purchaseOrderNumber: 'PO-1',
    vendorId: 'v1',
    tenantId: 't1',
    locationId: 'l1',
    items: [{ variantId: 'v1', quantity: 10, unitCostCents: 100 }]
  };

  it('PO creation proceeds normally without approval service', async () => {
    const useCase = new CreatePurchaseOrder(poRepoMock);
    const po = await useCase.execute(dto);
    expect(po.status).toBe(PurchaseOrderStatus.Draft);
    expect(poRepoMock.save).toHaveBeenCalledWith(po);
  });

  it('PO creation proceeds when not intercepted', async () => {
    wfServiceMock.evaluateAndIntercept.mockResolvedValue({ intercepted: false });
    const useCase = new CreatePurchaseOrder(poRepoMock, wfServiceMock);
    const po = await useCase.execute(dto);
    expect(po.status).toBe(PurchaseOrderStatus.Draft);
    expect(poRepoMock.save).toHaveBeenCalledWith(po);
  });

  it('PO returns PENDING_APPROVAL when intercepted', async () => {
    wfServiceMock.evaluateAndIntercept.mockResolvedValue({ intercepted: true, requestId: 'req1' });
    const useCase = new CreatePurchaseOrder(poRepoMock, wfServiceMock);
    const po = await useCase.execute(dto);
    expect(po.status).toBe(PurchaseOrderStatus.PendingApproval);
    expect(poRepoMock.save).toHaveBeenCalledWith(po);
  });

  it('PO status is PendingApproval when intercepted', async () => {
    wfServiceMock.evaluateAndIntercept.mockResolvedValue({ intercepted: true, requestId: 'req1' });
    const useCase = new CreatePurchaseOrder(poRepoMock, wfServiceMock);
    const po = await useCase.execute(dto);
    expect(po.status).toBe('PENDING_APPROVAL');
  });
});
