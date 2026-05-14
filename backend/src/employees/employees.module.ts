import { Body, Controller, Delete, Get, Module, Param, Post, Put, UseGuards, Injectable, Query, BadRequestException } from '@nestjs/common';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole, EmployeeStatus, WorkforceCategory } from '@prisma/client';

class EmployeeDto {
  @IsString() @IsNotEmpty() employeeCode: string;
  @IsString() @IsNotEmpty() name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @IsNotEmpty() designationId: string;
  @IsOptional() @IsString() designationName?: string;
  @IsString() @IsNotEmpty() locationId: string;
  @IsString() @IsNotEmpty() projectId: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() departmentName?: string;
  @IsOptional() @IsString() reportingManagerId?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsEnum(WorkforceCategory) workforceCategory?: WorkforceCategory;
}
class UpdateEmployeeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() designationId?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() reportingManagerId?: string | null;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsEnum(WorkforceCategory) workforceCategory?: WorkforceCategory;
}
class BulkEmployeeDto {
  @IsArray() employees: EmployeeDto[];
}
class AssignmentDto {
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() locationId?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;
}

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async list(filters: {
    projectId?: string; locationId?: string; designationId?: string; status?: EmployeeStatus; q?: string;
    page?: number; pageSize?: number;
  }) {
    const where: any = {};
    if (filters.projectId) where.projectId = filters.projectId === 'unassigned' ? null : filters.projectId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.designationId) where.designationId = filters.designationId;
    if (filters.status) where.status = filters.status;
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
        { employeeCode: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    const query = {
      where,
      include: {
        designation: true,
        location: true,
        project: true,
        department: true,
        reportingManager: { select: { id: true, name: true, employeeCode: true, email: true } },
        user: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    };

    if (!filters.page && !filters.pageSize) return this.prisma.employee.findMany(query);
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 10));
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({ ...query, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  get(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        designation: true, location: true, project: true, department: true,
        reportingManager: { select: { id: true, name: true, employeeCode: true, email: true } },
        directReports: { select: { id: true, name: true, employeeCode: true, email: true } },
        user: { select: { id: true, email: true, role: true } },
        rosterEntries: { take: 30, orderBy: { date: 'desc' }, include: { shift: true } },
        leaves: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async create(data: EmployeeDto) {
    try {
      return await this.prisma.employee.create({ data: this.cleanData(data) });
    } catch (e: any) {
      if (e.code === 'P2002') throw new BadRequestException('Employee code or email already exists');
      throw e;
    }
  }

  async bulkCreate(rows: any[]) {
    const errors: { row: number; message: string }[] = [];
    let created = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const payload: any = { ...row };
        if (!payload.phone) delete payload.phone;
        if (!payload.reportingManagerId) delete payload.reportingManagerId;
        if (!payload.status) delete payload.status;
        const data = await this.prepareBulkPayload(payload);
        await this.prisma.employee.create({ data });
        created += 1;
      } catch (e: any) {
        const message = e.code === 'P2002'
          ? 'Employee code or email already exists'
          : e.message ?? 'Could not create employee';
        errors.push({ row: i + 1, message });
      }
    }
    return { created, failed: errors.length, errors };
  }

  update(id: string, data: UpdateEmployeeDto) {
    if (data.reportingManagerId && data.reportingManagerId === id) throw new BadRequestException('Employee cannot report to themselves');
    return this.prisma.employee.update({ where: { id }, data: this.cleanData(data) });
  }

  async updateAssignment(id: string, dto: AssignmentDto, actor: any) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new BadRequestException('Employee not found');

    const data = await this.assignmentData(dto);
    const updated = await this.prisma.employee.update({
      where: { id },
      data,
      include: { designation: true, location: true, project: true, department: true },
    });

    await this.prisma.auditLog.create({
      data: {
        action: data.projectId ? 'EMPLOYEE_ASSIGN' : 'EMPLOYEE_UNASSIGN',
        entityType: 'EmployeeProjectAssignment',
        entityId: employee.id,
        actorUserId: actor?.userId,
        actorEmail: actor?.email,
        employeeId: employee.id,
        previousProjectId: employee.projectId,
        updatedProjectId: data.projectId,
        metadata: {
          previousLocationId: employee.locationId,
          updatedLocationId: data.locationId,
          previousDepartmentId: employee.departmentId,
          updatedDepartmentId: data.departmentId,
        },
      },
    });

    return updated;
  }

  private async assignmentData(dto: AssignmentDto) {
    if (!dto.projectId) {
      return { projectId: null, locationId: null, departmentId: null };
    }

    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new BadRequestException('Project not found');
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: dto.locationId, projectId: dto.projectId } });
      if (!location) throw new BadRequestException('Location does not belong to this project');
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({ where: { id: dto.departmentId, projectId: dto.projectId } });
      if (!department) throw new BadRequestException('Department does not belong to this project');
    }
    return {
      projectId: dto.projectId,
      locationId: dto.locationId ?? null,
      departmentId: dto.departmentId ?? null,
    };
  }

  private cleanData<T extends Record<string, any>>(data: T) {
    const payload: any = { ...data };
    for (const key of ['departmentId', 'reportingManagerId', 'locationId', 'projectId']) {
      if (payload[key] === '') payload[key] = null;
    }
    return payload;
  }

  private async prepareBulkPayload(row: Record<string, any>) {
    const payload = this.cleanData(row);
    const designationName = String(payload.designationName ?? '').trim();
    const departmentName = String(payload.departmentName ?? '').trim();
    delete payload.designationName;
    delete payload.departmentName;

    if (!payload.designationId) {
      if (!designationName) throw new BadRequestException('Designation is required');
      const existing = await this.prisma.designation.findFirst({
        where: { name: { equals: designationName, mode: 'insensitive' } },
      });
      const designation = existing ?? await this.prisma.designation.create({
        data: { name: designationName, level: 1 },
      });
      payload.designationId = designation.id;
    }

    if (!payload.departmentId && departmentName && payload.projectId) {
      const existing = await this.prisma.department.findFirst({
        where: {
          projectId: payload.projectId,
          name: { equals: departmentName, mode: 'insensitive' },
        },
      });
      const department = existing ?? await this.prisma.department.create({
        data: {
          name: departmentName,
          projectId: payload.projectId,
          locationId: payload.locationId ?? null,
        },
      });
      payload.departmentId = department.id;
    }

    if (!payload.departmentId) delete payload.departmentId;
    return payload;
  }

  remove(id: string) {
    return this.prisma.employee.delete({ where: { id } });
  }

  stats() {
    return this.prisma.employee.groupBy({ by: ['status'], _count: true });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private svc: EmployeesService) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('locationId') locationId?: string,
    @Query('designationId') designationId?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list({
      projectId, locationId, designationId, status, q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('stats') stats() { return this.svc.stats(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Roles(UserRole.ADMIN) @Post() create(@Body() dto: EmployeeDto) { return this.svc.create(dto); }
  @Roles(UserRole.ADMIN) @Post('bulk') bulkCreate(@Body() dto: BulkEmployeeDto) { return this.svc.bulkCreate(dto.employees ?? []); }
  @Roles(UserRole.ADMIN) @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) { return this.svc.update(id, dto); }
  @Roles(UserRole.ADMIN) @Put(':id/assignment')
  updateAssignment(@Param('id') id: string, @Body() dto: AssignmentDto, @CurrentUser() user: any) {
    return this.svc.updateAssignment(id, dto, user);
  }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ controllers: [EmployeesController], providers: [EmployeesService] })
export class EmployeesModule {}
