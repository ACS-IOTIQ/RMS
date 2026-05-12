import { BadRequestException, Body, Controller, Delete, Get, Module, Param, Post, Put, UseGuards, Injectable, Query } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

class ProjectDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() code?: string;
  @IsString() @IsNotEmpty() organizationId: string;
  @IsOptional() @IsString() clientName?: string;
  @IsOptional() @IsString() timezone?: string;
}
class UpdateProjectDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() clientName?: string;
  @IsOptional() @IsString() timezone?: string;
}
class AssignmentDto {
  @IsArray() employeeIds: string[];
  @IsOptional() @IsString() locationId?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}
  list(orgId?: string) {
    return this.prisma.project.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: {
        organization: true,
        _count: { select: { locations: true, employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
  get(id: string) { return this.prisma.project.findUnique({ where: { id }, include: { organization: true, locations: true, departments: true } }); }

  async create(data: ProjectDto) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        code: await this.nextCode(),
        organizationId: data.organizationId,
        clientName: data.clientName,
        timezone: data.timezone,
      },
    });
  }

  update(id: string, data: UpdateProjectDto) { return this.prisma.project.update({ where: { id }, data }); }
  remove(id: string) { return this.prisma.project.delete({ where: { id } }); }

  async assignmentCandidates(projectId: string, filters: {
    tab?: string; search?: string; designationId?: string; locationId?: string;
  }) {
    const where: any = {};
    if ((filters.tab ?? 'assigned') === 'assigned') {
      where.projectId = projectId;
    } else {
      where.OR = [{ projectId: null }, { projectId: { not: projectId } }];
    }
    if (filters.designationId) where.designationId = filters.designationId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.search) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { employeeCode: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    return this.prisma.employee.findMany({
      where,
      include: { designation: true, location: true, project: true, department: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async assignEmployees(projectId: string, dto: AssignmentDto, actor: any) {
    await this.validateAssignmentTarget(projectId, dto.locationId, dto.departmentId);
    return this.changeProjectAssignment(projectId, dto.employeeIds, {
      projectId,
      locationId: dto.locationId ?? null,
      departmentId: dto.departmentId ?? null,
    }, actor, 'PROJECT_ASSIGN');
  }

  async unassignEmployees(projectId: string, dto: AssignmentDto, actor: any) {
    return this.changeProjectAssignment(projectId, dto.employeeIds, {
      projectId: null,
      locationId: null,
      departmentId: null,
    }, actor, 'PROJECT_UNASSIGN');
  }

  private async validateAssignmentTarget(projectId: string, locationId?: string | null, departmentId?: string | null) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Project not found');
    if (locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: locationId, projectId } });
      if (!location) throw new BadRequestException('Location does not belong to this project');
    }
    if (departmentId) {
      const department = await this.prisma.department.findFirst({ where: { id: departmentId, projectId } });
      if (!department) throw new BadRequestException('Department does not belong to this project');
    }
  }

  private async changeProjectAssignment(
    sourceProjectId: string,
    employeeIds: string[],
    data: { projectId: string | null; locationId: string | null; departmentId: string | null },
    actor: any,
    action: string,
  ) {
    const ids = [...new Set(employeeIds)].filter(Boolean);
    if (ids.length === 0) throw new BadRequestException('Select at least one employee');
    const employees = await this.prisma.employee.findMany({ where: { id: { in: ids } } });
    if (employees.length === 0) throw new BadRequestException('No employees found');

    await this.prisma.$transaction(async (tx) => {
      for (const emp of employees) {
        await tx.employee.update({ where: { id: emp.id }, data });
        await tx.auditLog.create({
          data: {
            action,
            entityType: 'EmployeeProjectAssignment',
            entityId: emp.id,
            actorUserId: actor?.userId,
            actorEmail: actor?.email,
            employeeId: emp.id,
            previousProjectId: emp.projectId,
            updatedProjectId: data.projectId,
            metadata: {
              sourceProjectId,
              previousLocationId: emp.locationId,
              updatedLocationId: data.locationId,
              previousDepartmentId: emp.departmentId,
              updatedDepartmentId: data.departmentId,
            },
          },
        });
      }
    });

    return { updated: employees.length };
  }

  private async nextCode() {
    const prefix = process.env.PROJECT_CODE_PREFIX ?? 'PROJ';
    const pad = Number(process.env.PROJECT_CODE_PAD ?? 4);
    let seq = await this.prisma.project.count();
    while (true) {
      seq += 1;
      const code = `${prefix}-${String(seq).padStart(pad, '0')}`;
      const exists = await this.prisma.project.findUnique({ where: { code } });
      if (!exists) return code;
    }
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private svc: ProjectsService) {}
  @Get() list(@Query('organizationId') orgId?: string) { return this.svc.list(orgId); }
  @Get(':id/assignment-candidates')
  assignmentCandidates(
    @Param('id') id: string,
    @Query('tab') tab?: string,
    @Query('search') search?: string,
    @Query('designationId') designationId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.svc.assignmentCandidates(id, { tab, search, designationId, locationId });
  }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Roles(UserRole.ADMIN) @Post() create(@Body() dto: ProjectDto) { return this.svc.create(dto); }
  @Roles(UserRole.ADMIN) @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateProjectDto) { return this.svc.update(id, dto); }
  @Roles(UserRole.ADMIN) @Post(':id/assign-employees')
  assignEmployees(@Param('id') id: string, @Body() dto: AssignmentDto, @CurrentUser() user: any) {
    return this.svc.assignEmployees(id, dto, user);
  }
  @Roles(UserRole.ADMIN) @Post(':id/unassign-employees')
  unassignEmployees(@Param('id') id: string, @Body() dto: AssignmentDto, @CurrentUser() user: any) {
    return this.svc.unassignEmployees(id, dto, user);
  }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
