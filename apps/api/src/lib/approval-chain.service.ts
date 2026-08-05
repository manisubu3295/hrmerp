import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

/**
 * Generic, reusable approval engine — not wired into Leave/Expense/PO
 * approval flows yet (those keep their existing one-off approval fields
 * this pass; migrating them onto this engine is Phase 1/4 follow-up work
 * so this pass doesn't destabilize working approval flows).
 */

export async function startInstance(chainId: string, entityType: string, entityId: string) {
  const chain = await prisma.approvalChain.findUnique({
    where: { id: chainId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });
  if (!chain || !chain.isActive) throw new AppError(404, 'Approval chain not found or inactive');
  if (chain.entityType !== entityType) throw new AppError(400, `Chain is for entityType "${chain.entityType}", not "${entityType}"`);
  if (chain.steps.length === 0) throw new AppError(400, 'Approval chain has no steps configured');

  return prisma.approvalInstance.create({
    data: { chainId, entityType, entityId, status: 'PENDING', currentStepOrder: chain.steps[0]!.stepOrder },
  });
}

async function isAuthorizedForStep(actorUserId: string, step: { approverUserId: string | null; approverRoleId: string | null }): Promise<boolean> {
  if (step.approverUserId) return step.approverUserId === actorUserId;
  if (step.approverRoleId) {
    const assignment = await prisma.userRoleAssignment.findFirst({
      where: { userId: actorUserId, roleId: step.approverRoleId },
    });
    return Boolean(assignment);
  }
  return false;
}

export async function recordAction(
  instanceId: string,
  actorUserId: string,
  decision: 'APPROVED' | 'REJECTED',
  comment?: string,
) {
  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
    include: { chain: { include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
  });
  if (!instance) throw new AppError(404, 'Approval instance not found');
  if (instance.status !== 'PENDING') throw new AppError(400, `Instance is already ${instance.status}`);

  const currentStep = instance.chain.steps.find((s) => s.stepOrder === instance.currentStepOrder);
  if (!currentStep) throw new AppError(500, 'Approval instance has no matching current step');

  const authorized = await isAuthorizedForStep(actorUserId, currentStep);
  if (!authorized) throw new AppError(403, 'You are not an approver for the current step');

  await prisma.approvalAction.create({
    data: { instanceId, stepId: currentStep.id, actorUserId, decision, comment },
  });

  if (decision === 'REJECTED') {
    return prisma.approvalInstance.update({ where: { id: instanceId }, data: { status: 'REJECTED' } });
  }

  const steps = instance.chain.steps;
  const currentIndex = steps.findIndex((s) => s.id === currentStep.id);
  const nextStep = steps[currentIndex + 1];

  if (!nextStep) {
    return prisma.approvalInstance.update({ where: { id: instanceId }, data: { status: 'APPROVED' } });
  }
  return prisma.approvalInstance.update({ where: { id: instanceId }, data: { currentStepOrder: nextStep.stepOrder } });
}

export async function getStatus(instanceId: string) {
  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
    include: {
      chain: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      actions: { orderBy: { actedAt: 'asc' }, include: { actorUser: { select: { id: true, email: true } } } },
    },
  });
  if (!instance) throw new AppError(404, 'Approval instance not found');
  return instance;
}
