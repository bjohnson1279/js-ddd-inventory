export class ManageApprovalWorkflowsUseCase {
  async createWorkflow(tenantId: string, data: any): Promise<any> {
    return {
      id: "wf_placeholder",
      tenantId,
      ...data,
      status: "active",
      createdAt: new Date().toISOString()
    };
  }
}
