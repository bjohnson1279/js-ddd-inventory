process.env.JWT_SECRET = 'test-secret';
import { requirePermission, AuthenticatedRequest } from '../../../../src/infrastructure/http/middleware/auth';
import { Response, NextFunction } from 'express';

describe('requirePermission Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-1',
        role: 'admin',
        roles: ['admin'],
        permissions: [],
        tenantId: 'tenant-1'
      },
      body: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  it('should allow access if user has exact permission', () => {
    mockRequest.user!.permissions = ['purchase_order:place'];

    const middleware = requirePermission('purchase_order', 'place');
    middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow access with wildcard resource:*', () => {
    mockRequest.user!.permissions = ['purchase_order:*'];

    const middleware = requirePermission('purchase_order', 'place');
    middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should allow access with wildcard *:*', () => {
    mockRequest.user!.permissions = ['*:*'];

    const middleware = requirePermission('purchase_order', 'place');
    middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should block access if permission is missing', () => {
    mockRequest.user!.permissions = ['inventory:view'];

    const middleware = requirePermission('purchase_order', 'place');
    middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Missing permission") })
    );
  });

  it('should block access on tenant mismatch', () => {
    mockRequest.user!.permissions = ['purchase_order:place'];
    mockRequest.body = { tenantId: 'tenant-2' }; // User is tenant-1

    const middleware = requirePermission('purchase_order', 'place');
    middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Cross-tenant access is not allowed") })
    );
  });

  it('should handle case insensitivity', () => {
    mockRequest.user!.permissions = ['Purchase_Order:Place'];

    const middleware = requirePermission('purchase_order', 'place');
    middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });
});
