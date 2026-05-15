import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { CoverageMode, DayType, EmployeeStatus, RoundingPolicy, ShiftCode, UserRole, WeekStartDay } from '@prisma/client';
import ExcelJS from 'exceljs';
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

type AppliedRequirementRow = {
  locationId: string;
  shiftId: string;
  shiftCode: string;
  designationId: string;
  designationName: string;
  designationLevel: number;
  isCritical: boolean;
  availableCount: number;
  count: number;
  manualLocked: boolean;
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
    const shiftTemplates = await this.projectShiftTemplates(policy.projectId);
    const allCells = await this.prisma.multiLocationCoverageCell.findMany({
      where: {
        policyId: id,
        shiftId: { in: shiftTemplates.map((shift) => shift.id) },
      },
      include: { location: true, shift: true, designation: true },
    });
    const cells = allCells.filter((cell) => (
      PROJECT_COVERAGE_SHIFT_CODES.includes(cell.shift?.code as ShiftCode) &&
      Number(distribution[String(cell.shift?.code)] ?? 0) > 0
    ));
    const locationsToApply = Array.from(new Map(cells.map((cell) => [cell.locationId, cell.location])).values());
    const localShifts = await this.prisma.shift.findMany({
      where: {
        locationId: { in: locationsToApply.map((location) => location.id) },
        code: { in: PROJECT_COVERAGE_SHIFT_CODES },
      },
    });
    const localShiftsByLocation = new Map<string, any[]>();
    for (const shift of localShifts) {
      localShiftsByLocation.set(shift.locationId, [...(localShiftsByLocation.get(shift.locationId) ?? []), shift]);
    }
    const requirementsByLocation = this.appliedRequirementsByLocation(policy, locationsToApply, cells, localShiftsByLocation);
    let appliedCells = 0;
    let appliedRequirements = 0;
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
        const normalizedRequirements = requirementsByLocation.get(location.id) ?? [];
        const targetShiftIds = Array.from(new Set((localShiftsByLocation.get(location.id) ?? []).map((shift) => shift.id)));
        await tx.designationRequirement.updateMany({
          where: {
            projectId: policy.projectId,
            locationId: location.id,
            shiftId: { in: targetShiftIds },
            isActive: true,
          },
          data: { isActive: false },
        });
        if (normalizedRequirements.length) {
          await tx.designationRequirement.createMany({
            data: normalizedRequirements.map((row) => ({
              projectId: policy.projectId,
              locationId: row.locationId,
              shiftId: row.shiftId,
              designationId: row.designationId,
              requiredCount: row.count,
              dayType: DayType.ANY,
            })),
          });
        }
        appliedCells += effectiveCells.length;
        appliedRequirements += normalizedRequirements.length;
        await tx.auditLog.create({
          data: {
            action: 'MULTI_LOCATION_POLICY_APPLY_LOCATION',
            entityType: 'RosterPolicy',
            entityId: locationPolicy.id,
            actorUserId: actor?.userId,
            actorEmail: actor?.email,
            metadata: JSON.parse(JSON.stringify({
              sourcePolicyId: id,
              locationId: location.id,
              appliedCells: effectiveCells.length,
              appliedRequirements: normalizedRequirements.length,
              shiftTargets: this.calculateDailyShiftTargets(localShiftsByLocation.get(location.id) ?? [], policy),
            })),
          },
        });
      }
      await tx.multiLocationRosterPolicy.update({ where: { id }, data: { version: { increment: 1 } } });
    });
    await this.audit('MULTI_LOCATION_POLICY_APPLY', id, actor, {
      appliedLocations: locationsToApply.length,
      appliedCells,
      appliedRequirements,
    }, 'MultiLocationRosterPolicy');
    return {
      ...(await this.multiLocationState(id)),
      appliedSummary: { appliedLocations: locationsToApply.length, appliedCells, appliedRequirements },
    };
  }

  async exportAllLocationPolicy(id: string, actor: any, res: Response) {
    const state = await this.multiLocationState(id);
    const project = await this.prisma.project.findUnique({ where: { id: state.policy.projectId } });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RosterOps';
    workbook.created = new Date();
    workbook.modified = new Date();

    const matrixSheet = workbook.addWorksheet('All Locations Matrix', {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 5, topLeftCell: 'B6', activeCell: 'B6' }],
      properties: { defaultRowHeight: 24 },
    });
    const validationSheet = workbook.addWorksheet('Validation Summary');
    const detailSheet = workbook.addWorksheet('Detailed Data');

    const distribution = cleanDistribution(state.policy?.shiftDistributionJson);
    const cells = new Map((state.cells ?? []).map((cell: any) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell]));
    const locations = state.locations.map((location: any) => ({
      ...location,
      matrixShifts: (location.shifts ?? [])
        .filter((shift: any) => PROJECT_COVERAGE_SHIFT_CODES.includes(shift.code as ShiftCode) && Number(distribution[shift.code] ?? 0) > 0)
        .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code))),
    }));
    const totalColumns = 1 + locations.reduce((sum: number, location: any) => sum + Math.max(1, location.matrixShifts.length), 0);
    const locationHeaderColors = ['DBEAFE', 'D1FAE5', 'EDE9FE', 'FEF3C7', 'FFE4E6', 'CFFAFE', 'ECFCCB', 'FAE8FF'];
    const shiftHeaderColors: Record<string, string> = { A: 'E0F2FE', B: 'FEF3C7', C: 'EDE9FE' };
    const statusColors: Record<string, string> = {
      OK: 'FFFFFF',
      INFO: 'DBEAFE',
      WARNING: 'FEF3C7',
      CRITICAL: 'FEE2E2',
      OVERRIDDEN: 'DCFCE7',
    };
    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
    const setFill = (cell: ExcelJS.Cell, color: string) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    };
    const styleRange = (fromRow: number, toRow: number, fromCol: number, toCol: number, options: {
      fill?: string;
      font?: Partial<ExcelJS.Font>;
      alignment?: Partial<ExcelJS.Alignment>;
    } = {}) => {
      for (let row = fromRow; row <= toRow; row += 1) {
        for (let col = fromCol; col <= toCol; col += 1) {
          const cell = matrixSheet.getCell(row, col);
          cell.border = border;
          if (options.fill) setFill(cell, options.fill);
          if (options.font) cell.font = options.font;
          if (options.alignment) cell.alignment = options.alignment;
        }
      }
    };

    matrixSheet.mergeCells(1, 1, 1, totalColumns);
    const titleCell = matrixSheet.getCell(1, 1);
    titleCell.value = 'All Locations Roster Policy Matrix';
    titleCell.font = { bold: true, size: 16, color: { argb: '0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    matrixSheet.getRow(1).height = 30;

    matrixSheet.mergeCells(2, 1, 2, totalColumns);
    const metaCell = matrixSheet.getCell(2, 1);
    metaCell.value = `Project: ${project?.name ?? state.policy.projectId}    Daily Headcount: ${state.policy.requiredDailyHeadcount}    Distribution: Morning ${distribution.A ?? 0}% / Afternoon ${distribution.B ?? 0}% / Night ${distribution.C ?? 0}%    Generated: ${new Date().toLocaleString('en-IN')}`;
    metaCell.font = { size: 10, color: { argb: '475569' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    matrixSheet.getRow(2).height = 24;

    matrixSheet.getColumn(1).width = 32;
    for (let col = 2; col <= totalColumns; col += 1) matrixSheet.getColumn(col).width = 14;

    matrixSheet.mergeCells(4, 1, 5, 1);
    const designationHeader = matrixSheet.getCell(4, 1);
    designationHeader.value = 'Designation';
    designationHeader.font = { bold: true, color: { argb: '0F172A' } };
    designationHeader.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    setFill(designationHeader, 'F8FAFC');
    designationHeader.border = border;

    let col = 2;
    const locationRanges: { location: any; startCol: number; endCol: number; shifts: any[]; targets: Record<string, number> }[] = [];
    for (const [locationIndex, location] of locations.entries()) {
      const shifts = location.matrixShifts;
      const startCol = col;
      const endCol = col + Math.max(1, shifts.length) - 1;
      locationRanges.push({
        location,
        startCol,
        endCol,
        shifts,
        targets: this.calculateDailyShiftTargets(shifts, state.policy),
      });
      if (startCol < endCol) matrixSheet.mergeCells(4, startCol, 4, endCol);
      const locationCell = matrixSheet.getCell(4, startCol);
      locationCell.value = String(location.name ?? '').toUpperCase();
      locationCell.font = { bold: true, color: { argb: '1E293B' } };
      locationCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      setFill(locationCell, locationHeaderColors[locationIndex % locationHeaderColors.length]);
      styleRange(4, 4, startCol, endCol, {
        fill: locationHeaderColors[locationIndex % locationHeaderColors.length],
        font: { bold: true, color: { argb: '1E293B' } },
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      });

      if (!shifts.length) {
        const shiftCell = matrixSheet.getCell(5, col);
        shiftCell.value = 'No shifts';
        shiftCell.font = { bold: true, color: { argb: '64748B' } };
        shiftCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        shiftCell.border = border;
        setFill(shiftCell, 'F1F5F9');
        col += 1;
        continue;
      }

      for (const shift of shifts) {
        const shiftCell = matrixSheet.getCell(5, col);
        shiftCell.value = this.shiftLabel(shift);
        shiftCell.font = { bold: true, color: { argb: '334155' } };
        shiftCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        shiftCell.border = border;
        setFill(shiftCell, shiftHeaderColors[String(shift.code)] ?? 'F1F5F9');
        col += 1;
      }
    }
    matrixSheet.getRow(4).height = 28;
    matrixSheet.getRow(5).height = 28;

    const firstDataRow = 6;
    for (const [designationIndex, designation] of state.designations.entries()) {
      const rowNumber = firstDataRow + designationIndex;
      const row = matrixSheet.getRow(rowNumber);
      row.height = 24;
      const designationCell = matrixSheet.getCell(rowNumber, 1);
      designationCell.value = designation.name;
      designationCell.font = { bold: true, color: { argb: '0F172A' } };
      designationCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      designationCell.border = border;
      setFill(designationCell, designationIndex % 2 === 0 ? 'FFFFFF' : 'F8FAFC');

      for (const range of locationRanges) {
        let shiftCol = range.startCol;
        for (const shift of range.shifts) {
          const matrixCell = matrixSheet.getCell(rowNumber, shiftCol);
          const sourceCell = cells.get(`${range.location.id}:${shift.id}:${designation.id}`);
          const status = sourceCell?.manualCount !== null && sourceCell?.manualCount !== undefined
            ? 'OVERRIDDEN'
            : String(sourceCell?.validationStatus ?? 'OK');
          matrixCell.value = effectiveCount(sourceCell);
          matrixCell.alignment = { vertical: 'middle', horizontal: 'center' };
          matrixCell.border = status === 'OVERRIDDEN'
            ? { ...border, top: { style: 'medium', color: { argb: '16A34A' } }, bottom: { style: 'medium', color: { argb: '16A34A' } } }
            : border;
          setFill(matrixCell, statusColors[status] ?? 'FFFFFF');
          shiftCol += 1;
        }
      }
    }

    const shiftTotalsRow = firstDataRow + state.designations.length;
    const locationTotalsRow = shiftTotalsRow + 1;
    matrixSheet.getRow(shiftTotalsRow).height = 34;
    matrixSheet.getRow(locationTotalsRow).height = 36;
    matrixSheet.getCell(shiftTotalsRow, 1).value = 'Shift Totals';
    matrixSheet.getCell(locationTotalsRow, 1).value = 'Location Totals';
    styleRange(shiftTotalsRow, locationTotalsRow, 1, 1, {
      fill: 'E2E8F0',
      font: { bold: true, color: { argb: '0F172A' } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    });

    for (const range of locationRanges) {
      let plannedLocationTotal = 0;
      let policyLocationTarget = 0;
      let shiftCol = range.startCol;
      for (const shift of range.shifts) {
        const shiftTotal = state.designations.reduce((sum: number, designation: any) => {
          return sum + effectiveCount(cells.get(`${range.location.id}:${shift.id}:${designation.id}`));
        }, 0);
        const target = Number(range.targets[shift.id] ?? 0);
        plannedLocationTotal += shiftTotal;
        policyLocationTarget += target;
        const totalCell = matrixSheet.getCell(shiftTotalsRow, shiftCol);
        totalCell.value = `${shiftTotal}\nTarget ${target}`;
        totalCell.font = { bold: true, color: { argb: '0F172A' } };
        totalCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        totalCell.border = border;
        setFill(totalCell, shiftTotal === target ? (shiftHeaderColors[String(shift.code)] ?? 'F8FAFC') : 'FEF3C7');
        shiftCol += 1;
      }
      if (range.startCol < range.endCol) matrixSheet.mergeCells(locationTotalsRow, range.startCol, locationTotalsRow, range.endCol);
      const totalCell = matrixSheet.getCell(locationTotalsRow, range.startCol);
      totalCell.value = `Total ${plannedLocationTotal}\nPolicy Target ${policyLocationTarget}`;
      totalCell.font = { bold: true, color: { argb: plannedLocationTotal === policyLocationTarget ? '0F172A' : '991B1B' } };
      totalCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      totalCell.border = border;
      setFill(totalCell, plannedLocationTotal === policyLocationTarget ? 'F8FAFC' : 'FEE2E2');
      styleRange(locationTotalsRow, locationTotalsRow, range.startCol, range.endCol, {
        fill: plannedLocationTotal === policyLocationTarget ? 'F8FAFC' : 'FEE2E2',
        font: { bold: true, color: { argb: plannedLocationTotal === policyLocationTarget ? '0F172A' : '991B1B' } },
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      });
    }

    matrixSheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: shiftTotalsRow - 1, column: totalColumns },
    };

    const issues = (state.validationSummary as any)?.issues ?? [];
    validationSheet.columns = [
      { header: 'Severity', key: 'severity', width: 14 },
      { header: 'Code', key: 'code', width: 32 },
      { header: 'Message', key: 'message', width: 80 },
      { header: 'Location', key: 'locationName', width: 24 },
      { header: 'Shift', key: 'shiftCode', width: 12 },
      { header: 'Designation', key: 'designationName', width: 32 },
      { header: 'Required', key: 'required', width: 12 },
      { header: 'Actual', key: 'actual', width: 12 },
    ];
    validationSheet.addRows(issues.length ? issues : [{ severity: 'OK', code: 'NO_ISSUES', message: 'No validation issues found.' }]);
    this.formatSimpleWorksheet(validationSheet, 'Validation Summary');

    detailSheet.columns = [
      { header: 'Location', key: 'location', width: 24 },
      { header: 'Shift', key: 'shift', width: 18 },
      { header: 'Designation', key: 'designation', width: 32 },
      { header: 'Available', key: 'available', width: 12 },
      { header: 'Suggested', key: 'suggested', width: 12 },
      { header: 'Manual', key: 'manual', width: 12 },
      { header: 'Effective', key: 'effective', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Message', key: 'message', width: 60 },
    ];
    for (const location of locations) {
      for (const shift of location.matrixShifts) {
        for (const designation of state.designations) {
          const cell = cells.get(`${location.id}:${shift.id}:${designation.id}`);
          detailSheet.addRow({
            location: location.name,
            shift: this.shiftLabel(shift),
            designation: designation.name,
            available: cell?.availableCount ?? 0,
            suggested: cell?.suggestedCount ?? 0,
            manual: cell?.manualCount ?? '',
            effective: effectiveCount(cell),
            status: cell?.manualCount !== null && cell?.manualCount !== undefined ? 'OVERRIDDEN' : cell?.validationStatus ?? 'OK',
            message: cell?.validationMessage ?? '',
          });
        }
      }
    }
    this.formatSimpleWorksheet(detailSheet, 'Detailed Data');

    const buffer = await workbook.xlsx.writeBuffer();
    await this.audit('MULTI_LOCATION_POLICY_EXPORT', id, actor, {
      rows: state.designations.length,
      locations: locations.length,
      columns: totalColumns,
      issues: issues.length,
    }, 'MultiLocationRosterPolicy');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="all-locations-policy-${state.policy.projectId}.xlsx"`);
    res.send(Buffer.from(buffer));
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
    await this.prisma.multiLocationCoverageCell.deleteMany({
      where: {
        policyId,
        OR: [
          { shiftId: { notIn: shiftTemplates.map((shift) => shift.id) } },
          { locationId: { notIn: locations.map((location) => location.id) } },
          { designationId: { notIn: designations.map((designation) => designation.id) } },
        ],
      },
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
        policy,
        locations,
        designations,
        designationPolicies,
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

      for (const location of locations) {
        const shifts = operationalByLocation.get(location.id) ?? [];
        const locationAvailable = availability.get(`${location.id}:${designation.id}`) ?? 0;
        const locationEffectiveTotal = shifts.reduce((sum, shift) => {
          const cell = cellByKey.get(`${location.id}:${shift.id}:${designation.id}`);
          return sum + effectiveCount(cell);
        }, 0);
        if (mode === CoverageMode.LOCATION_MANDATORY && locationEffectiveTotal > locationAvailable) {
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
    policy: any,
    locations: any[],
    designations: any[],
    designationPolicies: any[],
    shifts: any[],
    distribution: Record<string, number>,
    availability: Map<string, number>,
    cells: any[],
  ) {
    const suggestions = new Map<string, number>();
    const cellByKey = new Map(cells.map((cell) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell]));

    for (const designation of designations) {
      const remainingByLocation = new Map(locations.map((location) => [
        location.id,
        availability.get(`${location.id}:${designation.id}`) ?? 0,
      ]));

      for (const location of locations) {
        for (const shift of shifts) {
          const key = `${location.id}:${shift.id}:${designation.id}`;
          const cell = cellByKey.get(key);
          if (cell?.manualCount === null || cell?.manualCount === undefined) continue;
          const manualCount = Number(cell.manualCount ?? 0);
          remainingByLocation.set(location.id, (remainingByLocation.get(location.id) ?? 0) - manualCount);
        }
      }

      for (const location of locations) {
        const remaining = Math.max(0, remainingByLocation.get(location.id) ?? 0);
        if (remaining <= 0) continue;
        const unlockedShifts = shifts.filter((shift) => {
          const cell = cellByKey.get(`${location.id}:${shift.id}:${designation.id}`);
          return cell?.manualCount === null || cell?.manualCount === undefined;
        });
        if (!unlockedShifts.length) continue;

        const split = this.suggestSplit(remaining, unlockedShifts, distribution);
        for (const shift of unlockedShifts) {
          const count = Number(split[shift.id] ?? 0);
          if (count <= 0) continue;
          const key = `${location.id}:${shift.id}:${designation.id}`;
          suggestions.set(key, count);
        }
      }
    }

    this.ensureProjectSharedShiftCoverage(policy, locations, designations, designationPolicies, shifts, distribution, availability, cells, suggestions);

    return this.normalizeSuggestionsToPolicyTargets(policy, locations, designations, shifts, distribution, availability, cells, suggestions);
  }

  private ensureProjectSharedShiftCoverage(
    policy: any,
    locations: any[],
    designations: any[],
    designationPolicies: any[],
    shifts: any[],
    distribution: Record<string, number>,
    availability: Map<string, number>,
    cells: any[],
    suggestions: Map<string, number>,
  ) {
    if (!policy.projectLevel247Enabled) return;
    const cellByKey = new Map(cells.map((cell) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell]));
    const modeByDesignation = new Map(designationPolicies.map((row) => [row.designationId, row.coverageMode]));
    const generatedCount = (locationId: string, shiftId: string, designationId: string) => {
      const key = `${locationId}:${shiftId}:${designationId}`;
      const cell = cellByKey.get(key);
      if (!cell) return 0;
      if (cell.manualCount !== null && cell.manualCount !== undefined) return Number(cell.manualCount ?? 0);
      return Number(suggestions.get(key) ?? 0);
    };
    const setGeneratedCount = (locationId: string, shiftId: string, designationId: string, value: number) => {
      const key = `${locationId}:${shiftId}:${designationId}`;
      const cell = cellByKey.get(key);
      if (!cell || cell.manualCount !== null && cell.manualCount !== undefined) return;
      if (value > 0) suggestions.set(key, value);
      else suggestions.delete(key);
    };
    const projectShiftTotal = (shiftId: string, designationId: string) => locations.reduce((sum, location) => {
      return sum + generatedCount(location.id, shiftId, designationId);
    }, 0);

    for (const designation of designations) {
      const mode = modeByDesignation.get(designation.id) ?? CoverageMode.PROJECT_SHARED;
      if (mode !== CoverageMode.PROJECT_SHARED) continue;
      const projectAvailable = locations.reduce((sum, location) => {
        return sum + (availability.get(`${location.id}:${designation.id}`) ?? 0);
      }, 0);
      if (projectAvailable <= 0) continue;

      const projectTarget = this.suggestSplit(projectAvailable, shifts, distribution);
      let guard = 0;
      while (guard < 1000) {
        guard += 1;
        const deficits = shifts
          .map((shift) => ({
            shift,
            deficit: Number(projectTarget[shift.id] ?? 0) - projectShiftTotal(shift.id, designation.id),
          }))
          .filter((row) => row.deficit > 0)
          .sort((a, b) => {
            if (b.deficit !== a.deficit) return b.deficit - a.deficit;
            return String(a.shift.code).localeCompare(String(b.shift.code));
          });
        if (!deficits.length) break;

        let moved = false;
        for (const { shift: targetShift } of deficits) {
          const donors = shifts
            .filter((shift) => shift.id !== targetShift.id)
            .map((shift) => ({
              shift,
              surplus: projectShiftTotal(shift.id, designation.id) - Number(projectTarget[shift.id] ?? 0),
            }))
            .filter((row) => row.surplus > 0)
            .sort((a, b) => {
              if (b.surplus !== a.surplus) return b.surplus - a.surplus;
              return String(a.shift.code).localeCompare(String(b.shift.code));
            });

          for (const { shift: donorShift } of donors) {
            const candidate = locations
              .map((location) => {
                const available = availability.get(`${location.id}:${designation.id}`) ?? 0;
                const targetCell = cellByKey.get(`${location.id}:${targetShift.id}:${designation.id}`);
                const donorCell = cellByKey.get(`${location.id}:${donorShift.id}:${designation.id}`);
                const targetCount = generatedCount(location.id, targetShift.id, designation.id);
                const donorCount = generatedCount(location.id, donorShift.id, designation.id);
                if (available <= 0 || available >= shifts.length) return null;
                if (!targetCell || !donorCell) return null;
                if (targetCell.manualCount !== null && targetCell.manualCount !== undefined) return null;
                if (donorCell.manualCount !== null && donorCell.manualCount !== undefined) return null;
                if (targetCount > 0 || donorCount <= 0) return null;
                return { location, available, targetCount, donorCount };
              })
              .filter(Boolean)
              .sort((a: any, b: any) => {
                if (b.donorCount !== a.donorCount) return b.donorCount - a.donorCount;
                return String(a.location.name).localeCompare(String(b.location.name));
              })[0] as any;

            if (!candidate) continue;
            setGeneratedCount(candidate.location.id, donorShift.id, designation.id, candidate.donorCount - 1);
            setGeneratedCount(candidate.location.id, targetShift.id, designation.id, candidate.targetCount + 1);
            moved = true;
            break;
          }
          if (moved) break;
        }
        if (!moved) break;
      }

      for (const targetShift of shifts) {
        if (projectAvailable < shifts.length || projectShiftTotal(targetShift.id, designation.id) > 0) continue;

        const candidates = locations
          .map((location) => {
            const targetCell = cellByKey.get(`${location.id}:${targetShift.id}:${designation.id}`);
            if (!targetCell || targetCell.manualCount !== null && targetCell.manualCount !== undefined) return null;
            const available = availability.get(`${location.id}:${designation.id}`) ?? 0;
            if (available <= 0) return null;
            const locationTotal = shifts.reduce((sum, shift) => sum + generatedCount(location.id, shift.id, designation.id), 0);
            const donor = shifts
              .filter((shift) => shift.id !== targetShift.id)
              .map((shift) => {
                const donorCell = cellByKey.get(`${location.id}:${shift.id}:${designation.id}`);
                const donorCount = generatedCount(location.id, shift.id, designation.id);
                return {
                  shift,
                  donorCell,
                  donorCount,
                  projectTotal: projectShiftTotal(shift.id, designation.id),
                };
              })
              .filter((row) => row.donorCell?.manualCount === null || row.donorCell?.manualCount === undefined)
              .filter((row) => row.donorCount > 0 && row.projectTotal > 1)
              .sort((a, b) => {
                if (b.donorCount !== a.donorCount) return b.donorCount - a.donorCount;
                if (b.projectTotal !== a.projectTotal) return b.projectTotal - a.projectTotal;
                return String(a.shift.code).localeCompare(String(b.shift.code));
              })[0];
            return {
              location,
              available,
              locationTotal,
              donor,
              spareCapacity: Math.max(0, available - locationTotal),
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => {
            if (b.spareCapacity !== a.spareCapacity) return b.spareCapacity - a.spareCapacity;
            if (Number(Boolean(b.donor)) !== Number(Boolean(a.donor))) return Number(Boolean(b.donor)) - Number(Boolean(a.donor));
            const donorDiff = Number(b.donor?.donorCount ?? 0) - Number(a.donor?.donorCount ?? 0);
            if (donorDiff !== 0) return donorDiff;
            return String(a.location.name).localeCompare(String(b.location.name));
          }) as any[];

        const candidate = candidates[0];
        if (!candidate) continue;
        const currentTarget = generatedCount(candidate.location.id, targetShift.id, designation.id);
        if (candidate.spareCapacity > 0) {
          setGeneratedCount(candidate.location.id, targetShift.id, designation.id, currentTarget + 1);
          continue;
        }
        if (candidate.donor) {
          setGeneratedCount(candidate.location.id, candidate.donor.shift.id, designation.id, candidate.donor.donorCount - 1);
          setGeneratedCount(candidate.location.id, targetShift.id, designation.id, currentTarget + 1);
        }
      }
    }
  }

  private normalizeSuggestionsToPolicyTargets(
    policy: any,
    locations: any[],
    designations: any[],
    shifts: any[],
    distribution: Record<string, number>,
    availability: Map<string, number>,
    cells: any[],
    suggestions: Map<string, number>,
  ) {
    const cellByKey = new Map(cells.map((cell) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell]));
    const rows: AppliedRequirementRow[] = [];
    const rowsByLocationShift = new Map<string, AppliedRequirementRow[]>();
    const projectShiftDesignationTotals = new Map<string, number>();
    const locationDesignationTotals = new Map<string, number>();

    const addRow = (row: AppliedRequirementRow) => {
      rows.push(row);
      rowsByLocationShift.set(`${row.locationId}:${row.shiftId}`, [...(rowsByLocationShift.get(`${row.locationId}:${row.shiftId}`) ?? []), row]);
      projectShiftDesignationTotals.set(`${row.shiftCode}:${row.designationId}`, (projectShiftDesignationTotals.get(`${row.shiftCode}:${row.designationId}`) ?? 0) + row.count);
      locationDesignationTotals.set(`${row.locationId}:${row.designationId}`, (locationDesignationTotals.get(`${row.locationId}:${row.designationId}`) ?? 0) + row.count);
    };

    for (const location of locations) {
      for (const shift of shifts) {
        for (const designation of designations) {
          const key = `${location.id}:${shift.id}:${designation.id}`;
          const cell = cellByKey.get(key);
          if (!cell) continue;
          const manualLocked = cell.manualCount !== null && cell.manualCount !== undefined;
          addRow({
            locationId: location.id,
            shiftId: shift.id,
            shiftCode: String(shift.code),
            designationId: designation.id,
            designationName: designation.name ?? '',
            designationLevel: Number(designation.level ?? 0),
            isCritical: Boolean(designation.isCritical),
            availableCount: availability.get(`${location.id}:${designation.id}`) ?? Number(cell.availableCount ?? 0),
            count: Math.max(0, manualLocked ? Number(cell.manualCount ?? 0) : Number(suggestions.get(key) ?? 0)),
            manualLocked,
          });
        }
      }
    }

    for (const location of locations) {
      const dailyTargets = this.calculateDailyShiftTargets(shifts, policy);
      for (const shift of shifts) {
        this.fitRequirementRowsToShiftTarget(
          rowsByLocationShift.get(`${location.id}:${shift.id}`) ?? [],
          Number(dailyTargets[shift.id] ?? 0),
          projectShiftDesignationTotals,
          locationDesignationTotals,
        );
      }
    }

    const normalized = new Map<string, number>();
    for (const row of rows) {
      if (row.manualLocked || row.count <= 0) continue;
      normalized.set(`${row.locationId}:${row.shiftId}:${row.designationId}`, row.count);
    }
    return normalized;
  }

  private appliedRequirementsByLocation(
    policy: any,
    locations: any[],
    cells: any[],
    localShiftsByLocation: Map<string, any[]>,
  ) {
    const distribution = cleanDistribution(policy.shiftDistributionJson);
    const rows: AppliedRequirementRow[] = [];
    const rowsByLocationShift = new Map<string, AppliedRequirementRow[]>();
    const projectShiftDesignationTotals = new Map<string, number>();
    const locationDesignationTotals = new Map<string, number>();

    const addRow = (row: AppliedRequirementRow) => {
      rows.push(row);
      const groupKey = `${row.locationId}:${row.shiftId}`;
      rowsByLocationShift.set(groupKey, [...(rowsByLocationShift.get(groupKey) ?? []), row]);
      const projectKey = `${row.shiftCode}:${row.designationId}`;
      projectShiftDesignationTotals.set(projectKey, (projectShiftDesignationTotals.get(projectKey) ?? 0) + row.count);
      const locationDesignationKey = `${row.locationId}:${row.designationId}`;
      locationDesignationTotals.set(locationDesignationKey, (locationDesignationTotals.get(locationDesignationKey) ?? 0) + row.count);
    };

    for (const location of locations) {
      const localShifts = this.operationalShifts(localShiftsByLocation.get(location.id) ?? [], distribution)
        .filter((shift) => PROJECT_COVERAGE_SHIFT_CODES.includes(shift.code as ShiftCode));
      const localShiftByCode = new Map(localShifts.map((shift) => [String(shift.code), shift]));

      for (const cell of cells.filter((item) => item.locationId === location.id)) {
        const shiftCode = String(cell.shift?.code ?? '');
        const localShift = localShiftByCode.get(shiftCode);
        if (!localShift) continue;
        addRow({
          locationId: location.id,
          shiftId: localShift.id,
          shiftCode,
          designationId: cell.designationId,
          designationName: cell.designation?.name ?? '',
          designationLevel: Number(cell.designation?.level ?? 0),
          isCritical: Boolean(cell.designation?.isCritical),
          availableCount: Number(cell.availableCount ?? 0),
          count: Math.max(0, effectiveCount(cell)),
          manualLocked: cell.manualCount !== null && cell.manualCount !== undefined,
        });
      }
    }

    for (const location of locations) {
      const localShifts = this.operationalShifts(localShiftsByLocation.get(location.id) ?? [], distribution)
        .filter((shift) => PROJECT_COVERAGE_SHIFT_CODES.includes(shift.code as ShiftCode));
      const dailyTargets = this.calculateDailyShiftTargets(localShifts, policy);
      for (const shift of localShifts) {
        this.fitRequirementRowsToShiftTarget(
          rowsByLocationShift.get(`${location.id}:${shift.id}`) ?? [],
          Number(dailyTargets[shift.id] ?? 0),
          projectShiftDesignationTotals,
          locationDesignationTotals,
        );
      }
    }

    const byLocation = new Map<string, AppliedRequirementRow[]>();
    for (const row of rows.filter((item) => item.count > 0)) {
      byLocation.set(row.locationId, [...(byLocation.get(row.locationId) ?? []), row]);
    }
    return byLocation;
  }

  private fitRequirementRowsToShiftTarget(
    rows: AppliedRequirementRow[],
    target: number,
    projectShiftDesignationTotals: Map<string, number>,
    locationDesignationTotals: Map<string, number>,
  ) {
    let total = rows.reduce((sum, row) => sum + row.count, 0);
    let guard = 0;

    const projectKey = (row: AppliedRequirementRow) => `${row.shiftCode}:${row.designationId}`;
    const locationDesignationKey = (row: AppliedRequirementRow) => `${row.locationId}:${row.designationId}`;
    const decrement = (row: AppliedRequirementRow) => {
      row.count -= 1;
      projectShiftDesignationTotals.set(projectKey(row), Math.max(0, (projectShiftDesignationTotals.get(projectKey(row)) ?? 0) - 1));
      locationDesignationTotals.set(locationDesignationKey(row), Math.max(0, (locationDesignationTotals.get(locationDesignationKey(row)) ?? 0) - 1));
      total -= 1;
    };
    const increment = (row: AppliedRequirementRow) => {
      row.count += 1;
      projectShiftDesignationTotals.set(projectKey(row), (projectShiftDesignationTotals.get(projectKey(row)) ?? 0) + 1);
      locationDesignationTotals.set(locationDesignationKey(row), (locationDesignationTotals.get(locationDesignationKey(row)) ?? 0) + 1);
      total += 1;
    };

    while (total > target && guard < 10000) {
      guard += 1;
      const candidates = rows
        .filter((row) => row.count > 0)
        .filter((row) => (projectShiftDesignationTotals.get(projectKey(row)) ?? 0) > 1)
        .sort((a, b) => {
          if (Number(a.manualLocked) !== Number(b.manualLocked)) return Number(a.manualLocked) - Number(b.manualLocked);
          if (b.count !== a.count) return b.count - a.count;
          if (Number(a.isCritical) !== Number(b.isCritical)) return Number(a.isCritical) - Number(b.isCritical);
          if (b.designationLevel !== a.designationLevel) return b.designationLevel - a.designationLevel;
          return a.designationName.localeCompare(b.designationName);
        });
      if (!candidates.length) break;
      decrement(candidates[0]);
    }

    while (total < target && guard < 20000) {
      guard += 1;
      let candidates = rows
        .filter((row) => !row.manualLocked)
        .filter((row) => {
          const used = locationDesignationTotals.get(locationDesignationKey(row)) ?? 0;
          return row.availableCount <= 0 ? row.count > 0 : used < row.availableCount;
        });
      if (!candidates.length) {
        candidates = rows.filter((row) => {
          const used = locationDesignationTotals.get(locationDesignationKey(row)) ?? 0;
          return row.availableCount <= 0 ? row.count > 0 : used < row.availableCount;
        });
      }
      if (!candidates.length) candidates = rows;
      if (!candidates.length) break;
      candidates.sort((a, b) => {
        const aRemaining = a.availableCount - (locationDesignationTotals.get(locationDesignationKey(a)) ?? 0);
        const bRemaining = b.availableCount - (locationDesignationTotals.get(locationDesignationKey(b)) ?? 0);
        if (bRemaining !== aRemaining) return bRemaining - aRemaining;
        if (Number(b.isCritical) !== Number(a.isCritical)) return Number(b.isCritical) - Number(a.isCritical);
        if (a.count !== b.count) return a.count - b.count;
        if (a.designationLevel !== b.designationLevel) return a.designationLevel - b.designationLevel;
        return a.designationName.localeCompare(b.designationName);
      });
      increment(candidates[0]);
    }
  }

  private calculateDailyShiftTargets(shifts: any[], policy: any) {
    const distribution = cleanDistribution(policy.shiftDistributionJson);
    const operationalShifts = this.operationalShifts(shifts, distribution)
      .filter((shift) => PROJECT_COVERAGE_SHIFT_CODES.includes(shift.code as ShiftCode));
    const dailyTargets: Record<string, number> = Object.fromEntries(operationalShifts.map((shift) => [shift.id, 0]));
    const requiredDailyHeadcount = Number(policy.requiredDailyHeadcount ?? 49);
    const distributionTotal = operationalShifts.reduce((sum, shift) => sum + Number(distribution[shift.code] ?? 0), 0);
    if (requiredDailyHeadcount <= 0 || distributionTotal <= 0) return dailyTargets;

    const rawRows = operationalShifts.map((shift) => {
      const raw = (requiredDailyHeadcount * Number(distribution[shift.code] ?? 0)) / distributionTotal;
      return {
        shift,
        shiftId: shift.id,
        floor: Math.floor(raw),
        rounded: Math.round(raw),
        remainder: raw - Math.floor(raw),
      };
    });

    if (policy.roundingPolicy === RoundingPolicy.LARGEST_REMAINDER) {
      for (const row of rawRows) dailyTargets[row.shiftId] = row.floor;
      let total = Object.values(dailyTargets).reduce((sum, value) => sum + value, 0);
      const remainderOrder = [...rawRows].sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        if ((b.shift.priority ?? 0) !== (a.shift.priority ?? 0)) return (b.shift.priority ?? 0) - (a.shift.priority ?? 0);
        return String(a.shift.code).localeCompare(String(b.shift.code));
      });
      let cursor = 0;
      while (total < requiredDailyHeadcount && remainderOrder.length > 0) {
        const row = remainderOrder[cursor % remainderOrder.length];
        dailyTargets[row.shiftId] += 1;
        total += 1;
        cursor += 1;
      }
    } else {
      for (const row of rawRows) dailyTargets[row.shiftId] = row.rounded;
    }

    let total = Object.values(dailyTargets).reduce((sum, value) => sum + value, 0);
    const downOrder = [...operationalShifts].sort((a, b) => {
      if ((a.priority ?? 0) !== (b.priority ?? 0)) return (a.priority ?? 0) - (b.priority ?? 0);
      const aDistribution = Number(distribution[a.code] ?? 0);
      const bDistribution = Number(distribution[b.code] ?? 0);
      if (aDistribution !== bDistribution) return aDistribution - bDistribution;
      return String(b.code).localeCompare(String(a.code));
    });
    while (total > requiredDailyHeadcount) {
      const candidate = downOrder.find((shift) => dailyTargets[shift.id] > 0);
      if (!candidate) break;
      dailyTargets[candidate.id] -= 1;
      total -= 1;
    }

    const upOrder = [...operationalShifts].sort((a, b) => {
      if ((a.priority ?? 0) !== (b.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
      const aDistribution = Number(distribution[a.code] ?? 0);
      const bDistribution = Number(distribution[b.code] ?? 0);
      if (aDistribution !== bDistribution) return bDistribution - aDistribution;
      return String(a.code).localeCompare(String(b.code));
    });
    while (total < requiredDailyHeadcount && upOrder.length > 0) {
      const candidate = upOrder[(requiredDailyHeadcount - total - 1) % upOrder.length];
      dailyTargets[candidate.id] += 1;
      total += 1;
    }
    return dailyTargets;
  }

  private projectCoverageShifts(shifts: any[], distribution: Record<string, number>) {
    return this.operationalShifts(shifts, distribution)
      .filter((shift) => PROJECT_COVERAGE_SHIFT_CODES.includes(shift.code as ShiftCode));
  }

  private suggestSplit(available: number, shifts: any[], distribution: Record<string, number>) {
    const result: Record<string, number> = Object.fromEntries(shifts.map((shift) => [shift.id, 0]));
    if (available <= 0 || shifts.length === 0) return result;
    const totalWeight = shifts.reduce((sum, shift) => sum + Number(distribution[shift.code] ?? 0), 0) || shifts.length;
    const rows = shifts.map((shift) => {
      const raw = (available * Number(distribution[shift.code] ?? 1)) / totalWeight;
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
    });
    const ordered = [...shifts].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const codeDiff = String(a.code).localeCompare(String(b.code));
      if (codeDiff !== 0) return codeDiff;
      const nameDiff = String(a.name).localeCompare(String(b.name));
      if (nameDiff !== 0) return nameDiff;
      const locationDiff = String(a.location?.name ?? '').localeCompare(String(b.location?.name ?? ''));
      if (locationDiff !== 0) return locationDiff;
      return String(a.id).localeCompare(String(b.id));
    });
    const byCode = new Map<string, any>();
    for (const shift of ordered) {
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

  private formatSimpleWorksheet(sheet: ExcelJS.Worksheet, title: string) {
    sheet.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }];
    sheet.getRow(1).height = 24;
    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
    const statusColors: Record<string, string> = {
      OK: 'FFFFFF',
      INFO: 'DBEAFE',
      WARNING: 'FEF3C7',
      CRITICAL: 'FEE2E2',
      OVERRIDDEN: 'DCFCE7',
      NO_ISSUES: 'DCFCE7',
    };
    const severityColumn = sheet.columns.findIndex((column) => column.key === 'severity') + 1;
    const statusColumn = sheet.columns.findIndex((column) => column.key === 'status') + 1;

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: '0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      cell.border = border;
    });
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.height = 22;
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: rowNumber === 1 ? 'center' : 'left', wrapText: true };
        cell.border = border;
      });
      const statusCell = severityColumn > 0 ? row.getCell(severityColumn) : statusColumn > 0 ? row.getCell(statusColumn) : null;
      const status = String(statusCell?.value ?? '').toUpperCase();
      if (statusCell && statusColors[status]) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[status] } };
        statusCell.font = { bold: true, color: { argb: status === 'CRITICAL' ? '991B1B' : '0F172A' } };
      }
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: Math.max(1, sheet.columnCount) },
    };
    sheet.name = title.slice(0, 31);
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
