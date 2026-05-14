import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { CoverageMode, DayType, EmployeeStatus, RoundingPolicy, ShiftCode, UserRole, WeekStartDay } from '@prisma/client';
import * as XLSX from 'xlsx';
import { Response } from 'express';
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

class MultiLocationDesignationPolicyDto {
  @IsString() @IsNotEmpty() designationId: string;
  @IsEnum(CoverageMode) coverageMode: CoverageMode;
}

class MultiLocationCoverageCellDto {
  @IsString() @IsNotEmpty() locationId: string;
  @IsString() @IsNotEmpty() shiftId: string;
  @IsString() @IsNotEmpty() designationId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) manualCount?: number | null;
  @IsOptional() @IsString() overrideReason?: string | null;
}

class MultiLocationPolicyDto {
  @IsOptional() @IsString() projectId?: string;
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
  @IsOptional() @IsBoolean() projectLevel247Enabled?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MultiLocationDesignationPolicyDto)
  designationPolicies?: MultiLocationDesignationPolicyDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MultiLocationCoverageCellDto)
  cells?: MultiLocationCoverageCellDto[];
}

class GenerateMultiLocationDto extends MultiLocationPolicyDto {
  @IsString() @IsNotEmpty() projectId: string;
}

type CoverageIssue = {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  designationId?: string;
  designationName?: string;
  locationId?: string;
  locationName?: string;
  shiftId?: string;
  shiftCode?: string;
  required?: number;
  actual?: number;
};

type CellStatus = {
  shortageSurplus: number;
  validationStatus: string;
  validationMessage?: string | null;
};

function cleanDistribution(value: any) {
  const source = value && typeof value === 'object' ? value : { A: 40, B: 40, C: 20 };
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, raw]) => [String(key).toUpperCase(), Number(raw) || 0])
      .filter(([, raw]) => Number(raw) >= 0),
  );
}

function effectiveCount(cell: any) {
  return cell.manualCount === null || cell.manualCount === undefined ? Number(cell.suggestedCount ?? 0) : Number(cell.manualCount);
}

function statusRank(status: string) {
  if (status === 'CRITICAL') return 3;
  if (status === 'WARNING') return 2;
  if (status === 'INFO') return 1;
  return 0;
}

