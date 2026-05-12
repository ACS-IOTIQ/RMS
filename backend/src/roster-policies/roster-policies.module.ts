import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { DayType, RoundingPolicy, UserRole, WeekStartDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles.guard';

class DesignationRequirementDto {
  @IsString() @IsNotEmpty() shiftId: string;
  @IsString() @IsNotEmpty() designationId: string;
  @Type(() => Number) @IsInt() @Min(0) requiredCount: number;
  @IsOptional() @IsEnum(DayType) dayType?: DayType;
}

class RosterPolicyDto {
  @IsOptional() @IsString() organizationId?: string;
  @IsString() @IsNotEmpty() projectId: string;
  @IsString() @IsNotEmpty() locationId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) requiredDailyHeadcount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) workingDaysPerEmployee?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(6) weeklyOffsPerEmployee?: number;
  @IsOptional() shiftDistributionJson?: any;
  @IsOptional() @IsEnum(RoundingPolicy) roundingPolicy?: RoundingPolicy;
  @IsOptional() @IsBoolean() generalBufferEnabled?: boolean;
  @IsOptional() @IsBoolean() allowExtraDuty?: boolean;
  @IsOptional() @IsBoolean() allowOvertime?: boolean;
  @IsOptional() @IsEnum(WeekStartDay) weekStartDay?: WeekStartDay;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minimumRestHours?: number;
  @IsOptional() @IsString() publishOverridePolicy?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DesignationRequirementDto)
  designationRequirements?: DesignationRequirementDto[];
}

class UpdateRosterPolicyDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) requiredDailyHeadcount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) workingDaysPerEmployee?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(6) weeklyOffsPerEmployee?: number;
  @IsOptional() shiftDistributionJson?: any;
  @IsOptional() @IsEnum(RoundingPolicy) roundingPolicy?: RoundingPolicy;
  @IsOptional() @IsBoolean() generalBufferEnabled?: boolean;
  @IsOptional() @IsBoolean() allowExtraDuty?: boolean;
  @IsOptional() @IsBoolean() allowOvertime?: boolean;
  @IsOptional() @IsEnum(WeekStartDay) weekStartDay?: WeekStartDay;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minimumRestHours?: number;
  @IsOptional() @IsString() publishOverridePolicy?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DesignationRequirementDto)
  designationRequirements?: DesignationRequirementDto[];
}

function cleanDistribution(value: any) {
  const source = value && typeof value === 'object' ? value : { A: 40, B: 40, C: 20 };
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, raw]) => [String(key).toUpperCase(), Number(raw) || 0])
      .filter(([, raw]) => Number(raw) >= 0),
  );
}

@Injectable()
export class RosterPoliciesService {
  constructor(private prisma: PrismaService) {}

  async list(projectId?: string, locationId?: string) {
    if (locationId) {
      const policy = await this.ensureForLocation(locationId, projectId);
      return [await this.get(policy.id)];
    }
    return this.prisma.rosterPolicy.findMany({
      where: { ...(projectId ? { projectId } : {}), isActive: true },
      include: this.include(),
      orderBy: [{ project: { name: 'asc' } }, { location: { name: 'asc' } }],
    });
  }

  async get(id: string) {
    const policy = await this.prisma.rosterPolicy.findUnique({ where: { id }, include: this.include() });
    if (!policy) throw new BadRequestException('Roster policy not found');
    return {
      ...policy,
      designationRequirements: await this.requirements(policy.projectId, policy.locationId),
    };
  }

