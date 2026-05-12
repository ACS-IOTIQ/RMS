import { BadRequestException, Body, Controller, Delete, Get, Module, Param, Post, Put, UseGuards, Injectable, Query } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

class DeptDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() projectId: string;
  @IsOptional() @IsString() locationId?: string | null;
  @IsOptional() @IsString() headEmployeeId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) capacity?: number;
}

class UpdateDeptDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() locationId?: string | null;
  @IsOptional() @IsString() headEmployeeId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) capacity?: number;
}

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async list(projectId?: string, locationId?: string, page?: number, pageSize?: number) {
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (locationId) where.locationId = locationId;
    const include = {
      project: true,
      location: true,
      headEmployee: true,
      _count: { select: { employees: true } },
    };
    const orderBy = { name: 'asc' as const };
    if (!page && !pageSize) return this.prisma.department.findMany({ where, include, orderBy });

    const safePage = Math.max(1, page || 1);
    const safePageSize = Math.min(100, Math.max(1, pageSize || 10));
    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        include,
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.department.count({ where }),
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
    return this.prisma.department.findUnique({
      where: { id },
      include: {
        project: true,
        location: true,
        headEmployee: true,
        employees: { include: { designation: true, location: true } },
      },
    });
  }

  async create(data: DeptDto) {
    await this.validateMapping(data.projectId, data.locationId, data.headEmployeeId);
    return this.prisma.department.create({ data: this.cleanData(data) });
  }

  async update(id: string, data: UpdateDeptDto) {
    const current = await this.prisma.department.findUnique({ where: { id } });
    if (!current) throw new BadRequestException('Department not found');
    await this.validateMapping(current.projectId, data.locationId, data.headEmployeeId);
    return this.prisma.department.update({ where: { id }, data: this.cleanData(data) });
  }

  remove(id: string) { return this.prisma.department.delete({ where: { id } }); }

  private cleanData<T extends Record<string, any>>(data: T) {
    const payload: any = { ...data };
    if (payload.locationId === '') payload.locationId = null;
    if (payload.headEmployeeId === '') payload.headEmployeeId = null;
    return payload;
  }

  private async validateMapping(projectId: string, locationId?: string | null, headEmployeeId?: string | null) {
    if (locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: locationId, projectId } });
      if (!location) throw new BadRequestException('Location does not belong to this project');
    }
    if (headEmployeeId) {
      const employee = await this.prisma.employee.findFirst({ where: { id: headEmployeeId, projectId } });
      if (!employee) throw new BadRequestException('Department head must belong to this project');
    }
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private svc: DepartmentsService) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('locationId') locationId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(projectId, locationId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }

  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Roles(UserRole.ADMIN) @Post() create(@Body() dto: DeptDto) { return this.svc.create(dto); }
  @Roles(UserRole.ADMIN) @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateDeptDto) { return this.svc.update(id, dto); }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ controllers: [DepartmentsController], providers: [DepartmentsService] })
export class DepartmentsModule {}