const PROJECT_COVERAGE_SHIFT_CODES: ShiftCode[] = [ShiftCode.A, ShiftCode.B, ShiftCode.C];

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

  async getAllLocations(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const policy = await this.ensureMultiLocationPolicy(projectId);
    await this.syncMultiLocationShape(policy.id);
    return this.multiLocationState(policy.id);
  }

  async generateAllLocations(dto: GenerateMultiLocationDto, actor: any) {
    const policy = await this.ensureMultiLocationPolicy(dto.projectId);
    await this.updateAllLocationDraft(policy.id, dto, actor, false);
    await this.recalculateMultiLocation(policy.id, { updateSuggestions: true, actor, action: 'MULTI_LOCATION_POLICY_GENERATE' });
    return this.multiLocationState(policy.id);
  }

  async updateAllLocationPolicy(id: string, dto: MultiLocationPolicyDto, actor: any) {
    await this.updateAllLocationDraft(id, dto, actor, true);
    await this.recalculateMultiLocation(id, { updateSuggestions: false, actor, action: 'MULTI_LOCATION_POLICY_SAVE_DRAFT' });
    const policy = await this.prisma.multiLocationRosterPolicy.findUnique({ where: { id } });
    if (!policy) throw new BadRequestException('All Locations policy not found');
    return this.multiLocationState(id);
  }

  async validateAllLocationPolicy(id: string, actor: any) {
    await this.recalculateMultiLocation(id, { updateSuggestions: false, actor, action: 'MULTI_LOCATION_POLICY_VALIDATE' });
    return this.multiLocationState(id);
  }

  async applyAllLocationPolicy(id: string, actor: any) {
    await this.recalculateMultiLocation(id, { updateSuggestions: false, actor });
    const policy = await this.prisma.multiLocationRosterPolicy.findUnique({ where: { id } });
    if (!policy) throw new BadRequestException('All Locations policy not found');
    const project = await this.prisma.project.findUnique({ where: { id: policy.projectId } });
    if (!project) throw new BadRequestException('Project not found');
    const distribution = cleanDistribution(policy.shiftDistributionJson);
    const allCells = await this.prisma.multiLocationCoverageCell.findMany({
      where: { policyId: id },
      include: { location: true, shift: true },
    });
    const cells = allCells.filter((cell) => (
      PROJECT_COVERAGE_SHIFT_CODES.includes(cell.shift?.code as ShiftCode) &&
      Number(distribution[String(cell.shift?.code)] ?? 0) > 0
    ));
    const locationsToApply = Array.from(new Map(cells.map((cell) => [cell.locationId, cell.location])).values());
    let appliedCells = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const location of locationsToApply) {
        const locationPolicy = await tx.rosterPolicy.upsert({
          where: { locationId: location.id },
          create: {
            organizationId: project.organizationId,
            projectId: policy.projectId,
            locationId: location.id,
            requiredDailyHeadcount: policy.requiredDailyHeadcount,
            workingDaysPerEmployee: policy.workingDaysPerEmployee,
            weeklyOffsPerEmployee: policy.weeklyOffsPerEmployee,
            shiftDistributionJson: policy.shiftDistributionJson as any,
            roundingPolicy: policy.roundingPolicy,
            generalBufferEnabled: policy.generalBufferEnabled,
            allowExtraDuty: policy.allowExtraDuty,
            allowOvertime: policy.allowOvertime,
            weekStartDay: policy.weekStartDay,
            minimumRestHours: policy.minimumRestHours,
          },
          update: {
            requiredDailyHeadcount: policy.requiredDailyHeadcount,
            workingDaysPerEmployee: policy.workingDaysPerEmployee,
            weeklyOffsPerEmployee: policy.weeklyOffsPerEmployee,
            shiftDistributionJson: policy.shiftDistributionJson as any,
            roundingPolicy: policy.roundingPolicy,
            generalBufferEnabled: policy.generalBufferEnabled,
            allowExtraDuty: policy.allowExtraDuty,
            allowOvertime: policy.allowOvertime,
            weekStartDay: policy.weekStartDay,
            minimumRestHours: policy.minimumRestHours,
          },
        });
        const effectiveCells = cells.filter((cell) => cell.locationId === location.id);
        const localShifts = await tx.shift.findMany({
          where: { locationId: location.id, code: { in: PROJECT_COVERAGE_SHIFT_CODES } },
        });
        const localShiftByCode = new Map(localShifts.map((shift) => [String(shift.code), shift.id]));
        const targetShiftIds = Array.from(new Set(effectiveCells.flatMap((cell) => [
          cell.shiftId,
          localShiftByCode.get(String(cell.shift?.code)) ?? cell.shiftId,
        ])));
        await tx.designationRequirement.updateMany({
          where: {
            projectId: policy.projectId,
            locationId: location.id,
            shiftId: { in: targetShiftIds },
            isActive: true,
          },
          data: { isActive: false },
        });
        for (const cell of effectiveCells) {
          const requiredCount = effectiveCount(cell);
          if (requiredCount > 0) {
            await tx.designationRequirement.create({
              data: {
                projectId: policy.projectId,
                locationId: cell.locationId,
                shiftId: localShiftByCode.get(String(cell.shift?.code)) ?? cell.shiftId,
                designationId: cell.designationId,
                requiredCount,
                dayType: DayType.ANY,
              },
            });
          }
          appliedCells += 1;
        }
        await tx.auditLog.create({
          data: {
            action: 'MULTI_LOCATION_POLICY_APPLY_LOCATION',
            entityType: 'RosterPolicy',
            entityId: locationPolicy.id,
            actorUserId: actor?.userId,
            actorEmail: actor?.email,
            metadata: JSON.parse(JSON.stringify({ sourcePolicyId: id, locationId: location.id, appliedCells: effectiveCells.length })),
          },
        });
      }
      await tx.multiLocationRosterPolicy.update({ where: { id }, data: { version: { increment: 1 } } });
    });
    await this.audit('MULTI_LOCATION_POLICY_APPLY', id, actor, {
      appliedLocations: locationsToApply.length,
      appliedCells,
    }, 'MultiLocationRosterPolicy');
    return {
      ...(await this.multiLocationState(id)),
      appliedSummary: { appliedLocations: locationsToApply.length, appliedCells },
    };
  }

  async exportAllLocationPolicy(id: string, actor: any, res: Response) {
    const state = await this.multiLocationState(id);
    const workbook = XLSX.utils.book_new();
    const rows: Record<string, any>[] = [];
    const cells = new Map((state.cells ?? []).map((cell: any) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell]));
    const distribution = cleanDistribution(state.policy?.shiftDistributionJson);
    for (const designation of state.designations) {
      const row: Record<string, any> = { Designation: designation.name };
      for (const location of state.locations) {
        const shifts = (location.shifts ?? []).filter((shift: any) => Number(distribution[shift.code] ?? 0) > 0);
        for (const shift of shifts) {
          const cell = cells.get(`${location.id}:${shift.id}:${designation.id}`);
          const prefix = `${location.name} ${this.shiftLabel(shift)}`;
          row[`${prefix} Available`] = cell?.availableCount ?? 0;
          row[`${prefix} Suggested`] = cell?.suggestedCount ?? 0;
          row[`${prefix} Manual`] = cell?.manualCount ?? '';
          row[`${prefix} Status`] = cell?.validationStatus ?? 'OK';
        }
      }
      rows.push(row);
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'All Locations Matrix');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((state.validationSummary as any)?.issues ?? []), 'Validation');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    await this.audit('MULTI_LOCATION_POLICY_EXPORT', id, actor, { rows: rows.length }, 'MultiLocationRosterPolicy');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="all-locations-policy-${state.policy.projectId}.xlsx"`);
    res.send(buffer);
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

  private async ensureMultiLocationPolicy(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Project not found');
    const existing = await this.prisma.multiLocationRosterPolicy.findUnique({ where: { projectId } });
    if (existing) return existing;
    const base = await this.prisma.rosterPolicy.findFirst({ where: { projectId, isActive: true }, orderBy: { updatedAt: 'desc' } });
    return this.prisma.multiLocationRosterPolicy.create({
      data: {
        projectId,
        requiredDailyHeadcount: base?.requiredDailyHeadcount ?? 49,
        workingDaysPerEmployee: base?.workingDaysPerEmployee ?? 6,
        weeklyOffsPerEmployee: base?.weeklyOffsPerEmployee ?? 1,
        shiftDistributionJson: (base?.shiftDistributionJson as any) ?? { A: 40, B: 40, C: 20 },
        roundingPolicy: base?.roundingPolicy ?? RoundingPolicy.LARGEST_REMAINDER_DESIGNATION_PRIORITY,
        generalBufferEnabled: base?.generalBufferEnabled ?? true,
        allowExtraDuty: base?.allowExtraDuty ?? true,
        allowOvertime: base?.allowOvertime ?? true,
        weekStartDay: base?.weekStartDay ?? WeekStartDay.MONDAY,
        minimumRestHours: base?.minimumRestHours ?? 12,
        projectLevel247Enabled: true,
      },
    });
  }

  private async syncMultiLocationShape(policyId: string) {
    const policy = await this.prisma.multiLocationRosterPolicy.findUnique({ where: { id: policyId } });
    if (!policy) throw new BadRequestException('All Locations policy not found');
    const [locations, designations, availability, shiftTemplates] = await Promise.all([
      this.prisma.location.findMany({ where: { projectId: policy.projectId }, orderBy: { name: 'asc' } }),
      this.prisma.designation.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] }),
      this.availabilityMap(policy.projectId),
      this.projectShiftTemplates(policy.projectId),
    ]);
    await this.prisma.multiLocationDesignationPolicy.createMany({
      data: designations.map((designation) => ({
        policyId,
        designationId: designation.id,
        coverageMode: CoverageMode.PROJECT_SHARED,
      })),
      skipDuplicates: true,
    });
    const operations: any[] = [];
    for (const location of locations) {
      for (const shift of shiftTemplates) {
        for (const designation of designations) {
          const availableCount = availability.get(`${location.id}:${designation.id}`) ?? 0;
          operations.push(this.prisma.multiLocationCoverageCell.upsert({
            where: {
              policyId_locationId_shiftId_designationId: {
                policyId,
                locationId: location.id,
                shiftId: shift.id,
                designationId: designation.id,
              },
            },
            update: { availableCount },
            create: {
              policyId,
              projectId: policy.projectId,
              locationId: location.id,
              shiftId: shift.id,
              designationId: designation.id,
              availableCount,
            },
          }));
        }
      }
    }
    if (operations.length) await this.prisma.$transaction(operations);
  }

  private async multiLocationState(policyId: string) {
    await this.syncMultiLocationShape(policyId);
    const policy = await this.prisma.multiLocationRosterPolicy.findUnique({
      where: { id: policyId },
      include: {
        designationPolicies: { include: { designation: true }, orderBy: { designation: { name: 'asc' } } },
        coverageCells: true,
      },
    });
    if (!policy) throw new BadRequestException('All Locations policy not found');
    const [rawLocations, designations, availabilityRows, shiftTemplates] = await Promise.all([
      this.prisma.location.findMany({ where: { projectId: policy.projectId }, orderBy: { name: 'asc' } }),
      this.prisma.designation.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] }),
      this.availabilityRows(policy.projectId),
      this.projectShiftTemplates(policy.projectId),
    ]);
    const locations = this.withShiftTemplates(rawLocations, shiftTemplates);
    return {
      policy: {
        id: policy.id,
        projectId: policy.projectId,
        requiredDailyHeadcount: policy.requiredDailyHeadcount,
        workingDaysPerEmployee: policy.workingDaysPerEmployee,
        weeklyOffsPerEmployee: policy.weeklyOffsPerEmployee,
        shiftDistributionJson: policy.shiftDistributionJson,
        roundingPolicy: policy.roundingPolicy,
        generalBufferEnabled: policy.generalBufferEnabled,
        allowExtraDuty: policy.allowExtraDuty,
        allowOvertime: policy.allowOvertime,
        weekStartDay: policy.weekStartDay,
        minimumRestHours: policy.minimumRestHours,
        projectLevel247Enabled: policy.projectLevel247Enabled,
        validationSummary: policy.validationSummary,
        version: policy.version,
        isActive: policy.isActive,
      },
      locations,
      shifts: shiftTemplates,
      designations,
      designationPolicies: policy.designationPolicies,
      availability: availabilityRows,
      cells: policy.coverageCells,
      validationSummary: policy.validationSummary ?? { issues: [], criticalCount: 0, warningCount: 0, infoCount: 0 },
    };
  }

  private async updateAllLocationDraft(id: string, dto: MultiLocationPolicyDto, actor: any, audit = true) {
    const existing = await this.prisma.multiLocationRosterPolicy.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('All Locations policy not found');
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
      'projectLevel247Enabled',
    ]) {
      if ((dto as any)[key] !== undefined) data[key] = (dto as any)[key];
    }
    if (dto.shiftDistributionJson !== undefined) data.shiftDistributionJson = cleanDistribution(dto.shiftDistributionJson);
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.multiLocationRosterPolicy.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
      for (const item of dto.designationPolicies ?? []) {
        await tx.multiLocationDesignationPolicy.upsert({
          where: { policyId_designationId: { policyId: id, designationId: item.designationId } },
          create: { policyId: id, designationId: item.designationId, coverageMode: item.coverageMode ?? CoverageMode.PROJECT_SHARED },
          update: { coverageMode: item.coverageMode ?? CoverageMode.PROJECT_SHARED },
        });
      }
      for (const item of dto.cells ?? []) {
        await tx.multiLocationCoverageCell.upsert({
          where: {
            policyId_locationId_shiftId_designationId: {
              policyId: id,
              locationId: item.locationId,
              shiftId: item.shiftId,
              designationId: item.designationId,
            },
          },
          create: {
            policyId: id,
            projectId: existing.projectId,
            locationId: item.locationId,
            shiftId: item.shiftId,
            designationId: item.designationId,
            manualCount: item.manualCount === null || item.manualCount === undefined ? null : Number(item.manualCount),
            overrideReason: item.overrideReason || null,
          },
          update: {
            manualCount: item.manualCount === null || item.manualCount === undefined ? null : Number(item.manualCount),
            overrideReason: item.overrideReason || null,
          },
        });
      }
    });
    if (audit) await this.audit('MULTI_LOCATION_POLICY_SAVE_DRAFT', id, actor, dto, 'MultiLocationRosterPolicy');
  }

  private async recalculateMultiLocation(
    policyId: string,
    options: { updateSuggestions: boolean; actor?: any; action?: string },
  ) {
    await this.syncMultiLocationShape(policyId);
    let policy = await this.prisma.multiLocationRosterPolicy.findUnique({ where: { id: policyId } });
    if (!policy) throw new BadRequestException('All Locations policy not found');
    const [rawLocations, designations, designationPolicies, shiftTemplates] = await Promise.all([
      this.prisma.location.findMany({ where: { projectId: policy.projectId }, orderBy: { name: 'asc' } }),
      this.prisma.designation.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] }),
      this.prisma.multiLocationDesignationPolicy.findMany({ where: { policyId } }),
      this.projectShiftTemplates(policy.projectId),
    ]);
    const locations = this.withShiftTemplates(rawLocations, shiftTemplates);
    const distribution = cleanDistribution(policy.shiftDistributionJson);
    const availability = await this.availabilityMap(policy.projectId);

    if (options.updateSuggestions) {
      const currentCells = await this.prisma.multiLocationCoverageCell.findMany({ where: { policyId } });
      const coverageShifts = this.projectCoverageShifts(shiftTemplates, distribution);
      const suggestions = this.projectSharedSuggestionMap(
        locations,
        designations,
        coverageShifts,
        distribution,
        availability,
        currentCells,
      );
      const updates: any[] = [];
      for (const location of locations) {
        for (const designation of designations) {
          const available = availability.get(`${location.id}:${designation.id}`) ?? 0;
          for (const shift of shiftTemplates) {
            const key = `${location.id}:${shift.id}:${designation.id}`;
            updates.push(this.prisma.multiLocationCoverageCell.updateMany({
              where: { policyId, locationId: location.id, shiftId: shift.id, designationId: designation.id },
              data: {
                availableCount: available,
                suggestedCount: suggestions.get(key) ?? 0,
              },
            }));
          }
        }
      }
      if (updates.length) await this.prisma.$transaction(updates);
    }

    const cells = await this.prisma.multiLocationCoverageCell.findMany({ where: { policyId } });
    const validation = this.validateMatrix(policy, locations, designations, designationPolicies, cells, distribution, availability);
    await this.prisma.$transaction([
      ...Array.from(validation.cellStatuses.entries()).map(([cellId, status]) => this.prisma.multiLocationCoverageCell.update({
        where: { id: cellId },
        data: status,
      })),
      this.prisma.multiLocationRosterPolicy.update({
        where: { id: policyId },
        data: {
          validationSummary: validation.summary as any,
          version: options.updateSuggestions ? { increment: 1 } : undefined,
        } as any,
      }),
    ]);
    if (options.action) await this.audit(options.action, policyId, options.actor, validation.summary, 'MultiLocationRosterPolicy');
  }

  private validateMatrix(
    policy: any,
    locations: any[],
    designations: any[],
    designationPolicies: any[],
    cells: any[],
    distribution: Record<string, number>,
    availability: Map<string, number>,
  ) {
    const issues: CoverageIssue[] = [];
    const cellStatuses = new Map<string, CellStatus>();
    const cellByKey = new Map(cells.map((cell) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell]));
    const modeByDesignation = new Map(designationPolicies.map((row) => [row.designationId, row.coverageMode]));
    const operationalByLocation = new Map(locations.map((location) => [location.id, this.operationalShifts(location.shifts, distribution)]));

    for (const cell of cells) {
      cellStatuses.set(cell.id, {
        shortageSurplus: effectiveCount(cell),
        validationStatus: 'OK',
        validationMessage: null,
      });
    }

    const markCell = (cell: any, status: 'CRITICAL' | 'WARNING' | 'INFO', message: string, shortageSurplus?: number) => {
      if (!cell) return;
      const current = cellStatuses.get(cell.id) ?? { shortageSurplus: effectiveCount(cell), validationStatus: 'OK', validationMessage: null };
      if (statusRank(status) >= statusRank(current.validationStatus)) {
        cellStatuses.set(cell.id, {
          shortageSurplus: shortageSurplus ?? current.shortageSurplus,
          validationStatus: status,
          validationMessage: message,
        });
      }
    };

    const pushIssue = (issue: CoverageIssue) => issues.push(issue);

    for (const designation of designations) {
      const mode = modeByDesignation.get(designation.id) ?? CoverageMode.PROJECT_SHARED;
      const projectAvailable = locations.reduce((sum, location) => sum + (availability.get(`${location.id}:${designation.id}`) ?? 0), 0);
      const locationsWithAvailability = locations.filter((location) => (availability.get(`${location.id}:${designation.id}`) ?? 0) > 0);

      if (designation.isCritical && projectAvailable === 1) {
        pushIssue({
          severity: 'WARNING',
          code: 'SINGLE_PERSON_DEPENDENCY',
          message: `${designation.name} has only one active employee available across the project.`,
          designationId: designation.id,
          designationName: designation.name,
          actual: projectAvailable,
        });
      }
      if (projectAvailable > 0 && locationsWithAvailability.length === 1) {
        pushIssue({
          severity: 'WARNING',
          code: 'PROJECT_LEVEL_DEPENDENCY_RISK',
          message: `${designation.name} is available only in ${locationsWithAvailability[0].name}.`,
          designationId: designation.id,
          designationName: designation.name,
          locationId: locationsWithAvailability[0].id,
          locationName: locationsWithAvailability[0].name,
          actual: projectAvailable,
        });
      }

      for (const location of locations) {
        const shifts = operationalByLocation.get(location.id) ?? [];
        const locationAvailable = availability.get(`${location.id}:${designation.id}`) ?? 0;
        const locationEffectiveTotal = shifts.reduce((sum, shift) => {
          const cell = cellByKey.get(`${location.id}:${shift.id}:${designation.id}`);
          return sum + effectiveCount(cell);
        }, 0);
        if (locationEffectiveTotal > locationAvailable) {
          pushIssue({
            severity: 'CRITICAL',
            code: 'LOCATION_DESIGNATION_OVERALLOCATED',
            message: `${location.name} allocates ${locationEffectiveTotal} ${designation.name}, but only ${locationAvailable} are available.`,
            designationId: designation.id,
            designationName: designation.name,
            locationId: location.id,
            locationName: location.name,
            required: locationEffectiveTotal,
            actual: locationAvailable,
          });
          for (const shift of shifts) {
            markCell(cellByKey.get(`${location.id}:${shift.id}:${designation.id}`), 'CRITICAL', 'Manual/effective counts exceed available employees.', locationEffectiveTotal - locationAvailable);
          }
        }

        if (mode === CoverageMode.LOCATION_MANDATORY) {
          for (const shift of shifts) {
            const cell = cellByKey.get(`${location.id}:${shift.id}:${designation.id}`);
            const effective = effectiveCount(cell);
            const shortage = effective - 1;
            const current = cellStatuses.get(cell?.id);
            if (current) current.shortageSurplus = shortage;
            if (effective < 1) {
              pushIssue({
                severity: 'CRITICAL',
                code: 'MANDATORY_LOCATION_SHIFT_GAP',
                message: `${designation.name} is mandatory but missing for ${this.shiftLabel(shift)} at ${location.name}.`,
                designationId: designation.id,
                designationName: designation.name,
                locationId: location.id,
                locationName: location.name,
                shiftId: shift.id,
                shiftCode: String(shift.code),
                required: 1,
                actual: effective,
              });
              markCell(cell, 'CRITICAL', 'Mandatory designation is missing for this location and shift.', shortage);
            }
          }
        }
      }

      if (mode === CoverageMode.PROJECT_SHARED && policy.projectLevel247Enabled) {
        const activeCodes = Array.from(new Set(locations.flatMap((location) => (operationalByLocation.get(location.id) ?? []).map((shift: any) => String(shift.code)))));
        for (const code of activeCodes) {
          const projectShiftTotal = locations.reduce((sum, location) => {
            const shift = (operationalByLocation.get(location.id) ?? []).find((item: any) => String(item.code) === code);
            if (!shift) return sum;
            return sum + effectiveCount(cellByKey.get(`${location.id}:${shift.id}:${designation.id}`));
          }, 0);
          if (projectShiftTotal < 1) {
            pushIssue({
              severity: 'WARNING',
              code: 'PROJECT_247_SHIFT_GAP',
              message: `${designation.name} has no project-level coverage for ${this.shiftLabel({ code })}.`,
              designationId: designation.id,
              designationName: designation.name,
              shiftCode: code,
              required: 1,
              actual: projectShiftTotal,
            });
            for (const location of locations) {
              const shift = (operationalByLocation.get(location.id) ?? []).find((item: any) => String(item.code) === code);
              if (shift) markCell(cellByKey.get(`${location.id}:${shift.id}:${designation.id}`), 'WARNING', 'No project-level coverage exists for this shift.', -1);
            }
          }
        }
      }

      if (mode === CoverageMode.OPTIONAL_ON_CALL && projectAvailable === 0) {
        pushIssue({
          severity: 'WARNING',
          code: 'OPTIONAL_DESIGNATION_UNAVAILABLE',
          message: `${designation.name} is optional/on-call but has no active project employees.`,
          designationId: designation.id,
          designationName: designation.name,
        });
      }
    }

    const summary = {
      issues,
      criticalCount: issues.filter((issue) => issue.severity === 'CRITICAL').length,
      warningCount: issues.filter((issue) => issue.severity === 'WARNING').length,
      infoCount: issues.filter((issue) => issue.severity === 'INFO').length,
      generatedAt: new Date().toISOString(),
    };
    return { summary, cellStatuses };
  }

  private projectSharedSuggestionMap(
    locations: any[],
    designations: any[],
    shifts: any[],
    distribution: Record<string, number>,
    availability: Map<string, number>,
    cells: any[],
  ) {
    const suggestions = new Map<string, number>();
    const cellByKey = new Map(cells.map((cell) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell]));

    for (const [designationIndex, designation] of designations.entries()) {
      const remainingByLocation = new Map(locations.map((location) => [
        location.id,
        availability.get(`${location.id}:${designation.id}`) ?? 0,
      ]));
      const projectShiftTotals = new Map(shifts.map((shift) => [shift.id, 0]));

      for (const location of locations) {
        for (const shift of shifts) {
          const key = `${location.id}:${shift.id}:${designation.id}`;
          const cell = cellByKey.get(key);
          if (cell?.manualCount === null || cell?.manualCount === undefined) continue;
          const manualCount = Number(cell.manualCount ?? 0);
          remainingByLocation.set(location.id, (remainingByLocation.get(location.id) ?? 0) - manualCount);
          if (manualCount > 0) projectShiftTotals.set(shift.id, (projectShiftTotals.get(shift.id) ?? 0) + manualCount);
        }
      }

      for (const [locationIndex, location] of locations.entries()) {
        const remaining = Math.max(0, remainingByLocation.get(location.id) ?? 0);
        if (remaining <= 0) continue;
        const unlockedShifts = shifts.filter((shift) => {
          const cell = cellByKey.get(`${location.id}:${shift.id}:${designation.id}`);
          return cell?.manualCount === null || cell?.manualCount === undefined;
        });
        if (!unlockedShifts.length) continue;

        const split = remaining >= unlockedShifts.length
          ? this.suggestSplit(remaining, unlockedShifts, distribution, Boolean(designation.isCritical))
          : this.lowCoverageSplit(remaining, unlockedShifts, projectShiftTotals, distribution, designationIndex + locationIndex);

        let assigned = 0;
        for (const shift of unlockedShifts) {
          const count = Number(split[shift.id] ?? 0);
          if (count <= 0) continue;
          const key = `${location.id}:${shift.id}:${designation.id}`;
          suggestions.set(key, count);
          assigned += count;
          projectShiftTotals.set(shift.id, (projectShiftTotals.get(shift.id) ?? 0) + count);
        }
        remainingByLocation.set(location.id, remaining - assigned);
      }

      for (const shift of shifts) {
        if ((projectShiftTotals.get(shift.id) ?? 0) > 0) continue;
        const candidate = [...locations]
          .filter((location) => {
            const cell = cellByKey.get(`${location.id}:${shift.id}:${designation.id}`);
            return (cell?.manualCount === null || cell?.manualCount === undefined) && (remainingByLocation.get(location.id) ?? 0) > 0;
          })
          .sort((a, b) => {
            const remainingDiff = (remainingByLocation.get(b.id) ?? 0) - (remainingByLocation.get(a.id) ?? 0);
            if (remainingDiff !== 0) return remainingDiff;
            return String(a.name).localeCompare(String(b.name));
          })[0];
        if (!candidate) continue;
        const key = `${candidate.id}:${shift.id}:${designation.id}`;
        suggestions.set(key, (suggestions.get(key) ?? 0) + 1);
        remainingByLocation.set(candidate.id, (remainingByLocation.get(candidate.id) ?? 0) - 1);
        projectShiftTotals.set(shift.id, (projectShiftTotals.get(shift.id) ?? 0) + 1);
      }
    }

    return suggestions;
  }

  private lowCoverageSplit(
    available: number,
    shifts: any[],
    projectShiftTotals: Map<string, number>,
    distribution: Record<string, number>,
    offset: number,
  ) {
    const result: Record<string, number> = Object.fromEntries(shifts.map((shift) => [shift.id, 0]));
    const rotated = shifts.length
      ? [...shifts.slice(offset % shifts.length), ...shifts.slice(0, offset % shifts.length)]
      : [];
    const rotationRank = new Map(rotated.map((shift, index) => [shift.id, index]));
    const ordered = [...shifts].sort((a, b) => {
      const totalDiff = (projectShiftTotals.get(a.id) ?? 0) - (projectShiftTotals.get(b.id) ?? 0);
      if (totalDiff !== 0) return totalDiff;
      const distributionDiff = Number(distribution[b.code] ?? 0) - Number(distribution[a.code] ?? 0);
      if (distributionDiff !== 0) return distributionDiff;
      return (rotationRank.get(a.id) ?? 0) - (rotationRank.get(b.id) ?? 0);
    });
    for (let index = 0; index < Math.min(available, ordered.length); index += 1) {
      result[ordered[index].id] = 1;
    }
    return result;
  }

  private projectCoverageShifts(shifts: any[], distribution: Record<string, number>) {
    return this.operationalShifts(shifts, distribution)
      .filter((shift) => PROJECT_COVERAGE_SHIFT_CODES.includes(shift.code as ShiftCode));
  }

  private suggestSplit(available: number, shifts: any[], distribution: Record<string, number>, critical: boolean) {
    const result: Record<string, number> = Object.fromEntries(shifts.map((shift) => [shift.id, 0]));
    if (available <= 0 || shifts.length === 0) return result;
    let remaining = available;
    if (critical && available >= shifts.length) {
      for (const shift of shifts) {
        result[shift.id] = 1;
        remaining -= 1;
      }
    }
    const totalWeight = shifts.reduce((sum, shift) => sum + Number(distribution[shift.code] ?? 0), 0) || shifts.length;
    const rows = shifts.map((shift) => {
      const raw = (remaining * Number(distribution[shift.code] ?? 1)) / totalWeight;
      const floor = Math.floor(raw);
      result[shift.id] += floor;
      return { shift, remainder: raw - floor };
    });
    let assigned = Object.values(result).reduce((sum, value) => sum + value, 0);
    const order = rows.sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      return String(a.shift.code).localeCompare(String(b.shift.code));
    });
    let cursor = 0;
    while (assigned < available && order.length) {
      result[order[cursor % order.length].shift.id] += 1;
      assigned += 1;
      cursor += 1;
    }
    return result;
  }

  private async projectShiftTemplates(projectId: string) {
    const shifts = await this.prisma.shift.findMany({
      where: { location: { projectId } },
      include: { location: true },
      orderBy: [{ priority: 'desc' }, { code: 'asc' }, { name: 'asc' }],
    });
    const byCode = new Map<string, any>();
    for (const shift of shifts) {
      const code = String(shift.code);
      if (!byCode.has(code)) byCode.set(code, shift);
    }
    return Array.from(byCode.values()).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }

  private withShiftTemplates(locations: any[], shiftTemplates: any[]) {
    return locations.map((location) => ({
      ...location,
      shifts: shiftTemplates,
    }));
  }

  private operationalShifts(shifts: any[], distribution: Record<string, number>) {
    return [...(shifts ?? [])]
      .filter((shift) => Number(distribution[shift.code] ?? 0) > 0)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }

  private async availabilityMap(projectId: string) {
    const rows = await this.availabilityRows(projectId);
    return new Map(rows.map((row) => [`${row.locationId}:${row.designationId}`, row.count]));
  }

  private async availabilityRows(projectId: string) {
    const rows = await this.prisma.employee.groupBy({
      by: ['locationId', 'designationId'],
      where: {
        projectId,
        status: EmployeeStatus.ACTIVE,
        locationId: { not: null },
      },
      _count: { _all: true },
    });
    return rows
      .filter((row) => row.locationId)
      .map((row) => ({ locationId: row.locationId, designationId: row.designationId, count: row._count._all }));
  }

  private shiftLabel(shift: any) {
    const code = String(shift?.code ?? '');
    if (code === 'A') return 'Morning';
    if (code === 'B') return 'Afternoon';
    if (code === 'C') return 'Night';
    if (code === 'G') return 'General';
    return shift?.name ?? code;
  }

  private include() {
    return {
      organization: true,
      project: true,
      location: true,
    };
  }

  private audit(action: string, entityId: string, actor: any, metadata: any, entityType = 'RosterPolicy') {
    return this.prisma.auditLog.create({
      data: {
        action,
        entityType,
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

  @Get('all-locations')
  allLocations(@Query('projectId') projectId: string) {
    return this.svc.getAllLocations(projectId);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('all-locations/generate')
  generateAllLocations(@Body() dto: GenerateMultiLocationDto, @CurrentUser() user: any) {
    return this.svc.generateAllLocations(dto, user);
  }

  @Get('all-locations/:id/export')
  exportAllLocations(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    return this.svc.exportAllLocationPolicy(id, user, res);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Put('all-locations/:id')
  updateAllLocations(@Param('id') id: string, @Body() dto: MultiLocationPolicyDto, @CurrentUser() user: any) {
    return this.svc.updateAllLocationPolicy(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('all-locations/:id/validate')
  validateAllLocations(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.validateAllLocationPolicy(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('all-locations/:id/apply')
  applyAllLocations(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.applyAllLocationPolicy(id, user);
  }

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
