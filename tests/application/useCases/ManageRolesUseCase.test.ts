import { ManageRolesUseCase } from '../../../src/application/useCases/ManageRolesUseCase';

jest.mock('../../../src/infrastructure/database/prisma', () => {
  const mockTx = {
    roleModel: {
      create: jest.fn(),
    },
    rolePermissionModel: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  return {
    prisma: {
      permissionModel: {
        findMany: jest.fn(),
      },
      roleModel: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      rolePermissionModel: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockTx)),
    },
  };
});

import { prisma } from '../../../src/infrastructure/database/prisma';

describe('ManageRolesUseCase', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomRole', () => {
    it('should throw an error if name is missing', async () => {
      await expect(
        ManageRolesUseCase.createCustomRole(tenantId, '', 'Description', ['perm-1'])
      ).rejects.toThrow('name is required.');
    });

    it('should throw an error if invalid permission IDs are provided', async () => {
      (prisma.permissionModel.findMany as jest.Mock).mockResolvedValue([
        { id: 'perm-1' },
      ]);

      await expect(
        ManageRolesUseCase.createCustomRole(tenantId, 'Manager Role', 'Manager Description', [
          'perm-1',
          'invalid-perm',
        ])
      ).rejects.toThrow('Invalid permission IDs: invalid-perm');

      expect(prisma.permissionModel.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['perm-1', 'invalid-perm'] } },
      });
    });

    it('should create a custom role without permission IDs', async () => {
      const result = await ManageRolesUseCase.createCustomRole(
        tenantId,
        'Admin Assistant',
        'Assistant description',
        undefined
      );

      expect(result).toMatchObject({
        name: 'Admin Assistant',
        description: 'Assistant description',
        isCustom: true,
        tenantId: tenantId,
      });
      expect(result.id).toMatch(/^custom_tenant-123_admin_assistant_\d+$/);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should create a custom role with valid permissions', async () => {
      const permissionIds = ['perm-1', 'perm-2'];
      (prisma.permissionModel.findMany as jest.Mock).mockResolvedValue([
        { id: 'perm-1' },
        { id: 'perm-2' },
      ]);

      const result = await ManageRolesUseCase.createCustomRole(
        tenantId,
        'Custom Admin',
        undefined,
        permissionIds
      );

      expect(result).toMatchObject({
        name: 'Custom Admin',
        description: undefined,
        isCustom: true,
        tenantId: tenantId,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('listRoles', () => {
    it('should list roles filtered by tenantId', async () => {
      const mockRolesFromDb = [
        {
          id: 'role-1',
          name: 'Admin',
          description: 'Default Admin',
          isCustom: false,
          tenantId: null,
          rolePermissions: [
            {
              permission: {
                id: 'perm-1',
                resource: 'inventory',
                action: 'read',
                description: 'Read Inventory',
              },
            },
          ],
        },
      ];

      (prisma.roleModel.findMany as jest.Mock).mockResolvedValue(mockRolesFromDb);

      const roles = await ManageRolesUseCase.listRoles(tenantId);

      expect(prisma.roleModel.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ isCustom: false }, { tenantId: tenantId }],
        },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      expect(roles).toEqual([
        {
          id: 'role-1',
          name: 'Admin',
          description: 'Default Admin',
          isCustom: false,
          permissions: [
            {
              id: 'perm-1',
              resource: 'inventory',
              action: 'read',
              description: 'Read Inventory',
            },
          ],
        },
      ]);
    });

    it('should list all roles when tenantId is not provided', async () => {
      (prisma.roleModel.findMany as jest.Mock).mockResolvedValue([]);

      await ManageRolesUseCase.listRoles();

      expect(prisma.roleModel.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('listPermissions', () => {
    it('should return all permissions sorted by resource and action', async () => {
      const mockPermissions = [
        {
          id: 'perm-1',
          resource: 'inventory',
          action: 'read',
          description: 'Read inventory',
        },
        {
          id: 'perm-2',
          resource: 'orders',
          action: 'write',
          description: 'Write orders',
        },
      ];

      (prisma.permissionModel.findMany as jest.Mock).mockResolvedValue(mockPermissions);

      const permissions = await ManageRolesUseCase.listPermissions();

      expect(prisma.permissionModel.findMany).toHaveBeenCalledWith({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      });

      expect(permissions).toEqual([
        {
          id: 'perm-1',
          resource: 'inventory',
          action: 'read',
          description: 'Read inventory',
        },
        {
          id: 'perm-2',
          resource: 'orders',
          action: 'write',
          description: 'Write orders',
        },
      ]);
    });
  });

  describe('updateRolePermissions', () => {
    it('should throw NOT_FOUND error if role does not exist', async () => {
      (prisma.roleModel.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        ManageRolesUseCase.updateRolePermissions('non-existent-role', ['perm-1'])
      ).rejects.toThrow('NOT_FOUND: Role non-existent-role not found.');
    });

    it('should throw INVALID_INPUT error if permission IDs are invalid', async () => {
      (prisma.roleModel.findUnique as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.permissionModel.findMany as jest.Mock).mockResolvedValue([{ id: 'perm-1' }]);

      await expect(
        ManageRolesUseCase.updateRolePermissions('role-1', ['perm-1', 'perm-invalid'])
      ).rejects.toThrow('INVALID_INPUT: Invalid permission IDs: perm-invalid');
    });

    it('should successfully update role permissions', async () => {
      (prisma.roleModel.findUnique as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.permissionModel.findMany as jest.Mock).mockResolvedValue([
        { id: 'perm-1' },
        { id: 'perm-2' },
      ]);

      await ManageRolesUseCase.updateRolePermissions('role-1', ['perm-1', 'perm-2']);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should clear role permissions when an empty permission list is passed', async () => {
      (prisma.roleModel.findUnique as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.permissionModel.findMany as jest.Mock).mockResolvedValue([]);

      await ManageRolesUseCase.updateRolePermissions('role-1', []);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
