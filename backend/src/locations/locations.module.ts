import { BadRequestException, Body, Controller, Delete, Get, Module, Param, Post, Put, UseGuards, Injectable, Query } from '@nestjs/common';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles.guard';
import { getAllowedLocationIds } from '../auth/location-access';
import { EmployeeStatus, UserRole, WeeklyOffPolicy } from '@prisma/client';

class LocationDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() projectId: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsEnum(WeeklyOffPolicy) weeklyOffPolicy?: WeeklyOffPolicy;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(6) fixedWeeklyOffDay?: number;
}
class UpdateLocationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsEnum(WeeklyOffPolicy) weeklyOffPolicy?: WeeklyOffPolicy;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(6) fixedWeeklyOffDay?: number;
}
class AssignmentDto {
  @IsArray() employeeIds: string[];
  @IsOptional() @IsString() departmentId?: string | null;
}

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async list(projectId?: string, page?: number, pageSize?: number, allowedLocationIds?: string[] | null) {
    const where: any = projectId ? { projectId } : {};
    if (allowedLocationIds !== null && allowedLocationIds !== undefined) {
      if (allowedLocationIds.length === 0) return page || pageSize ? { data: [], meta: { page: 1, pageSize: pageSize || 10, total: 0, totalPages: 1 } } : [];
      where.id = { in: allowedLocationIds };
    }
    const include = {
      project: true,
      _count: { select: { employees: true, shifts: true, departments: true } },
    };
    const orderBy = { name: 'asc' as const };
    if (!page && !pageSize) return this.prisma.location.findMany({ where, include, orderBy });

    const safePage = Math.max(1, page || 1);
    const safePageSize = Math.min(100, Math.max(1, pageSize || 10));
    const [data, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        include,
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.location.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
    };
  }

  get(id: string) {
    return this.prisma.location.findUnique({
      where: { id },
      include: {
        project: true,
        shifts: true,
        departments: { include: { headEmployee: true, _count: { select: { employees: true } } } },
        employees: { include: { designation: true, department: true } },
      },
    });
  }

  create(data: LocationDto) { return this.prisma.location.create({ data }); }
  update(id: string, data: UpdateLocationDto) { return this.prisma.location.update({ where: { id }, data }); }
  remove(id: string) { return this.prisma.location.delete({ where: { id } }); }

  async assignmentCandidates(locationId: string, filters: {
    tab?: string; search?: string; designationId?: string; departmentId?: string; shiftId?: string; status?: EmployeeStatus;
  }) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { shifts: true },
    });
    if (!location) throw new BadRequestException('Location not found');

    const where: any = { projectId: location.projectId };
    if ((filters.tab ?? 'assigned') === 'assigned') {
      where.locationId = locationId;
    } else {
      where.OR = [{ locationId: null }, { locationId: { not: locationId } }];
    }
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.status) where.status = filters.status;
    if (filters.designationId) where.designationId = filters.designationId;
    if (filters.shiftId) {
      const shift = location.shifts.find((s) => s.id === filters.shiftId);
      if (!shift) throw new BadRequestException('Shift does not belong to this location');
      const requirements = await this.prisma.designationRequirement.findMany({
        where: { locationId, shiftId: filters.shiftId, isActive: true },
        select: { designationId: true },
      });
      const eligibleDesignationIds = requirements.map((r) => r.designationId);
      if (eligibleDesignationIds.length > 0) {
        if (filters.designationId && !eligibleDesignationIds.includes(filters.designationId)) return [];
        where.designationId = filters.designationId ?? { in: eligibleDesignationIds };
      }
    }
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
      include: { designation: true, department: true, location: true, project: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async workforce(locationId: string) {
    const [byDesignation, byStatus, employees] = await Promise.all([
      this.prisma.employee.groupBy({
        by: ['designationId'],
        where: { locationId },
        _count: true,
      }),
      this.prisma.employee.groupBy({
        by: ['status'],
        where: { locationId },
        _count: true,
      }),
      this.prisma.employee.count({ where: { locationId } }),
    ]);
    const designations = await this.prisma.designation.findMany();
    return {
      employees,
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count })),
      byDesignation: byDesignation.map((row) => ({
        designation: designations.find((d) => d.id === row.designationId)?.name ?? 'Unknown',
        count: row._count,
      })),
    };
  }

  async assignEmployees(locationId: string, dto: AssignmentDto, actor: any) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw new BadRequestException('Location not found');
    await this.validateDepartment(location.projectId, dto.departmentId);
    return this.changeLocationAssignment(location, dto.employeeIds, {
      locationId,
      departmentId: dto.departmentId ?? null,
    }, actor, 'LOCATION_ASSIGN');
  }

  async unassignEmployees(locationId: string, dto: AssignmentDto, actor: any) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw new BadRequestException('Location not found');
    return this.changeLocationAssignment(location, dto.employeeIds, {
      locationId: null,
      departmentId: null,
    }, actor, 'LOCATION_UNASSIGN');
  }

  private async validateDepartment(projectId: string, departmentId?: string | null) {
    if (!departmentId) return;
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, projectId } });
    if (!department) throw new BadRequestException('Department does not belong to this location project');
  }

  private async changeLocationAssignment(
    location: { id: string; projectId: string },
    employeeIds: string[],
    data: { locationId: string | null; departmentId: string | null },
    actor: any,
    action: string,
  ) {
    const ids = [...new Set(employeeIds)].filter(Boolean);
    if (ids.length === 0) throw new BadRequestException('Select at least one employee');
    const employees = await this.prisma.employee.findMany({ where: { id: { in: ids } } });
    if (employees.length === 0) throw new BadRequestException('No employees found');
    const invalid = employees.find((emp) => emp.projectId !== location.projectId);
    if (invalid) throw new BadRequestException('Employees must belong to the location project');

    await this.prisma.$transaction(async (tx) => {
      for (const emp of employees) {
        await tx.employee.update({ where: { id: emp.id }, data });
        await tx.auditLog.create({
          data: {
            action,
            entityType: 'EmployeeLocationAssignment',
            entityId: emp.id,
            actorUserId: actor?.userId,
            actorEmail: actor?.email,
            employeeId: emp.id,
            previousProjectId: emp.projectId,
            updatedProjectId: emp.projectId,
            metadata: {
              previousLocationId: emp.locationId,
              updatedLocationId: data.locationId,
              previousDepartmentId: emp.departmentId,
              updatedDepartmentId: data.departmentId,
              locationId: location.id,
            },
          },
        });
      }
    });
    return { updated: employees.length };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private svc: LocationsService) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: any,
  ) {
    return this.svc.list(projectId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, getAllowedLocationIds(user));
  }

  @Get(':id/assignment-candidates')
  assignmentCandidates(
    @Param('id') id: string,
    @Query('tab') tab?: string,
    @Query('search') search?: string,
    @Query('designationId') designationId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('status') status?: EmployeeStatus,
  ) {
    return this.svc.assignmentCandidates(id, { tab, search, designationId, departmentId, shiftId, status });
  }

  @Get(':id/workforce') workforce(@Param('id') id: string) { return this.svc.workforce(id); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Roles(UserRole.ADMIN) @Post() create(@Body() dto: LocationDto) { return this.svc.create(dto); }
  @Roles(UserRole.ADMIN) @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateLocationDto) { return this.svc.update(id, dto); }
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

@Module({ controllers: [LocationsController], providers: [LocationsService] })
export class LocationsModule {}