  async ensureForLocation(locationId: string, projectId?: string) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId }, include: { project: true } });
    if (!location) throw new BadRequestException('Location not found');
    if (projectId && location.projectId !== projectId) throw new BadRequestException('Location does not belong to the selected project');

    const existing = await this.prisma.rosterPolicy.findUnique({ where: { locationId } });
    if (existing) return existing;

    return this.prisma.rosterPolicy.create({
      data: {
        organizationId: location.project.organizationId,
        projectId: location.projectId,
        locationId,
        requiredDailyHeadcount: 49,
        workingDaysPerEmployee: 6,
        weeklyOffsPerEmployee: 1,
        shiftDistributionJson: { A: 40, B: 40, C: 20 },
        roundingPolicy: RoundingPolicy.LARGEST_REMAINDER_DESIGNATION_PRIORITY,
        generalBufferEnabled: true,
        allowExtraDuty: true,
        allowOvertime: true,
        weekStartDay: WeekStartDay.MONDAY,
      },
    });
  }

  async create(dto: RosterPolicyDto, actor: any) {
    const location = await this.prisma.location.findUnique({ where: { id: dto.locationId }, include: { project: true } });
    if (!location) throw new BadRequestException('Location not found');
    if (location.projectId !== dto.projectId) throw new BadRequestException('Location does not belong to the selected project');
    const organizationId = dto.organizationId ?? location.project.organizationId;

    const data = this.policyData(dto, organizationId, dto.projectId, dto.locationId);
    const policy = await this.prisma.rosterPolicy.upsert({
      where: { locationId: dto.locationId },
      create: data,
      update: data,
    });
    if (dto.designationRequirements) await this.replaceRequirements(policy, dto.designationRequirements, actor);
    await this.audit('ROSTER_POLICY_UPSERT', policy.id, actor, policy);
    return this.get(policy.id);
  }

  async update(id: string, dto: UpdateRosterPolicyDto, actor: any) {
    const previous = await this.prisma.rosterPolicy.findUnique({ where: { id } });
    if (!previous) throw new BadRequestException('Roster policy not found');
    const data: any = {};
    for (const key of [
      'requiredDailyHeadcount',
      'workingDaysPerEmployee',
      'weeklyOffsPerEmployee',
      'roundingPolicy',
      'generalBufferEnabled',
      'allowExtraDuty',
      'allowOvertime',
      'weekStartDay',
      'minimumRestHours',
      'publishOverridePolicy',
      'isActive',
    ]) {
      if ((dto as any)[key] !== undefined) data[key] = (dto as any)[key];
    }
    if (dto.shiftDistributionJson !== undefined) data.shiftDistributionJson = cleanDistribution(dto.shiftDistributionJson);
    const policy = await this.prisma.rosterPolicy.update({ where: { id }, data });
    if (dto.designationRequirements) await this.replaceRequirements(policy, dto.designationRequirements, actor);
    await this.audit('ROSTER_POLICY_UPDATE', id, actor, { previous, updated: policy });
    return this.get(id);
  }

  async remove(id: string, actor: any) {
    const policy = await this.prisma.rosterPolicy.update({ where: { id }, data: { isActive: false } });
    await this.audit('ROSTER_POLICY_DISABLE', id, actor, policy);
    return policy;
  }

  async requirements(projectId: string, locationId: string) {
    return this.prisma.designationRequirement.findMany({
      where: { projectId, locationId, isActive: true },
      include: { shift: true, designation: true },
      orderBy: [{ shift: { code: 'asc' } }, { designation: { level: 'asc' } }],
    });
  }

  async setRequirements(policyId: string, items: DesignationRequirementDto[], actor: any) {
    const policy = await this.prisma.rosterPolicy.findUnique({ where: { id: policyId } });
    if (!policy) throw new BadRequestException('Roster policy not found');
    await this.replaceRequirements(policy, items, actor);
    return this.get(policyId);
  }

  private policyData(dto: RosterPolicyDto, organizationId: string, projectId: string, locationId: string) {
    const workingDays = dto.workingDaysPerEmployee ?? 6;
    return {
      organizationId,
      projectId,
      locationId,
      requiredDailyHeadcount: dto.requiredDailyHeadcount ?? 49,
      workingDaysPerEmployee: workingDays,
      weeklyOffsPerEmployee: dto.weeklyOffsPerEmployee ?? Math.max(0, 7 - workingDays),
      shiftDistributionJson: cleanDistribution(dto.shiftDistributionJson),
      roundingPolicy: dto.roundingPolicy ?? RoundingPolicy.LARGEST_REMAINDER_DESIGNATION_PRIORITY,
      generalBufferEnabled: dto.generalBufferEnabled ?? true,
      allowExtraDuty: dto.allowExtraDuty ?? true,
      allowOvertime: dto.allowOvertime ?? true,
      weekStartDay: dto.weekStartDay ?? WeekStartDay.MONDAY,
      minimumRestHours: dto.minimumRestHours ?? 12,
      publishOverridePolicy: dto.publishOverridePolicy ?? 'CRITICAL_REQUIRES_APPROVAL',
      isActive: dto.isActive ?? true,
    };
  }

  private async replaceRequirements(policy: { projectId: string; locationId: string }, items: DesignationRequirementDto[], actor: any) {
    const validItems = (items ?? []).filter((item) => item.shiftId && item.designationId && Number(item.requiredCount) > 0);
    await this.prisma.$transaction(async (tx) => {
      await tx.designationRequirement.updateMany({
        where: { projectId: policy.projectId, locationId: policy.locationId, isActive: true },
        data: { isActive: false },
      });
      if (validItems.length) {
        await tx.designationRequirement.createMany({
          data: validItems.map((item) => ({
            projectId: policy.projectId,
            locationId: policy.locationId,
            shiftId: item.shiftId,
            designationId: item.designationId,
            requiredCount: item.requiredCount,
            dayType: item.dayType ?? DayType.ANY,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          action: 'DESIGNATION_REQUIREMENTS_UPDATE',
          entityType: 'RosterPolicy',
          entityId: `${policy.projectId}:${policy.locationId}`,
          actorUserId: actor?.userId,
          actorEmail: actor?.email,
          metadata: JSON.parse(JSON.stringify({ items: validItems })),
        },
      });
    });
  }

  private include() {
    return {
      organization: true,
      project: true,
      location: true,
    };
  }

  private audit(action: string, entityId: string, actor: any, metadata: any) {
    return this.prisma.auditLog.create({
      data: {
        action,
        entityType: 'RosterPolicy',
        entityId,
        actorUserId: actor?.userId,
        actorEmail: actor?.email,
        metadata,
      },
    });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roster-policies')
export class RosterPoliciesController {
  constructor(private svc: RosterPoliciesService) {}

  @Get()
  list(@Query('projectId') projectId?: string, @Query('locationId') locationId?: string) {
    return this.svc.list(projectId, locationId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post()
  create(@Body() dto: RosterPolicyDto, @CurrentUser() user: any) {
    return this.svc.create(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRosterPolicyDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Put(':id/designation-requirements')
  setRequirements(@Param('id') id: string, @Body() body: { items: DesignationRequirementDto[] }, @CurrentUser() user: any) {
    return this.svc.setRequirements(id, body.items ?? [], user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, user);
  }
}

@Module({ controllers: [RosterPoliciesController], providers: [RosterPoliciesService], exports: [RosterPoliciesService] })
export class RosterPoliciesModule {}
