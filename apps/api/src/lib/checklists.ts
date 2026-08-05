import prisma from './prisma';
import type { ChecklistPurpose } from '@prisma/client';

// Shared by employees.routes.ts's /offboard endpoint, recruitment.routes.ts's
// /hire endpoint, and checklists.routes.ts's own instance-creation route.
// Best-effort: returns null if the org has no active template for the given
// purpose (checklist instantiation is opt-in, not required).
export async function materializeChecklistInstance(
  organizationId: string,
  employeeId: string,
  purpose: ChecklistPurpose,
  startDate: Date,
  templateId?: string,
) {
  const template = templateId
    ? await prisma.checklistTemplate.findFirst({
        where: { id: templateId, purpose, isActive: true },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      })
    : await prisma.checklistTemplate.findFirst({
        where: { purpose, isActive: true },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
  if (!template) return null;

  const instance = await prisma.checklistInstance.create({
    data: {
      organizationId,
      employeeId,
      templateId: template.id,
      purpose,
      startDate,
      status: 'IN_PROGRESS',
    },
  });

  if (template.tasks.length > 0) {
    await prisma.checklistInstanceTask.createMany({
      data: template.tasks.map((t) => ({
        instanceId: instance.id,
        templateTaskId: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.dueOffsetDays != null ? new Date(startDate.getTime() + t.dueOffsetDays * 86400000) : null,
        sortOrder: t.sortOrder,
      })),
    });
  }

  return instance;
}
