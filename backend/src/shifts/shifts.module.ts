import { BadRequestException, Body, Controller, Delete, Get, Module, Param, Post, Put, UseGuards, Injectable, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole, ShiftCode, ShiftType } from '@prisma/client';

class ShiftDto {
  @IsOptional() @IsEnum(ShiftCode) code?: ShiftCode;
  @IsString() @IsNotEmpty() name: string;
  @Matches(/^\d{2}:\d{2}$/) startTime: string;
  @Matches(/^\d{2}:\d{2}$/) endTime: string;
  @IsOptional() @IsEnum(ShiftType) type?: ShiftType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) distribution?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priority?: number;
  @IsString() @IsNotEmpty() locationId: string;
}

class UpdateShiftDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) startTime?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) endTime?: string;
  @IsOptional() @IsEnum(ShiftType) type?: ShiftType;
  @IsOptional() @Type(() => Number) @IsInt() distribution?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priority?: number;
}

class RequirementDto {
  @IsString() @IsNotEmpty() designationId: string;
  @Type(() => Number) @IsInt() @Min(0) minCount: number;
}

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async list(locationId?: string, projectId?: string, page?: number, pageSize?: number) {
    const where: any = {};
    if (locationId) where.locationId = locationId;
    if (projectId) where.location = { projectId };
    const include = {
      location: { include: { project: true } },
      requirements: { include: { designation: true } },
    };
    const orderBy = [{ priority: 'desc' as const }, { code: 'asc' as const }];
    if (!page && !pageSize) return this.prisma.shift.findMany({ where, include, orderBy });
    const safePage = Math.max(1, page || 1);
    const safePageSize = Math.min(100, Math.max(1, pageSize || 10));
    const [data, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        include,
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.shift.count({ where }),
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
    return this.prisma.shift.findUnique({
      where: { id },
      include: { location: { include: { project: true } }, requirements: { include: { designation: true } } },
    });
  }

  async create(data: ShiftDto, actor: any) {
    const code = await this.nextCode(data.locationId);
    const { code: _ignoredCode, ...payload } = data;
    const shift = await this.prisma.shift.create({ data: { ...payload, code } });
    await this.audit('SHIFT_CREATE', shift.id, actor, null, shift);
    return shift;
  }

  async update(id: string, data: UpdateShiftDto, actor: any) {
    const previous = await this.get(id);
    const shift = await this.prisma.shift.update({ where: { id }, data });
    await this.audit('SHIFT_UPDATE', id, actor, previous, shift);
    return shift;
  }

  async remove(id: string, actor: any) {
    const previous = await this.get(id);
    const shift = await this.prisma.shift.delete({ where: { id } });
    await this.audit('SHIFT_DELETE', id, actor, previous, null);
    return shift;
  }

  async setRequirements(shiftId: string, items: RequirementDto[], actor: any) {
    const previous = await this.get(shiftId);
    await this.prisma.shiftRequirement.deleteMany({ where: { shiftId } });
    const nonZeroItems = items.filter((i) => Number(i.minCount) > 0);
    if (nonZeroItems.length > 0) {
      await this.prisma.shiftRequirement.createMany({
        data: nonZeroItems.map((i) => ({ ...i, shiftId })),
      });
    }
    const updated = await this.get(shiftId);
    await this.audit('SHIFT_REQUIREMENTS_UPDATE', shiftId, actor, previous, updated);
    return updated;
  }

  private async nextCode(locationId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) throw new BadRequestException('Location not found');

    const existing = await this.prisma.shift.findMany({
      where: { locationId },
      select: { code: true },
    });
    const used = new Set(existing.map((s) => s.code));
    const order = [ShiftCode.A, ShiftCode.B, ShiftCode.C, ShiftCode.G, ShiftCode.F];
    const code = order.find((candidate) => !used.has(candidate));
    if (!code) throw new BadRequestException('All shift codes are already used for this location');
    return code;
  }

  private audit(action: string, entityId: string, actor: any, previous: any, updated: any) {
    return this.prisma.auditLog.create({
      data: {
        action,
        entityType: 'Shift',
        entityId,
        actorUserId: actor?.userId,
        actorEmail: actor?.email,
        metadata: { previous, updated },
      },
    });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private svc: ShiftsService) {}

  @Get()
  list(
    @Query('locationId') locationId?: string,
    @Query('projectId') projectId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(locationId, projectId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }

  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Roles(UserRole.ADMIN) @Post() create(@Body() dto: ShiftDto, @CurrentUser() user: any) { return this.svc.create(dto, user); }
  @Roles(UserRole.ADMIN) @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateShiftDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, user);
  }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: any) { return this.svc.remove(id, user); }
  @Roles(UserRole.ADMIN) @Put(':id/requirements')
  setReq(@Param('id') id: string, @Body() body: { items: RequirementDto[] }, @CurrentUser() user: any) {
    return this.svc.setRequirements(id, body.items ?? [], user);
  }
}

@Module({ controllers: [ShiftsController], providers: [ShiftsService] })
export class ShiftsModule {}
