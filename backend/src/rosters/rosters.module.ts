import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { createHash } from 'crypto';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  getDay,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import {
  AssignmentSource,
  DayType,
  EmployeeStatus,
  LeaveStatus,
  OverrideSeverity,
  OverrideStatus,
  ReplacementSource,
  ReplacementStatus,
  RoundingPolicy,
  RosterEntryType,
  RosterStatus,
  RosterWeekStatus,
  ShiftCode,
  UserRole,
  WeeklyGroup,
  WorkforceCategory,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles.guard';
import { getAllowedLocationIds } from '../auth/location-access';
import { RosterPoliciesModule, RosterPoliciesService } from '../roster-policies/roster-policies.module';

class GenerateDto {
  @IsString() @IsNotEmpty() locationId: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() mode?: 'overwrite' | 'fill-gaps';
}

class WeeklyPreviewDto {
  @IsOptional() @IsString() projectId?: string;
  @IsString() @IsNotEmpty() locationId: string;
  @IsOptional() @IsDateString() weekStart?: string;
  @IsOptional() @IsDateString() weekStartDate?: string;
  @IsOptional() @IsString() mode?: 'overwrite' | 'fill-gaps';
  @IsOptional() simulation?: {
    requiredDailyHeadcount?: number;
    workingDaysPerEmployee?: number;
    weeklyOffsPerEmployee?: number;
    shiftDistributionJson?: Record<string, number>;
    roundingPolicy?: RoundingPolicy;
  };
}

class PeriodPreviewDto {
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) locationIds?: string[];
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() period?: RosterReportPeriod | string;
  @IsOptional() @IsString() scope?: RosterReportScope | string;
}

class AssignDto {
  @IsString() @IsNotEmpty() employeeId: string;
  @IsString() @IsNotEmpty() shiftId: string;
  @IsDateString() date: string;
  @IsOptional() @IsString() notes?: string;
}

class OverrideDto {
  @IsString() @IsNotEmpty() reason: string;
  @IsOptional() @IsEnum(OverrideSeverity) severity?: OverrideSeverity;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() oldValue?: any;
  @IsOptional() newValue?: any;
}

type RosterReportPeriod = 'week' | 'month' | 'three-month';
type RosterReportScope = 'location' | 'all';
type RosterReportParams = {
  projectId?: string;
  locationId?: string;
  locationIds?: string[] | string;
  startDate: string;
  endDate: string;
  period?: RosterReportPeriod | string;
  scope?: RosterReportScope | string;
  // Location ids the requesting user is allowed to see; `null` = unrestricted (admin),
  // `undefined` = no restriction applied (internal/trusted call). See auth/location-access.ts.
  allowedLocationIds?: string[] | null;
};

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';
type Issue = {
  severity: Severity;
  code: string;
  message: string;
  recommendation?: string;
  shiftId?: string;
  shiftCode?: string;
  designationId?: string;
  designationName?: string;
  date?: string;
  required?: number;
  actual?: number;
};

type ShiftRule = {
  id: string;
  code: ShiftCode;
  name: string;
  startTime: string;
  endTime: string;
  type: string;
  distribution: number;
  priority: number;
  locationId: string;
  requirements: {
    designationId: string;
    minCount: number;
    designation: { id: string; name: string; level: number; isCritical: boolean };
  }[];
};

type EmployeeRule = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  status: EmployeeStatus;
  joinDate: Date;
  workforceCategory: WorkforceCategory;
  preferredShifts: ShiftCode[];
  designationId: string;
  designation: { id: string; name: string; level: number; isCritical: boolean };
  departmentId?: string | null;
  locationId: string | null;
  projectId: string | null;
};

type WeeklyAssignmentDraft = {
  employee: EmployeeRule;
  shift: ShiftRule;
  score: number;
  explanation: string;
  weeklyOffDate: Date | null;
  weeklyOffDates?: Date[];
  workingDaysCount?: number;
  weeklyGroup?: WeeklyGroup;
  source: AssignmentSource;
};

type ReplacementDraft = {
  date: Date;
  shift: ShiftRule;
  requiredDesignationId?: string;
  replacedEmployeeId?: string;
  replacementEmployee?: EmployeeRule;
  source: ReplacementSource;
  status: ReplacementStatus;
  overtimeFlag: boolean;
  reason: string;
  score: number;
  explanation: string;
};

type EffectiveRosterPolicy = {
  id: string;
  organizationId: string;
  projectId: string;
  locationId: string;
  requiredDailyHeadcount: number;
  workingDaysPerEmployee: number;
  weeklyOffsPerEmployee: number;
  shiftDistributionJson: Record<string, number>;
  roundingPolicy: RoundingPolicy;
  generalBufferEnabled: boolean;
  allowExtraDuty: boolean;
  allowOvertime: boolean;
  weekStartDay: string;
  minimumRestHours: number;
  publishOverridePolicy: string;
  isActive: boolean;
};

function dateKey(date: Date) {
  return format(startOfDay(date), 'yyyy-MM-dd');
}

function stable(value: any): any {
  if (value instanceof Date) return dateKey(value);
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc: any, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function hashPayload(value: any) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function hashInt(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function overlapDays(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  const from = isBefore(start, rangeStart) ? rangeStart : start;
  const to = isAfter(end, rangeEnd) ? rangeEnd : end;
  if (to < from) return 0;
  return differenceInCalendarDays(to, from) + 1;
}

@Injectable()
export class RostersService {
  constructor(private prisma: PrismaService, private rosterPolicies: RosterPoliciesService) {}

  async weeklyPreview(dto: WeeklyPreviewDto, actor: any) {
    const requestedWeekStart = dto.weekStartDate ?? dto.weekStart;
    if (!requestedWeekStart) throw new BadRequestException('weekStartDate is required');
    const weekStart = startOfDay(parseISO(requestedWeekStart));
    const weekEnd = addDays(weekStart, 6);
    const context = await this.loadGenerationContext(dto.locationId, weekStart, weekEnd);
    const policy = await this.effectivePolicy(dto.locationId, dto.projectId, dto.simulation);
    const designationRequirements = await this.loadDesignationRequirements(policy.projectId, policy.locationId, weekStart);
    context.location.shifts = this.applyDesignationRequirements(context.location.shifts, designationRequirements);
    if (!context.location.shifts.length) throw new BadRequestException('No shifts configured for this location');

    const issues: Issue[] = [];
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const leaveMap = this.buildLeaveMap(context.leaves, days);
    const history = await this.buildHistory(dto.locationId, weekStart);

    const primaryEmployees = context.locationEmployees.filter(
      (e) =>
        e.status === EmployeeStatus.ACTIVE &&
        e.workforceCategory === WorkforceCategory.PRIMARY &&
        e.locationId === dto.locationId &&
        e.projectId === policy.projectId &&
        !isAfter(startOfDay(e.joinDate), weekStart) &&
        !this.isFullWeekLeave(e.id, leaveMap, days),
    );
    const backupEmployees = context.locationEmployees.filter(
      (e) =>
        e.status === EmployeeStatus.ACTIVE &&
        e.workforceCategory === WorkforceCategory.BACKUP &&
        e.locationId === dto.locationId &&
        e.projectId === policy.projectId &&
        !isAfter(startOfDay(e.joinDate), weekStart) &&
        !this.isFullWeekLeave(e.id, leaveMap, days),
    );

    const capacity = this.capacitySummary(policy, primaryEmployees.length);
    if (capacity.extraOrShortageSlots < 0) {
      issues.push({
        severity: 'CRITICAL',
        code: 'WEEKLY_CAPACITY_SHORTAGE',
        message: `Policy requires ${capacity.requiredWeeklySlots} weekly working slots, but ${capacity.availableWeeklySlots} are available.`,
        recommendation: 'Reduce required daily headcount, add eligible employees, or approve extra duty/overtime.',
        required: capacity.requiredWeeklySlots,
        actual: capacity.availableWeeklySlots,
      });
    }

    if (primaryEmployees.length === 0) {
      issues.push({
        severity: 'CRITICAL',
        code: 'NO_PRIMARY_EMPLOYEES',
        message: 'No active primary employees are available for this location and week.',
        recommendation: 'Assign primary employees to the location or adjust leave/workforce category settings.',
      });
    }

    const targetResult = this.calculateShiftTargets(context.location.shifts, policy, primaryEmployees.length);
    issues.push(...targetResult.issues);

    const assignmentResult = this.allocateWeeklyAssignments(
      primaryEmployees,
      targetResult.operationalShifts,
      targetResult.targets,
      history,
      issues,
    );

    const assignments = this.assignWeeklyOffs(
      assignmentResult.assignments,
      days,
      weekStart,
      policy.weeklyOffsPerEmployee,
      targetResult.dailyTargets,
      leaveMap,
    );

    const dailyEntries = this.buildDailyEntryPreview(assignments, days, leaveMap, targetResult.dailyTargets, policy, issues);
    const replacements = this.generateReplacements({
      days,
      shifts: targetResult.operationalShifts,
      assignments,
      dailyEntries,
      leaveMap,
      backupEmployees,
      crossLocationEmployees: context.crossLocationEmployees,
      dailyTargets: targetResult.dailyTargets,
      issues,
    });

    const fairnessSummary = this.buildFairnessSummary(assignments);
    const previousWeekComparison = await this.previousWeekComparison(dto.locationId, weekStart, assignments);
    const validationSummary = {
      issues,
      criticalCount: issues.filter((i) => i.severity === 'CRITICAL').length,
      warningCount: issues.filter((i) => i.severity === 'WARNING').length,
      infoCount: issues.filter((i) => i.severity === 'INFO').length,
      unassignedCount: assignmentResult.unassigned.length,
      targetSummary: targetResult.summary,
      dailyTargetSummary: targetResult.dailySummary,
      capacity,
      policy: {
        id: policy.id,
        projectId: policy.projectId,
        locationId: policy.locationId,
        requiredDailyHeadcount: policy.requiredDailyHeadcount,
        workingDaysPerEmployee: policy.workingDaysPerEmployee,
        weeklyOffsPerEmployee: policy.weeklyOffsPerEmployee,
        roundingPolicy: policy.roundingPolicy,
        shiftDistributionJson: policy.shiftDistributionJson,
      },
    };

    const snapshotPayload = this.buildSnapshotPayload(context, weekStart, weekEnd, primaryEmployees, backupEmployees, policy);
    const configHash = hashPayload(snapshotPayload);
    const rosterWeek = await this.saveDraft({
      policy,
      projectId: policy.projectId,
      locationId: dto.locationId,
      weekStart,
      weekEnd,
      actor,
      assignments,
      replacements,
      targetResult,
      validationSummary,
      fairnessSummary,
      previousWeekComparison,
      snapshotPayload,
      configHash,
      capacity,
    });

    return this.weeklyDetails(rosterWeek.id, {
      dailyEntries,
      targetSummary: targetResult.summary,
      validationSummary,
      fairnessSummary,
      previousWeekComparison,
    });
  }

  async weeklyDetails(id: string, transient?: any, allowedLocationIds?: string[] | null) {
    const rosterWeek = await this.prisma.rosterWeek.findUnique({
      where: { id },
      include: {
        location: { include: { project: true } },
        weeklyAssignments: {
          include: { employee: { include: { designation: true, department: true } }, shift: true },
          orderBy: [{ shift: { code: 'asc' } }, { employee: { name: 'asc' } }],
        },
        replacementAssignments: {
          include: {
            shift: true,
            replacedEmployee: { include: { designation: true, department: true } },
            replacementEmployee: { include: { designation: true, department: true, location: true } },
          },
          orderBy: [{ date: 'asc' }, { shift: { code: 'asc' } }],
        },
        overrides: { orderBy: { createdAt: 'desc' } },
        rosterEntries: {
          include: { employee: { include: { designation: true, department: true } }, shift: true },
          orderBy: [{ date: 'asc' }, { shift: { code: 'asc' } }],
        },
      },
    });
    if (!rosterWeek) throw new BadRequestException('Roster week not found');
    if (allowedLocationIds !== undefined && allowedLocationIds !== null && !allowedLocationIds.includes(rosterWeek.locationId)) {
      throw new ForbiddenException('You do not have access to this roster week');
    }

    let dailyEntries = transient?.dailyEntries ?? rosterWeek.rosterEntries;
    if (!transient?.dailyEntries && dailyEntries.length === 0 && rosterWeek.weeklyAssignments.length > 0) {
      dailyEntries = await this.synthesizeDailyEntries(rosterWeek as any);
    }

    return {
      ...rosterWeek,
      targetSummary: transient?.targetSummary ?? (rosterWeek.validationSummary as any)?.targetSummary ?? this.targetSummaryFromAssignments(rosterWeek.weeklyAssignments as any),
      dailyEntries,
      validationSummary: transient?.validationSummary ?? rosterWeek.validationSummary,
      fairnessSummary: transient?.fairnessSummary ?? rosterWeek.fairnessSummary,
      previousWeekComparison: transient?.previousWeekComparison ?? rosterWeek.previousWeekComparison,
    };
  }

  async findWeekly(locationId: string, weekStart: string, allowedLocationIds?: string[] | null) {
    if (allowedLocationIds !== undefined && allowedLocationIds !== null && !allowedLocationIds.includes(locationId)) {
      throw new ForbiddenException('You do not have access to this location');
    }
    const start = startOfDay(parseISO(weekStart));
    const found = await this.prisma.rosterWeek.findUnique({
      where: { locationId_weekStart: { locationId, weekStart: start } },
      select: { id: true },
    });
    if (!found) return null;
    return this.weeklyDetails(found.id);
  }

  async publishWeekly(id: string, actor: any) {
    const rosterWeek = await this.prisma.rosterWeek.findUnique({
      where: { id },
      include: {
        snapshot: true,
        location: true,
        weeklyAssignments: { include: { employee: { include: { designation: true, department: true } }, shift: true } },
        replacementAssignments: true,
        overrides: true,
      },
    });
    if (!rosterWeek) throw new BadRequestException('Roster week not found');
    if (!rosterWeek.snapshot) throw new BadRequestException('Roster snapshot missing. Regenerate preview.');

    const fresh = await this.loadGenerationContext(rosterWeek.locationId, rosterWeek.weekStart, rosterWeek.weekEnd);
    const policy = await this.effectivePolicy(rosterWeek.locationId, fresh.location.projectId);
    const designationRequirements = await this.loadDesignationRequirements(policy.projectId, policy.locationId, rosterWeek.weekStart);
    fresh.location.shifts = this.applyDesignationRequirements(fresh.location.shifts, designationRequirements);
    const days = eachDayOfInterval({ start: rosterWeek.weekStart, end: rosterWeek.weekEnd });
    const leaveMap = this.buildLeaveMap(fresh.leaves, days);
    const primaryEmployees = fresh.locationEmployees.filter(
      (e) =>
        e.status === EmployeeStatus.ACTIVE &&
        e.workforceCategory === WorkforceCategory.PRIMARY &&
        e.locationId === rosterWeek.locationId &&
        e.projectId === policy.projectId &&
        !isAfter(startOfDay(e.joinDate), rosterWeek.weekStart) &&
        !this.isFullWeekLeave(e.id, leaveMap, days),
    );
    const backupEmployees = fresh.locationEmployees.filter(
      (e) => e.status === EmployeeStatus.ACTIVE && e.workforceCategory === WorkforceCategory.BACKUP,
    );
    const freshSnapshot = this.buildSnapshotPayload(fresh, rosterWeek.weekStart, rosterWeek.weekEnd, primaryEmployees, backupEmployees, policy);
    const freshHash = hashPayload(freshSnapshot);
    if (freshHash !== rosterWeek.configHash) {
      await this.prisma.rosterWeek.update({ where: { id }, data: { status: RosterWeekStatus.STALE } });
      throw new ConflictException('Roster preview is stale. Employee, leave, shift, or location configuration changed. Regenerate preview.');
    }

    const validation = rosterWeek.validationSummary as any;
    const hasCritical = Number(validation?.criticalCount ?? 0) > 0;
    const approvedStatuses: OverrideStatus[] = [OverrideStatus.APPROVED, OverrideStatus.APPLIED];
    const hasApprovedCriticalOverride = rosterWeek.overrides.some(
      (o) => o.severity === OverrideSeverity.CRITICAL && approvedStatuses.includes(o.status),
    );
    if (hasCritical && !hasApprovedCriticalOverride) {
      throw new ConflictException('Critical roster violations must be resolved or approved before publishing.');
    }

    const dailyTargets = this.dailyTargetsFromValidation(rosterWeek.validationSummary);
    const draftAssignments: WeeklyAssignmentDraft[] = rosterWeek.weeklyAssignments.map((assignment: any) => ({
      employee: assignment.employee,
      shift: assignment.shift,
      score: assignment.score ?? 0,
      explanation: assignment.assignmentExplanation ?? assignment.explanation ?? '',
      weeklyOffDate: assignment.weeklyOffDate,
      weeklyOffDates: Array.isArray(assignment.weeklyOffDates)
        ? assignment.weeklyOffDates.map((date: string) => startOfDay(parseISO(date)))
        : assignment.weeklyOffDate ? [assignment.weeklyOffDate] : [],
      source: assignment.source,
      weeklyGroup: assignment.weeklyGroup,
      workingDaysCount: assignment.workingDaysCount,
    }));
    const publishIssues: Issue[] = [];
    const previewEntries = this.buildDailyEntryPreview(draftAssignments, days, leaveMap, dailyTargets, policy, publishIssues);
    const assignmentIdByEmployee = new Map(rosterWeek.weeklyAssignments.map((assignment: any) => [assignment.employeeId, assignment.id]));
    const entries: any[] = previewEntries.map((entry) => ({
      rosterWeekId: rosterWeek.id,
      weeklyAssignmentId: assignmentIdByEmployee.get(entry.employeeId),
      employeeId: entry.employeeId,
      shiftId: entry.shiftId,
      date: parseISO(entry.date),
      status: entry.status,
      entryType: entry.entryType,
      source: entry.source,
      notes: entry.notes,
    }));

    for (const replacement of rosterWeek.replacementAssignments) {
      if (!replacement.replacementEmployeeId || replacement.overtimeFlag || replacement.status === ReplacementStatus.UNRESOLVED) continue;
      entries.push({
        rosterWeekId: rosterWeek.id,
        replacementAssignmentId: replacement.id,
        employeeId: replacement.replacementEmployeeId,
        shiftId: replacement.shiftId,
        date: replacement.date,
        status: RosterStatus.SCHEDULED,
        entryType: RosterEntryType.REPLACEMENT,
        source: AssignmentSource.REPLACEMENT,
        isReplacement: true,
        replacementForEmployeeId: replacement.replacedEmployeeId,
        notes: replacement.reason,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rosterEntry.deleteMany({
        where: {
          date: { gte: rosterWeek.weekStart, lte: rosterWeek.weekEnd },
          shift: { locationId: rosterWeek.locationId },
        },
      });
      if (entries.length > 0) await tx.rosterEntry.createMany({ data: entries as any, skipDuplicates: true });
      await tx.replacementAssignment.updateMany({
        where: { rosterWeekId: rosterWeek.id, status: ReplacementStatus.SUGGESTED, overtimeFlag: false },
        data: { status: ReplacementStatus.APPROVED },
      });
      await tx.rosterWeek.update({
        where: { id: rosterWeek.id },
        data: {
          status: RosterWeekStatus.PUBLISHED,
          version: { increment: 1 },
          publishedByUserId: actor?.userId,
          publishedByEmail: actor?.email,
          publishedAt: new Date(),
          lockedByUserId: null,
          lockedByEmail: null,
          lockedAt: null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'ROSTER_WEEK_PUBLISH',
          entityType: 'RosterWeek',
          entityId: rosterWeek.id,
          actorUserId: actor?.userId,
          actorEmail: actor?.email,
          metadata: { weekStart: dateKey(rosterWeek.weekStart), weekEnd: dateKey(rosterWeek.weekEnd), hasCritical },
        },
      });
    });

    return this.weeklyDetails(id);
  }

  async regenerateWeekly(id: string, actor: any) {
    const rosterWeek = await this.prisma.rosterWeek.findUnique({ where: { id } });
    if (!rosterWeek) throw new BadRequestException('Roster week not found');
    return this.weeklyPreview({
      projectId: rosterWeek.projectId ?? undefined,
      locationId: rosterWeek.locationId,
      weekStartDate: dateKey(rosterWeek.weekStart),
      mode: 'overwrite',
    }, actor);
  }

  async replacementSuggestions(id: string, filters: { date?: string; shiftId?: string; designationId?: string; originalEmployeeId?: string }, allowedLocationIds?: string[] | null) {
    if (allowedLocationIds !== undefined && allowedLocationIds !== null) {
      const rosterWeek = await this.prisma.rosterWeek.findUnique({ where: { id }, select: { locationId: true } });
      if (!rosterWeek || !allowedLocationIds.includes(rosterWeek.locationId)) {
        throw new ForbiddenException('You do not have access to this roster week');
      }
    }
    const where: any = { rosterWeekId: id };
    if (filters.date) where.date = startOfDay(parseISO(filters.date));
    if (filters.shiftId) where.shiftId = filters.shiftId;
    if (filters.designationId) where.requiredDesignationId = filters.designationId;
    if (filters.originalEmployeeId) where.replacedEmployeeId = filters.originalEmployeeId;
    return this.prisma.replacementAssignment.findMany({
      where,
      include: {
        shift: true,
        replacedEmployee: { include: { designation: true } },
        replacementEmployee: { include: { designation: true, location: true } },
      },
      orderBy: [{ date: 'asc' }, { score: 'asc' }],
    });
  }

  async exportWeekly(id: string, allowedLocationIds?: string[] | null) {
    const details = await this.weeklyDetails(id, undefined, allowedLocationIds);
    return this.rosterWorkbookBuffer([details], {
      projectId: details.projectId ?? details.location?.projectId,
      locationId: details.locationId,
      startDate: dateKey(details.weekStart),
      endDate: dateKey(details.weekEnd),
      period: 'week',
      scope: 'location',
    });
  }

  async periodReport(params: RosterReportParams) {
    const report = await this.loadRosterReport(params);
    return {
      period: report.period,
      scope: report.scope,
      project: report.project,
      location: report.location,
      startDate: dateKey(report.start),
      endDate: dateKey(report.end),
      weeks: report.details.map((details: any) => ({
        id: details.id,
        locationId: details.locationId,
        location: details.location?.name,
        project: details.location?.project?.name,
        weekStart: dateKey(details.weekStart),
        weekEnd: dateKey(details.weekEnd),
        status: details.status,
        eligibleEmployeeCount: details.eligibleEmployeeCount,
        requiredDailyHeadcount: details.requiredDailyHeadcount,
        requiredWeeklySlots: details.requiredWeeklySlots,
        availableWeeklySlots: details.availableWeeklySlots,
        extraOrShortageSlots: details.extraOrShortageSlots,
        criticalIssues: details.validationSummary?.criticalCount ?? 0,
        warnings: details.validationSummary?.warningCount ?? 0,
      })),
      summary: this.reportSummary(report.details, report.start, report.end),
      calendarRows: this.periodCalendarRows(report.details, report.start, report.end),
      dailyCoverage: this.periodDailyCoverageRows(report.details, report.start, report.end),
      validationIssues: this.periodValidationRows(report.details),
    };
  }

  async previewPeriod(dto: PeriodPreviewDto, actor: any) {
    const context = await this.resolveRosterReportContext(dto);
    const weekStarts = this.periodWeekStarts(context.start, context.end);
    const refreshed: any[] = [];
    const skipped: any[] = [];

    for (const weekStart of weekStarts) {
      for (const location of context.locations) {
        const eligibleAtWeekStart = await this.prisma.employee.count({
          where: {
            projectId: context.projectId,
            locationId: location.id,
            status: EmployeeStatus.ACTIVE,
            workforceCategory: WorkforceCategory.PRIMARY,
            joinDate: { lte: weekStart },
          },
        });
        if (eligibleAtWeekStart <= 0) {
          skipped.push({
            locationId: location.id,
            location: location.name,
            weekStart: dateKey(weekStart),
            reason: 'No active primary employees at week start',
          });
          continue;
        }

        const result = await this.weeklyPreview({
          projectId: context.projectId,
          locationId: location.id,
          weekStartDate: dateKey(weekStart),
          mode: 'overwrite',
        }, actor);
        refreshed.push({
          id: result.id,
          locationId: location.id,
          location: location.name,
          weekStart: dateKey(weekStart),
          status: result.status,
          critical: result.validationSummary?.criticalCount ?? 0,
          warning: result.validationSummary?.warningCount ?? 0,
        });
      }
    }

    return {
      refreshedCount: refreshed.length,
      skippedCount: skipped.length,
      refreshed,
      skipped,
      report: await this.periodReport(dto),
    };
  }

  async exportRosterReport(params: RosterReportParams) {
    const report = await this.loadRosterReport(params);
    return this.rosterWorkbookBuffer(report.details, {
      ...params,
      projectId: report.project?.id ?? params.projectId,
      locationId: report.location?.id ?? params.locationId,
      startDate: dateKey(report.start),
      endDate: dateKey(report.end),
      period: report.period,
      scope: report.scope,
    });
  }

  async createOverride(rosterWeekId: string, dto: OverrideDto, actor: any) {
    const rosterWeek = await this.prisma.rosterWeek.findUnique({ where: { id: rosterWeekId } });
    if (!rosterWeek) throw new BadRequestException('Roster week not found');
    const severity = dto.severity ?? OverrideSeverity.NON_CRITICAL;
    const status = severity === OverrideSeverity.CRITICAL ? OverrideStatus.PENDING_APPROVAL : OverrideStatus.APPLIED;
    const override = await this.prisma.rosterOverride.create({
      data: {
        rosterWeekId,
        severity,
        status,
        requestedByUserId: actor?.userId,
        requestedByEmail: actor?.email,
        reason: dto.reason,
        entityType: dto.entityType ?? 'RosterWeek',
        entityId: dto.entityId,
        oldValue: dto.oldValue,
        newValue: dto.newValue,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        action: severity === OverrideSeverity.CRITICAL ? 'ROSTER_OVERRIDE_REQUEST' : 'ROSTER_OVERRIDE_APPLY',
        entityType: 'RosterOverride',
        entityId: override.id,
        actorUserId: actor?.userId,
        actorEmail: actor?.email,
        metadata: override,
      },
    });
    return override;
  }

  async approveOverride(rosterWeekId: string, overrideId: string, actor: any) {
    const override = await this.prisma.rosterOverride.findFirst({ where: { id: overrideId, rosterWeekId } });
    if (!override) throw new BadRequestException('Override not found');
    if (![UserRole.ADMIN, UserRole.COMPLIANCE_ADMIN].includes(actor?.role)) {
      throw new BadRequestException('Only Admin or Compliance Admin can approve critical overrides');
    }
    if (override.requestedByUserId && override.requestedByUserId === actor?.userId) {
      throw new BadRequestException('Critical override requires approval by a different user');
    }
    const updated = await this.prisma.rosterOverride.update({
      where: { id: overrideId },
      data: {
        status: OverrideStatus.APPROVED,
        approvedByUserId: actor?.userId,
        approvedByEmail: actor?.email,
        approvedAt: new Date(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'ROSTER_OVERRIDE_APPROVE',
        entityType: 'RosterOverride',
        entityId: updated.id,
        actorUserId: actor?.userId,
        actorEmail: actor?.email,
        metadata: updated,
      },
    });
    return updated;
  }

  async generate(dto: GenerateDto, actor: any) {
    const preview = await this.weeklyPreview({ locationId: dto.locationId, weekStartDate: dto.startDate, mode: dto.mode }, actor);
    const published = await this.publishWeekly(preview.id, actor);
    return {
      generated: published.rosterEntries?.length ?? 0,
      days: 7,
      rosterWeekId: published.id,
      issues: (published.validationSummary as any)?.issues ?? [],
    };
  }

  list(filters: { from?: string; to?: string; locationId?: string; employeeId?: string; allowedLocationIds?: string[] | null }) {
    const where: any = {};
    if (filters.from) where.date = { ...(where.date ?? {}), gte: parseISO(filters.from) };
    if (filters.to) where.date = { ...(where.date ?? {}), lte: parseISO(filters.to) };
    if (filters.allowedLocationIds !== undefined && filters.allowedLocationIds !== null) {
      if (filters.locationId && !filters.allowedLocationIds.includes(filters.locationId)) {
        throw new ForbiddenException('You do not have access to the requested location');
      }
      where.shift = { locationId: filters.locationId ?? { in: filters.allowedLocationIds } };
    } else if (filters.locationId) {
      where.shift = { locationId: filters.locationId };
    }
    if (filters.employeeId) where.employeeId = filters.employeeId;
    return this.prisma.rosterEntry.findMany({
      where,
      include: {
        employee: { include: { designation: true } },
        shift: { include: { location: true } },
        replacementAssignment: true,
      },
      orderBy: [{ date: 'asc' }, { shift: { code: 'asc' } }],
    });
  }

  async myRoster(employeeId: string, from?: string, to?: string) {
    const where: any = { employeeId, rosterWeek: { status: RosterWeekStatus.PUBLISHED } };
    if (from) where.date = { ...(where.date ?? {}), gte: parseISO(from) };
    if (to) where.date = { ...(where.date ?? {}), lte: parseISO(to) };
    const entries = await this.prisma.rosterEntry.findMany({
      where,
      include: {
        shift: { include: { location: true } },
        replacementAssignment: {
          include: {
            shift: true,
            replacedEmployee: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });
    const replacementWhere: any = {
      replacementEmployeeId: employeeId,
      rosterWeek: { status: RosterWeekStatus.PUBLISHED },
      status: ReplacementStatus.APPROVED,
      overtimeFlag: false,
    };
    if (from || to) {
      replacementWhere.date = {};
      if (from) replacementWhere.date.gte = parseISO(from);
      if (to) replacementWhere.date.lte = parseISO(to);
    }
    const replacementDuties = await this.prisma.replacementAssignment.findMany({
      where: replacementWhere,
      include: { shift: { include: { location: true } }, replacedEmployee: true },
      orderBy: { date: 'asc' },
    });
    const synthetic = replacementDuties
      .filter((r) => !entries.some((entry) => entry.replacementAssignmentId === r.id))
      .map((r) => ({
        id: `replacement-${r.id}`,
        employeeId,
        shiftId: r.shiftId,
        shift: r.shift,
        date: r.date,
        status: RosterStatus.SCHEDULED,
        source: AssignmentSource.REPLACEMENT,
        isReplacement: true,
        notes: r.reason,
        replacementAssignment: r,
      }));
    return [...entries, ...synthetic].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  assign(dto: AssignDto) {
    return this.prisma.rosterEntry.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date: parseISO(dto.date) } },
      create: {
        employeeId: dto.employeeId,
        shiftId: dto.shiftId,
        date: parseISO(dto.date),
        notes: dto.notes,
        source: AssignmentSource.MANUAL,
      },
      update: { shiftId: dto.shiftId, notes: dto.notes, source: AssignmentSource.MANUAL },
    });
  }

  remove(id: string) {
    return this.prisma.rosterEntry.delete({ where: { id } });
  }

  async coverage(locationId: string, date: string, allowedLocationIds?: string[] | null) {
    if (allowedLocationIds !== undefined && allowedLocationIds !== null && !allowedLocationIds.includes(locationId)) {
      throw new ForbiddenException('You do not have access to this location');
    }
    const day = startOfDay(parseISO(date));
    const location = await this.prisma.location.findUnique({ where: { id: locationId }, select: { projectId: true } });
    if (!location) throw new BadRequestException('Location not found');
    const entries = await this.prisma.rosterEntry.findMany({
      where: { date: day, shift: { locationId }, status: RosterStatus.SCHEDULED },
      include: { shift: true, employee: { include: { designation: true } } },
    });
    const rawShifts = await this.prisma.shift.findMany({
      where: { locationId },
      orderBy: [{ priority: 'desc' }, { code: 'asc' }],
    });
    const requirements = await this.loadDesignationRequirements(location.projectId, locationId, day);
    const shifts = this.applyDesignationRequirements(rawShifts, requirements);
    return shifts.map((shift) => {
      const assigned = entries.filter((e) => e.shiftId === shift.id);
      const byDesig = shift.requirements.map((r) => {
        const have = assigned.filter((a) => a.employee.designationId === r.designationId).length;
        return {
          designation: r.designation.name,
          required: r.minCount,
          assigned: have,
          shortfall: Math.max(0, r.minCount - have),
        };
      });
      return {
        shiftCode: shift.code,
        shiftName: shift.name,
        totalAssigned: assigned.length,
        breakdown: byDesig,
      };
    });
  }

  private async effectivePolicy(locationId: string, projectId?: string, simulation?: WeeklyPreviewDto['simulation']): Promise<EffectiveRosterPolicy> {
    const base = await this.rosterPolicies.ensureForLocation(locationId, projectId);
    const workingDays = Number(simulation?.workingDaysPerEmployee ?? base.workingDaysPerEmployee ?? 6);
    const weeklyOffs = Number(simulation?.weeklyOffsPerEmployee ?? base.weeklyOffsPerEmployee ?? Math.max(0, 7 - workingDays));
    return {
      id: base.id,
      organizationId: base.organizationId,
      projectId: base.projectId,
      locationId: base.locationId,
      requiredDailyHeadcount: Number(simulation?.requiredDailyHeadcount ?? base.requiredDailyHeadcount ?? 49),
      workingDaysPerEmployee: workingDays,
      weeklyOffsPerEmployee: weeklyOffs,
      shiftDistributionJson: this.normalizeDistribution(simulation?.shiftDistributionJson ?? base.shiftDistributionJson),
      roundingPolicy: simulation?.roundingPolicy ?? base.roundingPolicy,
      generalBufferEnabled: base.generalBufferEnabled,
      allowExtraDuty: base.allowExtraDuty,
      allowOvertime: base.allowOvertime,
      weekStartDay: base.weekStartDay,
      minimumRestHours: base.minimumRestHours,
      publishOverridePolicy: base.publishOverridePolicy,
      isActive: base.isActive,
    };
  }

  private normalizeDistribution(value: any): Record<string, number> {
    const source = value && typeof value === 'object' ? value : { A: 40, B: 40, C: 20 };
    return Object.fromEntries(
      Object.entries(source).map(([key, raw]) => [String(key).toUpperCase(), Number(raw) || 0]),
    );
  }

  private capacitySummary(policy: EffectiveRosterPolicy, eligibleEmployeeCount: number) {
    const requiredWeeklySlots = policy.requiredDailyHeadcount * 7;
    const availableWeeklySlots = eligibleEmployeeCount * policy.workingDaysPerEmployee;
    return {
      eligibleEmployeeCount,
      requiredDailyHeadcount: policy.requiredDailyHeadcount,
      workingDaysPerEmployee: policy.workingDaysPerEmployee,
      weeklyOffsPerEmployee: policy.weeklyOffsPerEmployee,
      requiredWeeklySlots,
      availableWeeklySlots,
      extraOrShortageSlots: availableWeeklySlots - requiredWeeklySlots,
    };
  }

  private async loadDesignationRequirements(projectId: string, locationId: string, weekStart: Date) {
    return this.prisma.designationRequirement.findMany({
      where: {
        projectId,
        locationId,
        isActive: true,
        OR: [
          { effectiveFrom: null },
          { effectiveFrom: { lte: weekStart } },
        ],
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: weekStart } },
            ],
          },
        ],
      },
      include: { designation: true, shift: true },
    });
  }

  private applyDesignationRequirements(shifts: (Omit<ShiftRule, 'requirements'> & { requirements?: ShiftRule['requirements'] })[], requirements: any[]) {
    const byShift = requirements.reduce((acc: Record<string, any[]>, req) => {
      if (req.dayType !== DayType.ANY) return acc;
      acc[req.shiftId] ??= [];
      acc[req.shiftId].push(req);
      return acc;
    }, {});
    return shifts.map((shift) => {
      const configured = byShift[shift.id] ?? [];
      return {
        ...shift,
        requirements: configured.map((req) => ({
          designationId: req.designationId,
          minCount: req.requiredCount,
          designation: {
            id: req.designation.id,
            name: req.designation.name,
            level: req.designation.level,
            isCritical: req.designation.isCritical,
          },
        })),
      };
    });
  }

  private async loadGenerationContext(locationId: string, weekStart: Date, weekEnd: Date) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: {
        project: true,
        shifts: {
          orderBy: [{ priority: 'desc' }, { code: 'asc' }],
        },
        employees: { include: { designation: true, department: true } },
      },
    });
    if (!location) throw new BadRequestException('Location not found');
    const crossLocationEmployees = await this.prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        projectId: location.projectId,
        locationId: { not: locationId },
        workforceCategory: { in: [WorkforceCategory.PRIMARY, WorkforceCategory.BACKUP] },
      },
      include: { designation: true, department: true },
    });
    const employeeIds = [...location.employees, ...crossLocationEmployees].map((e) => e.id);
    const leaves = await this.prisma.leave.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: LeaveStatus.APPROVED,
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
    });
    return {
      location: location as any,
      locationEmployees: location.employees as any[] as EmployeeRule[],
      crossLocationEmployees: crossLocationEmployees as any[] as EmployeeRule[],
      leaves,
    };
  }

  private buildLeaveMap(leaves: any[], days: Date[]) {
    const map: Record<string, Set<string>> = {};
    for (const leave of leaves) {
      for (const day of days) {
        if (day >= startOfDay(leave.startDate) && day <= startOfDay(leave.endDate)) {
          map[leave.employeeId] ??= new Set<string>();
          map[leave.employeeId].add(dateKey(day));
        }
      }
    }
    return map;
  }

  private isFullWeekLeave(employeeId: string, leaveMap: Record<string, Set<string>>, days: Date[]) {
    const dates = leaveMap[employeeId];
    return !!dates && days.every((d) => dates.has(dateKey(d)));
  }

  private calculateShiftTargets(shifts: ShiftRule[], policy: EffectiveRosterPolicy, primaryCount: number) {
    const issues: Issue[] = [];
    const distribution = policy.shiftDistributionJson ?? { A: 40, B: 40, C: 20 };
    const operationalShifts = shifts.filter((shift) => Number((distribution as any)[shift.code] ?? 0) > 0);
    if (operationalShifts.length === 0) {
      issues.push({
        severity: 'CRITICAL',
        code: 'NO_OPERATIONAL_SHIFTS',
        message: 'No operational shifts match the roster policy distribution.',
        recommendation: 'Configure A/B/C shifts for this location or update the policy shift distribution.',
      });
    }
    const distributionTotal = operationalShifts.reduce((sum, s) => sum + Number((distribution as any)[s.code] ?? 0), 0);
    if (distributionTotal !== 100) {
      issues.push({
        severity: 'WARNING',
        code: 'DISTRIBUTION_TOTAL',
        message: `Policy shift distribution totals ${distributionTotal}%, not 100%. Rounding will normalize to the selected daily headcount.`,
        recommendation: 'Adjust the roster policy shift percentages so the total equals 100%.',
      });
    }

    const dailyTargets: Record<string, number> = {};
    const rawRows = operationalShifts.map((shift) => {
      const pct = Number((distribution as any)[shift.code] ?? 0);
      const raw = distributionTotal > 0 ? (policy.requiredDailyHeadcount * pct) / distributionTotal : 0;
      const minRequired = shift.requirements.reduce((sum, r) => sum + Number(r.minCount ?? 0), 0);
      return {
        shift,
        shiftId: shift.id,
        shiftCode: shift.code,
        shiftName: shift.name,
        distribution: pct,
        rawTarget: Number(raw.toFixed(2)),
        minRequired,
        target: 0,
        floor: Math.floor(raw),
        rounded: Math.round(raw),
        remainder: raw - Math.floor(raw),
      };
    });

    if (policy.roundingPolicy === RoundingPolicy.LARGEST_REMAINDER) {
      for (const row of rawRows) dailyTargets[row.shiftId] = row.floor;
      let total = Object.values(dailyTargets).reduce((a, b) => a + b, 0);
      const remainderOrder = [...rawRows].sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        if ((b.shift.priority ?? 0) !== (a.shift.priority ?? 0)) return (b.shift.priority ?? 0) - (a.shift.priority ?? 0);
        return String(a.shift.code).localeCompare(String(b.shift.code));
      });
      let cursor = 0;
      while (total < policy.requiredDailyHeadcount && remainderOrder.length > 0) {
        const row = remainderOrder[cursor % remainderOrder.length] ?? remainderOrder[0];
        dailyTargets[row.shiftId] += 1;
        total += 1;
        cursor += 1;
      }
    } else {
      for (const row of rawRows) dailyTargets[row.shiftId] = row.rounded;
    }

    let total = Object.values(dailyTargets).reduce((a, b) => a + b, 0);
    const downOrder = [...operationalShifts].sort((a, b) => {
      if ((a.priority ?? 0) !== (b.priority ?? 0)) return (a.priority ?? 0) - (b.priority ?? 0);
      const aDistribution = Number((distribution as any)[a.code] ?? 0);
      const bDistribution = Number((distribution as any)[b.code] ?? 0);
      if (aDistribution !== bDistribution) return aDistribution - bDistribution;
      return String(b.code).localeCompare(String(a.code));
    });
    while (total > policy.requiredDailyHeadcount) {
      const candidate = downOrder.find((s) => dailyTargets[s.id] > 0);
      if (!candidate) break;
      dailyTargets[candidate.id] -= 1;
      total -= 1;
    }

    const upOrder = [...operationalShifts].sort((a, b) => {
      if ((a.priority ?? 0) !== (b.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
      const aDistribution = Number((distribution as any)[a.code] ?? 0);
      const bDistribution = Number((distribution as any)[b.code] ?? 0);
      if (aDistribution !== bDistribution) return bDistribution - aDistribution;
      return String(a.code).localeCompare(String(b.code));
    });
    while (total < policy.requiredDailyHeadcount && upOrder.length > 0) {
      const candidate = upOrder[(policy.requiredDailyHeadcount - total - 1) % upOrder.length];
      dailyTargets[candidate.id] += 1;
      total += 1;
    }

    const targets: Record<string, number> = {};
    const requiredSlots = Object.fromEntries(operationalShifts.map((shift) => [shift.id, (dailyTargets[shift.id] ?? 0) * 7]));
    let targetTotal = 0;
    const slotRows = operationalShifts.map((shift) => {
      const weeklySlots = requiredSlots[shift.id] ?? 0;
      const base = Math.floor(weeklySlots / Math.max(1, policy.workingDaysPerEmployee));
      targets[shift.id] = base;
      targetTotal += base;
      return {
        shift,
        weeklySlots,
        base,
        remainder: weeklySlots - base * Math.max(1, policy.workingDaysPerEmployee),
      };
    });
    const slotOrder = [...slotRows].sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      if ((b.shift.priority ?? 0) !== (a.shift.priority ?? 0)) return (b.shift.priority ?? 0) - (a.shift.priority ?? 0);
      return String(a.shift.code).localeCompare(String(b.shift.code));
    });
    let cursor = 0;
    while (targetTotal < primaryCount && slotOrder.length > 0) {
      const row = slotOrder[cursor % slotOrder.length];
      targets[row.shift.id] += 1;
      targetTotal += 1;
      cursor += 1;
    }
    if (targetTotal > primaryCount) {
      for (const row of [...slotRows].sort((a, b) => a.remainder - b.remainder)) {
        while (targetTotal > primaryCount && targets[row.shift.id] > 0) {
          targets[row.shift.id] -= 1;
          targetTotal -= 1;
        }
      }
    }

    const summary = rawRows.map((row) => ({
      shiftId: row.shiftId,
      shiftCode: row.shiftCode,
      shiftName: row.shiftName,
      distribution: row.distribution,
      rawDailyTarget: row.rawTarget,
      dailyTarget: dailyTargets[row.shiftId] ?? 0,
      weeklyRequiredSlots: requiredSlots[row.shiftId] ?? 0,
      minRequired: row.minRequired,
      target: targets[row.shiftId] ?? 0,
      weeklyCapacity: (targets[row.shiftId] ?? 0) * policy.workingDaysPerEmployee,
    }));

    return {
      targets,
      dailyTargets,
      operationalShifts,
      dailySummary: summary.map((s) => ({
        shiftId: s.shiftId,
        shiftCode: s.shiftCode,
        shiftName: s.shiftName,
        target: s.dailyTarget,
        distribution: s.distribution,
        rawTarget: s.rawDailyTarget,
      })),
      summary,
      issues,
    };
  }

  private allocateWeeklyAssignments(
    employees: EmployeeRule[],
    shifts: ShiftRule[],
    targets: Record<string, number>,
    history: any,
    issues: Issue[],
  ) {
    const sortedShifts = [...shifts].sort((a, b) => {
      if (a.type === 'CRITICAL' && b.type !== 'CRITICAL') return -1;
      if (a.type !== 'CRITICAL' && b.type === 'CRITICAL') return 1;
      if ((a.priority ?? 0) !== (b.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
      return String(a.code).localeCompare(String(b.code));
    });
    const unassigned = new Map(employees.map((e) => [e.id, e]));
    const assignments: WeeklyAssignmentDraft[] = [];
    const assignedByShift: Record<string, WeeklyAssignmentDraft[]> = {};
    const assign = (employee: EmployeeRule, shift: ShiftRule, reason: string) => {
      const score = this.fairnessScore(employee, shift, history);
      assignments.push({
        employee,
        shift,
        score,
        explanation: this.assignmentExplanation(employee, shift, history, reason),
        weeklyOffDate: null,
        weeklyOffDates: [],
        weeklyGroup: this.weeklyGroupForShift(shift),
        source: AssignmentSource.SYSTEM,
      });
      assignedByShift[shift.id] ??= [];
      assignedByShift[shift.id].push(assignments[assignments.length - 1]);
      unassigned.delete(employee.id);
    };

    for (const shift of sortedShifts) {
      const requirements = [...shift.requirements].sort((a, b) => {
        if (a.designation.isCritical !== b.designation.isCritical) return a.designation.isCritical ? -1 : 1;
        return b.designation.level - a.designation.level;
      });
      for (const req of requirements) {
        const already = (assignedByShift[shift.id] ?? []).filter((a) => a.employee.designationId === req.designationId).length;
        const need = Math.max(0, req.minCount - already);
        const eligible = Array.from(unassigned.values())
          .filter((e) => e.designationId === req.designationId)
          .sort((a, b) => this.fairnessScore(a, shift, history) - this.fairnessScore(b, shift, history));
        for (const employee of eligible.slice(0, need)) assign(employee, shift, 'designation minimum coverage was required');
      }
    }

    for (const shift of sortedShifts) {
      while ((assignedByShift[shift.id] ?? []).length < targets[shift.id]) {
        const eligible = Array.from(unassigned.values())
          .sort((a, b) => this.fairnessScore(a, shift, history) - this.fairnessScore(b, shift, history));
        if (eligible.length === 0) break;
        assign(eligible[0], shift, 'shift distribution target needed additional eligible coverage');
      }
    }

    for (const employee of Array.from(unassigned.values())) {
      const eligibleShifts = sortedShifts
        .sort((a, b) => {
          const aGap = (assignedByShift[a.id]?.length ?? 0) - targets[a.id];
          const bGap = (assignedByShift[b.id]?.length ?? 0) - targets[b.id];
          if (aGap !== bGap) return aGap - bGap;
          return this.fairnessScore(employee, a, history) - this.fairnessScore(employee, b, history);
        });
      if (!eligibleShifts.length) {
        continue;
      }
      assign(employee, eligibleShifts[0], 'all primary employees must receive one weekly shift');
    }

    return { assignments, unassigned: Array.from(unassigned.values()) };
  }

  private assignWeeklyOffs(
    assignments: WeeklyAssignmentDraft[],
    days: Date[],
    weekStart: Date,
    weeklyOffsPerEmployee: number,
    dailyTargets: Record<string, number>,
    leaveMap: Record<string, Set<string>>,
  ) {
    const offCount = Math.max(0, Math.min(6, weeklyOffsPerEmployee));
    const assigned = assignments.map((assignment) => ({ ...assignment, weeklyOffDates: [] as Date[] }));
    const offLoadByDay: Record<string, number> = Object.fromEntries(days.map((day) => [dateKey(day), 0]));
    const offLoadByShiftDay: Record<string, number> = {};
    const availableByShiftDay: Record<string, number> = {};

    for (const assignment of assigned) {
      for (const day of days) {
        const key = `${assignment.shift.id}:${dateKey(day)}`;
        if (!leaveMap[assignment.employee.id]?.has(dateKey(day))) {
          availableByShiftDay[key] = (availableByShiftDay[key] ?? 0) + 1;
        }
      }
    }

    const sorted = [...assigned].sort((a, b) => hashInt(`${a.employee.id}-${dateKey(weekStart)}`) - hashInt(`${b.employee.id}-${dateKey(weekStart)}`));
    for (const assignment of sorted) {
      for (let i = 0; i < offCount; i += 1) {
        const already = new Set((assignment.weeklyOffDates ?? []).map(dateKey));
        const candidates = days
          .filter((day) => !already.has(dateKey(day)) && !leaveMap[assignment.employee.id]?.has(dateKey(day)))
          .map((day) => {
            const key = dateKey(day);
            const shiftDayKey = `${assignment.shift.id}:${key}`;
            const target = dailyTargets[assignment.shift.id] ?? 0;
            const surplus = (availableByShiftDay[shiftDayKey] ?? 0) - (offLoadByShiftDay[shiftDayKey] ?? 0) - target;
            return { day, key, shiftDayKey, surplus, offLoad: offLoadByDay[key] ?? 0 };
          })
          .sort((a, b) => {
            if (b.surplus !== a.surplus) return b.surplus - a.surplus;
            if (a.offLoad !== b.offLoad) return a.offLoad - b.offLoad;
            return hashInt(`${assignment.employee.id}-${a.key}`) - hashInt(`${assignment.employee.id}-${b.key}`);
          });
        const selected = candidates.find((candidate) => candidate.surplus > 0) ?? candidates[0];
        if (!selected) break;
        assignment.weeklyOffDates?.push(selected.day);
        assignment.weeklyOffDate ??= selected.day;
        offLoadByDay[selected.key] = (offLoadByDay[selected.key] ?? 0) + 1;
        offLoadByShiftDay[selected.shiftDayKey] = (offLoadByShiftDay[selected.shiftDayKey] ?? 0) + 1;
      }
      assignment.workingDaysCount = Math.max(0, 7 - (assignment.weeklyOffDates?.length ?? 0));
    }
    return assigned;
  }

  private buildDailyEntryPreview(
    assignments: WeeklyAssignmentDraft[],
    days: Date[],
    leaveMap: Record<string, Set<string>>,
    dailyTargets: Record<string, number>,
    policy: EffectiveRosterPolicy,
    issues: Issue[],
  ) {
    const entries = [];
    for (const assignment of assignments) {
      for (const day of days) {
        const key = dateKey(day);
        let status: RosterStatus = RosterStatus.SCHEDULED;
        let entryType: RosterEntryType = RosterEntryType.WORKING;
        if (leaveMap[assignment.employee.id]?.has(key)) status = RosterStatus.ON_LEAVE;
        if (status === RosterStatus.ON_LEAVE) entryType = RosterEntryType.ON_LEAVE;
        else if ((assignment.weeklyOffDates ?? []).some((off) => dateKey(off) === key)) {
          status = RosterStatus.WEEKLY_OFF;
          entryType = RosterEntryType.WEEKLY_OFF;
        }
        entries.push({
          employeeId: assignment.employee.id,
          employee: assignment.employee,
          shiftId: assignment.shift.id,
          shift: assignment.shift,
          date: key,
          status,
          entryType,
          source: assignment.source,
          notes: status === RosterStatus.ON_LEAVE ? 'Approved leave' : status === RosterStatus.WEEKLY_OFF ? 'Weekly off' : null,
        });
      }
    }

    for (const day of days) {
      const key = dateKey(day);
      for (const shiftId of Object.keys(dailyTargets)) {
        const working = entries
          .filter((entry) => entry.date === key && entry.shiftId === shiftId && entry.status === RosterStatus.SCHEDULED)
          .sort((a, b) => {
            const scoreA = assignments.find((assignment) => assignment.employee.id === a.employeeId)?.score ?? 0;
            const scoreB = assignments.find((assignment) => assignment.employee.id === b.employeeId)?.score ?? 0;
            return scoreB - scoreA;
          });
        const target = dailyTargets[shiftId] ?? 0;
        for (const extra of working.slice(target)) {
          if (!policy.generalBufferEnabled) continue;
          extra.status = RosterStatus.GENERAL;
          extra.entryType = RosterEntryType.GENERAL;
          extra.notes = 'General/Buffer capacity';
        }
      }
    }
    return entries;
  }

  private generateReplacements(args: {
    days: Date[];
    shifts: ShiftRule[];
    assignments: WeeklyAssignmentDraft[];
    dailyEntries: any[];
    leaveMap: Record<string, Set<string>>;
    backupEmployees: EmployeeRule[];
    crossLocationEmployees: EmployeeRule[];
    dailyTargets: Record<string, number>;
    issues: Issue[];
  }) {
    const replacements: ReplacementDraft[] = [];
    const usedReplacementByDate = new Set<string>();
    const coveredUnavailable = new Set<string>();
    const assignmentByEmployee = new Map(args.assignments.map((a) => [a.employee.id, a]));
    for (const day of args.days) {
      const key = dateKey(day);
      for (const shift of args.shifts) {
        for (const req of shift.requirements) {
          let actual = args.dailyEntries.filter(
            (e) =>
              e.date === key &&
              e.shiftId === shift.id &&
              e.status === RosterStatus.SCHEDULED &&
              e.employee.designationId === req.designationId,
          ).length;
          while (actual < req.minCount) {
            const replaced = args.dailyEntries.find(
              (e) =>
                e.date === key &&
                e.shiftId === shift.id &&
                e.status !== RosterStatus.SCHEDULED &&
                e.employee.designationId === req.designationId,
            );
            const replacement = this.findReplacementEmployee({
              date: day,
              shift,
              designationId: req.designationId,
              replacedEmployeeId: replaced?.employeeId,
              leaveMap: args.leaveMap,
              backupEmployees: args.backupEmployees,
              assignedEmployees: args.assignments.map((a) => a.employee),
              crossLocationEmployees: args.crossLocationEmployees,
              assignmentByEmployee,
              usedReplacementByDate,
            });
            replacements.push({
              date: day,
              shift,
              requiredDesignationId: req.designationId,
              replacedEmployeeId: replaced?.employeeId,
              replacementEmployee: replacement.employee,
              source: replacement.source,
              status: replacement.employee ? ReplacementStatus.SUGGESTED : ReplacementStatus.UNRESOLVED,
              overtimeFlag: replacement.overtimeFlag,
              reason: replacement.employee
                ? `${req.designation.name} coverage replacement for ${shift.code} on ${key}`
                : `Unresolved ${req.designation.name} coverage gap for ${shift.code} on ${key}`,
              score: replacement.score,
              explanation: replacement.explanation,
            });
            if (replaced?.employeeId) coveredUnavailable.add(`${replaced.employeeId}:${shift.id}:${key}`);
            if (replacement.employee) {
              usedReplacementByDate.add(`${replacement.employee.id}:${key}`);
              actual += 1;
            } else {
              break;
            }
          }
        }
        let scheduledTotal = args.dailyEntries.filter(
          (e) => e.date === key && e.shiftId === shift.id && e.status === RosterStatus.SCHEDULED,
        ).length + replacements.filter((r) => dateKey(r.date) === key && r.shift.id === shift.id && r.replacementEmployee).length;
        const expectedTotal = args.dailyTargets[shift.id] ?? 0;
        while (scheduledTotal < expectedTotal) {
          const replaced = args.dailyEntries.find(
            (e) =>
              e.date === key &&
              e.shiftId === shift.id &&
              e.status !== RosterStatus.SCHEDULED &&
              !coveredUnavailable.has(`${e.employeeId}:${shift.id}:${key}`),
          );
          const fallbackDesignationId = replaced?.employee?.designationId ?? shift.requirements[0]?.designationId;
          if (!fallbackDesignationId) break;
          const replacement = this.findReplacementEmployee({
            date: day,
            shift,
            designationId: fallbackDesignationId,
            replacedEmployeeId: replaced?.employeeId,
            leaveMap: args.leaveMap,
            backupEmployees: args.backupEmployees,
            assignedEmployees: args.assignments.map((a) => a.employee),
            crossLocationEmployees: args.crossLocationEmployees,
            assignmentByEmployee,
            usedReplacementByDate,
          });
          replacements.push({
            date: day,
            shift,
            requiredDesignationId: fallbackDesignationId,
            replacedEmployeeId: replaced?.employeeId,
            replacementEmployee: replacement.employee,
            source: replacement.source,
            status: replacement.employee ? ReplacementStatus.SUGGESTED : ReplacementStatus.UNRESOLVED,
            overtimeFlag: replacement.overtimeFlag,
            reason: replacement.employee
              ? `Headcount replacement for ${shift.code} on ${key}`
              : `Unresolved headcount gap for ${shift.code} on ${key}`,
            score: replacement.score,
            explanation: replacement.explanation,
          });
          if (replaced?.employeeId) coveredUnavailable.add(`${replaced.employeeId}:${shift.id}:${key}`);
          if (replacement.employee) {
            usedReplacementByDate.add(`${replacement.employee.id}:${key}`);
            scheduledTotal += 1;
          } else {
            args.issues.push({
              severity: shift.type === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
              code: 'SHIFT_HEADCOUNT_GAP',
              message: `${shift.code} ${shift.name} has ${scheduledTotal}/${expectedTotal} scheduled employees on ${key}.`,
              recommendation: 'Assign backup coverage, approve overtime, or reduce the shift target.',
              shiftId: shift.id,
              shiftCode: String(shift.code),
              date: key,
              required: expectedTotal,
              actual: scheduledTotal,
            });
            break;
          }
        }
      }
    }
    return replacements;
  }

  private findReplacementEmployee(args: {
    date: Date;
    shift: ShiftRule;
    designationId: string;
    replacedEmployeeId?: string;
    leaveMap: Record<string, Set<string>>;
    backupEmployees: EmployeeRule[];
    assignedEmployees: EmployeeRule[];
    crossLocationEmployees: EmployeeRule[];
    assignmentByEmployee: Map<string, WeeklyAssignmentDraft>;
    usedReplacementByDate: Set<string>;
  }) {
    const key = dateKey(args.date);
    const isAvailable = (e: EmployeeRule) =>
      e.id !== args.replacedEmployeeId &&
      e.designationId === args.designationId &&
      !args.leaveMap[e.id]?.has(key) &&
      !args.usedReplacementByDate.has(`${e.id}:${key}`);

    const backup = args.backupEmployees.find(isAvailable);
    if (backup) {
      return {
        employee: backup,
        source: ReplacementSource.BACKUP_POOL,
        overtimeFlag: false,
        score: 0,
        explanation: `${backup.name} selected from same-location backup pool.`,
      };
    }

    const sameLocation = args.assignedEmployees
      .filter(isAvailable)
      .sort((a, b) => {
        const aSame = args.assignmentByEmployee.get(a.id)?.shift.id === args.shift.id ? 0 : 1;
        const bSame = args.assignmentByEmployee.get(b.id)?.shift.id === args.shift.id ? 0 : 1;
        return aSame - bSame;
      })[0];
    if (sameLocation) {
      return {
        employee: sameLocation,
        source: ReplacementSource.SAME_LOCATION_OVERTIME,
        overtimeFlag: true,
        score: 10,
        explanation: `${sameLocation.name} is eligible in the same location and can cover with overtime approval.`,
      };
    }

    const crossLocation = args.crossLocationEmployees.find(isAvailable);
    if (crossLocation) {
      return {
        employee: crossLocation,
        source: ReplacementSource.CROSS_LOCATION_APPROVED,
        overtimeFlag: true,
        score: 20,
        explanation: `${crossLocation.name} is eligible in the same project from another location and requires approval.`,
      };
    }

    return {
      employee: null,
      source: ReplacementSource.UNRESOLVED,
      overtimeFlag: false,
      score: 999,
      explanation: 'No eligible backup, same-location overtime, or cross-location employee was available.',
    };
  }

  private async buildHistory(locationId: string, weekStart: Date) {
    const since = subDays(weekStart, 56);
    const weekly = await this.prisma.weeklyShiftAssignment.findMany({
      where: {
        rosterWeek: {
          locationId,
          weekStart: { gte: since, lt: weekStart },
          status: RosterWeekStatus.PUBLISHED,
        },
      },
      include: { shift: true, rosterWeek: true },
      orderBy: { rosterWeek: { weekStart: 'desc' } },
    });
    const replacements = await this.prisma.replacementAssignment.findMany({
      where: { rosterWeek: { locationId, weekStart: { gte: since, lt: weekStart } }, replacementEmployeeId: { not: null } },
    });
    const overrides = await this.prisma.rosterOverride.findMany({
      where: { rosterWeek: { locationId, weekStart: { gte: since, lt: weekStart } } },
    });
    const weekendEntries = await this.prisma.rosterEntry.findMany({
      where: { date: { gte: since, lt: weekStart }, shift: { locationId }, status: RosterStatus.SCHEDULED },
      select: { employeeId: true, date: true },
    });

    const byEmployee: Record<string, any> = {};
    for (const assignment of weekly) {
      byEmployee[assignment.employeeId] ??= {
        totalWeeks: 0,
        shiftCounts: {},
        nightWeeks: 0,
        lastWeekShiftId: null,
        lastWeekShiftCode: null,
        consecutiveNightWeeks: 0,
        replacementCount: 0,
        weekendCount: 0,
        overrideCount: 0,
      };
      const h = byEmployee[assignment.employeeId];
      h.totalWeeks += 1;
      h.shiftCounts[assignment.shiftId] = (h.shiftCounts[assignment.shiftId] ?? 0) + 1;
      if (assignment.shift.code === ShiftCode.C) h.nightWeeks += 1;
      if (!h.lastWeekShiftId) {
        h.lastWeekShiftId = assignment.shiftId;
        h.lastWeekShiftCode = assignment.shift.code;
      }
    }
    for (const assignment of weekly) {
      if (assignment.shift.code !== ShiftCode.C) continue;
      const h = byEmployee[assignment.employeeId];
      if (h && h.lastWeekShiftCode === ShiftCode.C) h.consecutiveNightWeeks += 1;
    }
    for (const replacement of replacements) {
      if (!replacement.replacementEmployeeId) continue;
      byEmployee[replacement.replacementEmployeeId] ??= { shiftCounts: {}, totalWeeks: 0, nightWeeks: 0 };
      byEmployee[replacement.replacementEmployeeId].replacementCount =
        (byEmployee[replacement.replacementEmployeeId].replacementCount ?? 0) + 1;
    }
    for (const override of overrides) {
      const value: any = override.newValue;
      const employeeId = value?.employeeId;
      if (!employeeId) continue;
      byEmployee[employeeId] ??= { shiftCounts: {}, totalWeeks: 0, nightWeeks: 0 };
      byEmployee[employeeId].overrideCount = (byEmployee[employeeId].overrideCount ?? 0) + 1;
    }
    for (const entry of weekendEntries) {
      const day = getDay(entry.date);
      if (![0, 6].includes(day)) continue;
      byEmployee[entry.employeeId] ??= { shiftCounts: {}, totalWeeks: 0, nightWeeks: 0 };
      byEmployee[entry.employeeId].weekendCount = (byEmployee[entry.employeeId].weekendCount ?? 0) + 1;
    }
    return byEmployee;
  }

  private fairnessScore(employee: EmployeeRule, shift: ShiftRule, history: any) {
    const h = history[employee.id] ?? {};
    let score = 0;
    if (h.lastWeekShiftId === shift.id) score += 30;
    score += (h.shiftCounts?.[shift.id] ?? 0) * 10;
    score += (h.totalWeeks ?? 0) * 2;
    if (shift.code === ShiftCode.C) {
      score += (h.nightWeeks ?? 0) * 20;
      score += (h.consecutiveNightWeeks ?? 0) * 40;
    }
    score += (h.replacementCount ?? 0) * 5;
    score += (h.weekendCount ?? 0) * 3;
    score += (h.overrideCount ?? 0) * 8;
    if ((employee.preferredShifts ?? []).includes(shift.code)) score -= 5;
    return score;
  }

  private assignmentExplanation(employee: EmployeeRule, shift: ShiftRule, history: any, reason: string) {
    const h = history[employee.id] ?? {};
    const nightText = shift.code === ShiftCode.C
      ? ` Night history: ${h.nightWeeks ?? 0} night week(s), ${h.consecutiveNightWeeks ?? 0} consecutive.`
      : '';
    return `Assigned to ${shift.name} because ${reason}. ${employee.name} is eligible as ${employee.designation.name}, has ${h.shiftCounts?.[shift.id] ?? 0} assignment(s) to this shift in the last 8 weeks, and ${h.totalWeeks ?? 0} total assigned week(s).${nightText}`;
  }

  private weeklyGroupForShift(shift: ShiftRule): WeeklyGroup {
    if (shift.code === ShiftCode.A) return WeeklyGroup.MORNING;
    if (shift.code === ShiftCode.B) return WeeklyGroup.AFTERNOON;
    if (shift.code === ShiftCode.C) return WeeklyGroup.NIGHT;
    return WeeklyGroup.GENERAL;
  }

  private buildFairnessSummary(assignments: WeeklyAssignmentDraft[]) {
    const scores = assignments.map((a) => a.score);
    const nightAssignments = assignments.filter((a) => a.shift.code === ShiftCode.C).length;
    const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      score: Math.max(0, Math.round(100 - average)),
      averageScore: Number(average.toFixed(2)),
      minScore: scores.length ? Math.min(...scores) : 0,
      maxScore: scores.length ? Math.max(...scores) : 0,
      nightAssignments,
      totalAssignments: assignments.length,
    };
  }

  private async previousWeekComparison(locationId: string, weekStart: Date, assignments: WeeklyAssignmentDraft[]) {
    const previous = await this.prisma.rosterWeek.findFirst({
      where: { locationId, weekStart: addDays(weekStart, -7), status: RosterWeekStatus.PUBLISHED },
      include: { weeklyAssignments: { include: { shift: true } } },
    });
    if (!previous) return { available: false };
    const previousByEmployee = new Map(previous.weeklyAssignments.map((a) => [a.employeeId, a.shiftId]));
    const repeatedShiftCount = assignments.filter((a) => previousByEmployee.get(a.employee.id) === a.shift.id).length;
    return {
      available: true,
      previousRosterWeekId: previous.id,
      previousAssignmentCount: previous.weeklyAssignments.length,
      repeatedShiftCount,
      changedShiftCount: assignments.length - repeatedShiftCount,
    };
  }

  private buildSnapshotPayload(
    context: any,
    weekStart: Date,
    weekEnd: Date,
    primaryEmployees: EmployeeRule[],
    backupEmployees: EmployeeRule[],
    policy: EffectiveRosterPolicy,
  ) {
    return {
      policy: {
        id: policy.id,
        organizationId: policy.organizationId,
        projectId: policy.projectId,
        locationId: policy.locationId,
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
        publishOverridePolicy: policy.publishOverridePolicy,
      },
      location: {
        id: context.location.id,
        name: context.location.name,
        projectId: context.location.projectId,
        updatedAt: context.location.updatedAt,
      },
      weekStart: dateKey(weekStart),
      weekEnd: dateKey(weekEnd),
      shiftRules: context.location.shifts.map((s: ShiftRule & { updatedAt?: Date }) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        distribution: s.distribution,
        priority: s.priority,
        type: s.type,
        locationId: s.locationId,
        updatedAt: s.updatedAt,
        requirements: s.requirements.map((r) => ({
          designationId: r.designationId,
          designationName: r.designation.name,
          isCritical: r.designation.isCritical,
          minCount: r.minCount,
        })),
      })),
      employeeEligibility: [...primaryEmployees, ...backupEmployees].map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        designationId: e.designationId,
        locationId: e.locationId,
        projectId: e.projectId,
        status: e.status,
        workforceCategory: e.workforceCategory,
        joinDate: dateKey(e.joinDate),
      })),
      leaveData: context.leaves.map((l: any) => ({
        id: l.id,
        employeeId: l.employeeId,
        startDate: dateKey(l.startDate),
        endDate: dateKey(l.endDate),
        status: l.status,
        updatedAt: l.updatedAt,
      })),
      distributionRules: {
        method: policy.roundingPolicy,
        shiftDistributionJson: policy.shiftDistributionJson,
      },
    };
  }

  private async saveDraft(args: {
    policy: EffectiveRosterPolicy;
    projectId: string;
    locationId: string;
    weekStart: Date;
    weekEnd: Date;
    actor: any;
    assignments: WeeklyAssignmentDraft[];
    replacements: ReplacementDraft[];
    targetResult: any;
    validationSummary: any;
    fairnessSummary: any;
    previousWeekComparison: any;
    snapshotPayload: any;
    configHash: string;
    capacity: any;
  }) {
    const existing = await this.prisma.rosterWeek.findUnique({
      where: { locationId_weekStart: { locationId: args.locationId, weekStart: args.weekStart } },
    });
    if (
      existing?.status === RosterWeekStatus.LOCKED &&
      existing.lockedByUserId &&
      existing.lockedByUserId !== args.actor?.userId &&
      existing.lockedAt &&
      addDays(existing.lockedAt, 1) > new Date()
    ) {
      throw new ConflictException(`Roster week is locked by ${existing.lockedByEmail ?? 'another user'}`);
    }

    const rosterWeek = await this.prisma.rosterWeek.upsert({
      where: { locationId_weekStart: { locationId: args.locationId, weekStart: args.weekStart } },
      create: {
        projectId: args.projectId,
        locationId: args.locationId,
        rosterPolicyId: args.policy.id,
        weekStart: args.weekStart,
        weekEnd: args.weekEnd,
        status: args.validationSummary.criticalCount > 0 ? RosterWeekStatus.VALIDATION_FAILED : RosterWeekStatus.PREVIEWED,
        requiredDailyHeadcount: args.policy.requiredDailyHeadcount,
        workingDaysPerEmployee: args.policy.workingDaysPerEmployee,
        weeklyOffsPerEmployee: args.policy.weeklyOffsPerEmployee,
        eligibleEmployeeCount: args.capacity.eligibleEmployeeCount,
        requiredWeeklySlots: args.capacity.requiredWeeklySlots,
        availableWeeklySlots: args.capacity.availableWeeklySlots,
        extraOrShortageSlots: args.capacity.extraOrShortageSlots,
        version: 1,
        lockedByUserId: null,
        lockedByEmail: null,
        lockedAt: null,
        generatedByUserId: args.actor?.userId,
        generatedByEmail: args.actor?.email,
        validationSummary: args.validationSummary,
        fairnessSummary: args.fairnessSummary,
        previousWeekComparison: args.previousWeekComparison,
        configHash: args.configHash,
      },
      update: {
        projectId: args.projectId,
        rosterPolicyId: args.policy.id,
        status: args.validationSummary.criticalCount > 0 ? RosterWeekStatus.VALIDATION_FAILED : RosterWeekStatus.PREVIEWED,
        requiredDailyHeadcount: args.policy.requiredDailyHeadcount,
        workingDaysPerEmployee: args.policy.workingDaysPerEmployee,
        weeklyOffsPerEmployee: args.policy.weeklyOffsPerEmployee,
        eligibleEmployeeCount: args.capacity.eligibleEmployeeCount,
        requiredWeeklySlots: args.capacity.requiredWeeklySlots,
        availableWeeklySlots: args.capacity.availableWeeklySlots,
        extraOrShortageSlots: args.capacity.extraOrShortageSlots,
        version: { increment: 1 },
        lockedByUserId: null,
        lockedByEmail: null,
        lockedAt: null,
        generatedByUserId: args.actor?.userId,
        generatedByEmail: args.actor?.email,
        validationSummary: args.validationSummary,
        fairnessSummary: args.fairnessSummary,
        previousWeekComparison: args.previousWeekComparison,
        configHash: args.configHash,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.replacementAssignment.deleteMany({ where: { rosterWeekId: rosterWeek.id } });
      await tx.weeklyShiftAssignment.deleteMany({ where: { rosterWeekId: rosterWeek.id } });
      await tx.rosterGenerationSnapshot.deleteMany({ where: { rosterWeekId: rosterWeek.id } });
      await tx.rosterGenerationSnapshot.create({
        data: {
          rosterWeekId: rosterWeek.id,
          shiftRules: args.snapshotPayload.shiftRules,
          designationRules: args.snapshotPayload.shiftRules.flatMap((s: any) => s.requirements),
          employeeEligibility: args.snapshotPayload.employeeEligibility,
          leaveData: args.snapshotPayload.leaveData,
          weeklyOffPolicy: {
            policy: 'POLICY_DERIVED',
            weeklyOffsPerEmployee: args.policy.weeklyOffsPerEmployee,
            workingDaysPerEmployee: args.policy.workingDaysPerEmployee,
          },
          distributionRules: args.snapshotPayload.distributionRules,
          configHash: args.configHash,
        },
      });
      if (args.assignments.length > 0) {
        await tx.weeklyShiftAssignment.createMany({
          data: args.assignments.map((a) => ({
            rosterWeekId: rosterWeek.id,
            employeeId: a.employee.id,
            projectId: args.projectId,
            locationId: args.locationId,
            weeklyGroup: a.weeklyGroup ?? this.weeklyGroupForShift(a.shift),
            shiftId: a.shift.id,
            designationId: a.employee.designationId,
            workingDaysCount: a.workingDaysCount ?? Math.max(0, 7 - (a.weeklyOffDates?.length ?? 0)),
            weeklyOffDate: a.weeklyOffDate,
            weeklyOffDates: (a.weeklyOffDates ?? []).map(dateKey),
            score: a.score,
            explanation: a.explanation,
            assignmentExplanation: a.explanation,
            source: a.source,
          })),
        });
      }
      if (args.replacements.length > 0) {
        await tx.replacementAssignment.createMany({
          data: args.replacements.map((r) => ({
            rosterWeekId: rosterWeek.id,
            date: r.date,
            shiftId: r.shift.id,
            requiredDesignationId: r.requiredDesignationId,
            replacedEmployeeId: r.replacedEmployeeId,
            replacementEmployeeId: r.replacementEmployee?.id,
            source: r.source,
            status: r.status,
            overtimeFlag: r.overtimeFlag,
            reason: r.reason,
            score: r.score,
            suggestionScore: r.score,
            explanation: r.explanation,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          action: 'ROSTER_WEEK_PREVIEW',
          entityType: 'RosterWeek',
          entityId: rosterWeek.id,
          actorUserId: args.actor?.userId,
          actorEmail: args.actor?.email,
          metadata: {
            weekStart: dateKey(args.weekStart),
            weekEnd: dateKey(args.weekEnd),
            targetSummary: args.targetResult.summary,
            validationSummary: args.validationSummary,
          },
        },
      });
    });
    return rosterWeek;
  }

  private async resolveRosterReportContext(params: RosterReportParams) {
    if (!params.startDate || !params.endDate) throw new BadRequestException('startDate and endDate are required');
    const start = startOfDay(parseISO(params.startDate));
    const end = startOfDay(parseISO(params.endDate));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || isBefore(end, start)) {
      throw new BadRequestException('Invalid roster report date range');
    }

    const period = ['week', 'month', 'three-month'].includes(String(params.period ?? '').toLowerCase())
      ? String(params.period).toLowerCase() as RosterReportPeriod
      : 'week';
    let scope: RosterReportScope = String(params.scope ?? '').toLowerCase() === 'all' ? 'all' : 'location';
    let locationIds = Array.isArray(params.locationIds)
      ? params.locationIds.filter(Boolean)
      : typeof params.locationIds === 'string' && params.locationIds.trim()
        ? params.locationIds.split(',').map((id) => id.trim()).filter(Boolean)
        : params.locationId ? [params.locationId] : [];

    const allowed = params.allowedLocationIds;
    if (allowed !== undefined) {
      if (allowed === null) {
        // unrestricted (admin) - leave scope/locationIds as requested
      } else if (allowed.length === 0) {
        throw new ForbiddenException('You are not assigned to a location, so no roster data is visible to you');
      } else if (scope === 'all') {
        // Restricted users can never see "all locations" - fall back to their own.
        scope = 'location';
        locationIds = allowed;
      } else if (locationIds.length) {
        const permitted = locationIds.filter((id) => allowed.includes(id));
        if (permitted.length === 0) throw new ForbiddenException('You do not have access to the requested location(s)');
        locationIds = permitted;
      } else {
        locationIds = allowed;
      }
    }

    const selectedLocations = locationIds.length
      ? await this.prisma.location.findMany({ where: { id: { in: locationIds } }, include: { project: true }, orderBy: { name: 'asc' } })
      : [];
    const projectId = params.projectId ?? selectedLocations[0]?.projectId;
    if (scope === 'location' && !locationIds.length) throw new BadRequestException('locationId is required for selected-location roster reports');
    if (!projectId) throw new BadRequestException('projectId is required for all-location roster reports');
    const project = projectId ? await this.prisma.project.findUnique({ where: { id: projectId } }) : selectedLocations[0]?.project ?? null;
    const locations = scope === 'location'
      ? selectedLocations
      : await this.prisma.location.findMany({ where: { projectId }, orderBy: { name: 'asc' } });

    return {
      period,
      scope,
      start,
      end,
      projectId,
      project,
      location: scope === 'location' && selectedLocations.length === 1 ? selectedLocations[0] : null,
      locations,
    };
  }

  private periodWeekStarts(start: Date, end: Date) {
    const starts: Date[] = [];
    let cursor = startOfDay(start);
    const day = getDay(cursor);
    cursor = addDays(cursor, day === 0 ? -6 : 1 - day);
    while (!isAfter(cursor, end)) {
      starts.push(cursor);
      cursor = addDays(cursor, 7);
    }
    return starts;
  }

  private async loadRosterReport(params: RosterReportParams) {
    const context = await this.resolveRosterReportContext(params);
    const and: any[] = [
      { weekStart: { lte: context.end } },
      { weekEnd: { gte: context.start } },
      { OR: [{ projectId: context.projectId }, { location: { projectId: context.projectId } }] },
    ];
    if (context.scope === 'location') and.push({ locationId: { in: context.locations.map((location) => location.id) } });

    const weeks = await this.prisma.rosterWeek.findMany({
      where: { AND: and },
      select: { id: true },
    });
    const rawDetails = await Promise.all(weeks.map((week) => this.weeklyDetails(week.id)));
    const details = rawDetails.filter((detailsItem: any) => (
      Number(detailsItem.eligibleEmployeeCount ?? 0) > 0 ||
      (detailsItem.weeklyAssignments ?? []).length > 0 ||
      (detailsItem.dailyEntries ?? []).length > 0
    ));
    details.sort((a: any, b: any) => {
      const locationCompare = String(a.location?.name ?? '').localeCompare(String(b.location?.name ?? ''));
      if (locationCompare !== 0) return locationCompare;
      return new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime();
    });

    return {
      period: context.period,
      scope: context.scope,
      start: context.start,
      end: context.end,
      project: context.project,
      location: context.location,
      details,
    };
  }

  private reportSummary(details: any[], start: Date, end: Date) {
    const entries = this.periodEntries(details, start, end);
    const employeeKeys = new Set(entries.map((entry: any) => `${entry.locationId}:${entry.employeeId}`));
    const requiredDailyHeadcount = this.requiredDailyHeadcountSummary(details);
    return {
      weeks: details.length,
      locations: new Set(details.map((detailsItem: any) => detailsItem.locationId)).size,
      employees: employeeKeys.size,
      requiredDailyHeadcount: requiredDailyHeadcount.perLocation,
      requiredDailyHeadcountTotal: requiredDailyHeadcount.total,
      requiredDailyHeadcountCalculation: requiredDailyHeadcount.calculation,
      criticalIssues: details.reduce((sum, detailsItem: any) => sum + Number(detailsItem.validationSummary?.criticalCount ?? 0), 0),
      warnings: details.reduce((sum, detailsItem: any) => sum + Number(detailsItem.validationSummary?.warningCount ?? 0), 0),
    };
  }

  private requiredDailyHeadcountSummary(details: any[]) {
    const byLocation = new Map<string, number>();
    for (const detailsItem of details) {
      const locationKey = detailsItem.locationId ?? detailsItem.location?.id ?? detailsItem.location?.name;
      if (!locationKey || byLocation.has(locationKey)) continue;
      const required = Number(
        detailsItem.requiredDailyHeadcount ??
        detailsItem.validationSummary?.policy?.requiredDailyHeadcount ??
        0,
      );
      if (Number.isFinite(required) && required > 0) byLocation.set(locationKey, required);
    }

    const values = Array.from(byLocation.values());
    const total = values.reduce((sum, value) => sum + value, 0);
    const uniqueValues = Array.from(new Set(values));
    const perLocation = uniqueValues.length === 1 ? uniqueValues[0] : null;
    const calculation = values.length === 0
      ? '0'
      : uniqueValues.length === 1
        ? `${uniqueValues[0]} * ${values.length} = ${total}`
        : `${values.join(' + ')} = ${total}`;

    return {
      perLocation,
      locationCount: values.length,
      total,
      calculation,
    };
  }

  private periodEntries(details: any[], start: Date, end: Date) {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return details.flatMap((detailsItem: any) => (detailsItem.dailyEntries ?? []).map((entry: any) => ({
      ...entry,
      project: detailsItem.location?.project,
      projectId: detailsItem.projectId ?? detailsItem.location?.projectId,
      location: detailsItem.location,
      locationId: detailsItem.locationId,
      rosterWeekId: detailsItem.id,
      weekStart: dateKey(detailsItem.weekStart),
      weekEnd: dateKey(detailsItem.weekEnd),
    }))).filter((entry: any) => {
      const date = typeof entry.date === 'string' ? startOfDay(parseISO(entry.date.slice(0, 10))) : startOfDay(entry.date);
      const time = date.getTime();
      return time >= startTime && time <= endTime;
    });
  }

  private periodCalendarRows(details: any[], start: Date, end: Date) {
    const dates = eachDayOfInterval({ start, end }).map(dateKey);
    const rows = new Map<string, any>();
    const ensureRow = (source: any, detailsItem: any) => {
      const employee = source.employee;
      if (!employee?.id) return null;
      const key = `${detailsItem.locationId}:${employee.id}`;
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          locationId: detailsItem.locationId,
          location: detailsItem.location?.name ?? '',
          project: detailsItem.location?.project?.name ?? '',
          employeeId: employee.id,
          employeeCode: employee.employeeCode ?? '',
          employee: employee.name ?? '',
          designation: employee.designation?.name ?? '',
          days: Object.fromEntries(dates.map((date) => [date, null])),
        });
      }
      return rows.get(key);
    };

    for (const detailsItem of details) {
      for (const assignment of detailsItem.weeklyAssignments ?? []) ensureRow(assignment, detailsItem);
      for (const entry of detailsItem.dailyEntries ?? []) {
        const date = typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date);
        if (!dates.includes(date)) continue;
        const row = ensureRow(entry, detailsItem);
        if (!row) continue;
        row.days[date] = {
          label: this.rosterEntryLabel(entry),
          status: entry.status,
          shiftCode: entry.shift?.code,
          shiftName: entry.shift?.name,
          rosterWeekId: detailsItem.id,
        };
      }
    }
    return Array.from(rows.values()).sort((a, b) => {
      const locationCompare = String(a.location).localeCompare(String(b.location));
      if (locationCompare !== 0) return locationCompare;
      return String(a.employee).localeCompare(String(b.employee));
    });
  }

  private periodDailyCoverageRows(details: any[], start: Date, end: Date) {
    const rows: any[] = [];
    for (const detailsItem of details) {
      const weekStart = startOfDay(detailsItem.weekStart);
      const weekEnd = startOfDay(detailsItem.weekEnd);
      const rangeStart = isBefore(weekStart, start) ? start : weekStart;
      const rangeEnd = isAfter(weekEnd, end) ? end : weekEnd;
      for (const date of eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(dateKey)) {
        for (const target of detailsItem.targetSummary ?? []) {
          const actual = (detailsItem.dailyEntries ?? []).filter((entry: any) => {
            const entryDate = typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date);
            return entryDate === date && entry.shiftId === target.shiftId && entry.status === RosterStatus.SCHEDULED;
          }).length;
          const targetCount = Number(target.dailyTarget ?? target.target ?? 0);
          rows.push({
            location: detailsItem.location?.name,
            weekStart: dateKey(detailsItem.weekStart),
            date,
            shift: target.shiftName ?? this.shiftLabel({ code: target.shiftCode }),
            shiftCode: target.shiftCode,
            actual,
            target: targetCount,
            variance: actual - targetCount,
          });
        }
      }
    }
    return rows;
  }

  private periodValidationRows(details: any[]) {
    return details.flatMap((detailsItem: any) => ((detailsItem.validationSummary as any)?.issues ?? []).map((issue: any) => ({
      location: detailsItem.location?.name,
      weekStart: dateKey(detailsItem.weekStart),
      weekEnd: dateKey(detailsItem.weekEnd),
      ...issue,
    })));
  }

  private async rosterWorkbookBuffer(details: any[], params: RosterReportParams) {
    const start = startOfDay(parseISO(params.startDate));
    const end = startOfDay(parseISO(params.endDate));
    const dates = eachDayOfInterval({ start, end }).map(dateKey);
    const calendarRows = this.periodCalendarRows(details, start, end);
    const periodLabel = String(params.period ?? 'week').toUpperCase();
    const scopeLabel = String(params.scope ?? 'location').toLowerCase() === 'all' ? 'All locations' : 'Selected location';
    const projectName = details[0]?.location?.project?.name ?? params.projectId ?? 'Project';
    const distinctLocationNames = Array.from(new Set(details.map((detailsItem: any) => detailsItem.location?.name).filter(Boolean)));
    const locationName = String(params.scope ?? '').toLowerCase() === 'all'
      ? 'All locations'
      : distinctLocationNames.join(', ') || params.locationId || 'Selected location';
    const requiredDailyHeadcount = this.requiredDailyHeadcountSummary(details);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RosterOps';
    workbook.created = new Date();
    workbook.modified = new Date();

    const matrixSheet = workbook.addWorksheet('Roster Matrix', {
      views: [{ state: 'frozen', xSplit: 4, ySplit: 4, topLeftCell: 'E5', activeCell: 'E5' }],
      properties: { defaultRowHeight: 24 },
    });
    const totalColumns = 4 + dates.length;
    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
    const fillCell = (cell: ExcelJS.Cell, color: string) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    };

    matrixSheet.mergeCells(1, 1, 1, Math.max(totalColumns, 6));
    const titleCell = matrixSheet.getCell(1, 1);
    titleCell.value = `${periodLabel} Roster Matrix`;
    titleCell.font = { bold: true, size: 16, color: { argb: '0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    matrixSheet.getRow(1).height = 30;

    matrixSheet.mergeCells(2, 1, 2, Math.max(totalColumns, 6));
    const metaCell = matrixSheet.getCell(2, 1);
    metaCell.value = `Project: ${projectName}    Scope: ${scopeLabel}    Location: ${locationName}    Period: ${dateKey(start)} to ${dateKey(end)}    Generated: ${new Date().toLocaleString('en-IN')}`;
    metaCell.font = { size: 10, color: { argb: '475569' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    matrixSheet.getRow(2).height = 24;

    const headers = ['Location', 'Employee Code', 'Employee', 'Designation'];
    matrixSheet.getRow(4).height = 32;
    headers.forEach((header, index) => {
      const cell = matrixSheet.getCell(4, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: '0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = border;
      fillCell(cell, 'E2E8F0');
    });
    dates.forEach((date, index) => {
      const col = index + 5;
      const cell = matrixSheet.getCell(4, col);
      cell.value = format(parseISO(date), 'EEE dd MMM');
      cell.font = { bold: true, color: { argb: '334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = border;
      const day = parseISO(date).getDay();
      fillCell(cell, [0, 6].includes(day) ? 'F1F5F9' : 'DBEAFE');
      matrixSheet.getColumn(col).width = 13;
    });
    matrixSheet.getColumn(1).width = 22;
    matrixSheet.getColumn(2).width = 16;
    matrixSheet.getColumn(3).width = 28;
    matrixSheet.getColumn(4).width = 30;

    const firstDataRow = 5;
    const lastFilterRow = firstDataRow + Math.max(calendarRows.length, 1) - 1;
    matrixSheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: lastFilterRow, column: totalColumns },
    };
    calendarRows.forEach((row, rowIndex) => {
      const rowNumber = firstDataRow + rowIndex;
      const sheetRow = matrixSheet.getRow(rowNumber);
      sheetRow.height = 26;
      const baseValues = [row.location, row.employeeCode, row.employee, row.designation];
      baseValues.forEach((value, index) => {
        const cell = matrixSheet.getCell(rowNumber, index + 1);
        cell.value = value;
        cell.border = border;
        cell.alignment = { vertical: 'middle', horizontal: index < 2 ? 'center' : 'left', wrapText: true };
        if (index === 2) cell.font = { bold: true, color: { argb: '0F172A' } };
        fillCell(cell, rowIndex % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
      });
      dates.forEach((date, dateIndex) => {
        const day = row.days?.[date];
        const cell = matrixSheet.getCell(rowNumber, dateIndex + 5);
        cell.value = day?.label ?? '';
        cell.font = { bold: Boolean(day?.label), color: { argb: '0F172A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = border;
        fillCell(cell, this.rosterCellFill(day?.status, day?.shiftCode, rowIndex));
      });
    });

    const policyTargetRow = firstDataRow + Math.max(calendarRows.length, 1);
    matrixSheet.getRow(policyTargetRow).height = 34;
    matrixSheet.mergeCells(policyTargetRow, 1, policyTargetRow, 4);
    const policyTargetLabel = matrixSheet.getCell(policyTargetRow, 1);
    policyTargetLabel.value = 'Required Daily Headcount Total';
    policyTargetLabel.font = { bold: true, color: { argb: '0F172A' } };
    policyTargetLabel.alignment = { vertical: 'middle', horizontal: 'left' };
    policyTargetLabel.border = border;
    fillCell(policyTargetLabel, 'DBEAFE');
    dates.forEach((_, index) => {
      const cell = matrixSheet.getCell(policyTargetRow, index + 5);
      cell.value = requiredDailyHeadcount.total;
      cell.font = { bold: true, size: 12, color: { argb: '1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border;
      fillCell(cell, 'EFF6FF');
    });

    if (calendarRows.length === 0) {
      matrixSheet.mergeCells(firstDataRow, 1, firstDataRow, Math.max(totalColumns, 6));
      const emptyCell = matrixSheet.getCell(firstDataRow, 1);
      emptyCell.value = 'No roster weeks found for this period. Preview or publish weekly rosters first, then export the period report.';
      emptyCell.font = { color: { argb: '64748B' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      emptyCell.border = border;
      fillCell(emptyCell, 'F8FAFC');
    }

    this.addJsonWorksheet(workbook, 'Report Summary', [this.reportSummary(details, start, end)]);
    this.addJsonWorksheet(workbook, 'Weekly Summary', details.map((detailsItem: any) => this.summaryRows(detailsItem)[0]));
    this.addJsonWorksheet(workbook, 'Daily Coverage', this.periodDailyCoverageRows(details, start, end));
    this.addJsonWorksheet(workbook, 'Roster Entries', this.periodEntries(details, start, end).map((entry: any) => ({
      location: entry.location?.name,
      weekStart: entry.weekStart,
      date: typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date),
      employeeCode: entry.employee?.employeeCode,
      employee: entry.employee?.name,
      designation: entry.employee?.designation?.name,
      shift: entry.shift?.name,
      shiftCode: entry.shift?.code,
      status: entry.status,
      entryType: entry.entryType,
      notes: entry.notes,
    })));
    this.addJsonWorksheet(workbook, 'Replacement Suggestions', details.flatMap((detailsItem: any) => this.replacementRows(detailsItem).map((row) => ({
      location: detailsItem.location?.name,
      weekStart: dateKey(detailsItem.weekStart),
      ...row,
    }))));
    this.addJsonWorksheet(workbook, 'Fairness', details.flatMap((detailsItem: any) => this.fairnessRows(detailsItem).map((row) => ({
      location: detailsItem.location?.name,
      weekStart: dateKey(detailsItem.weekStart),
      ...row,
    }))));
    this.addJsonWorksheet(workbook, 'Validation Issues', this.periodValidationRows(details));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addJsonWorksheet(workbook: ExcelJS.Workbook, name: string, rows: any[]) {
    const sheet = workbook.addWorksheet(name.slice(0, 31));
    const safeRows = rows.length ? rows : [{ message: 'No data' }];
    const keys = Array.from(safeRows.reduce<Set<string>>((set, row: any) => {
      Object.keys(row ?? {}).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()));
    sheet.columns = keys.map((key) => ({
      header: key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()),
      key,
      width: Math.min(42, Math.max(14, key.length + 6)),
    }));
    sheet.addRows(safeRows);
    this.formatRosterWorksheet(sheet);
  }

  private formatRosterWorksheet(sheet: ExcelJS.Worksheet) {
    sheet.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }];
    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
    sheet.getRow(1).height = 24;
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
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: Math.max(1, sheet.columnCount) },
    };
  }

  private rosterCellFill(status?: string, shiftCode?: string, rowIndex = 0) {
    if (status === RosterStatus.SCHEDULED) {
      if (shiftCode === ShiftCode.A) return 'E0F2FE';
      if (shiftCode === ShiftCode.B) return 'FEF3C7';
      if (shiftCode === ShiftCode.C) return 'EDE9FE';
      if (shiftCode === ShiftCode.G) return 'DCFCE7';
      return 'F1F5F9';
    }
    if (status === RosterStatus.WEEKLY_OFF) return 'F1F5F9';
    if (status === RosterStatus.ON_LEAVE) return 'FEE2E2';
    if (status === RosterStatus.GENERAL) return 'CCFBF1';
    if (status === RosterStatus.REPLACEMENT) return 'DCFCE7';
    if (status === RosterStatus.EXTRA_DUTY) return 'DBEAFE';
    return rowIndex % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
  }

  private rosterEntryLabel(entry: any) {
    if (entry.status === RosterStatus.SCHEDULED) return this.shiftLabel(entry.shift);
    if (entry.status === RosterStatus.WEEKLY_OFF) return 'OFF';
    if (entry.status === RosterStatus.ON_LEAVE) return 'LEAVE';
    if (entry.status === RosterStatus.GENERAL) return 'GEN';
    if (entry.status === RosterStatus.REPLACEMENT) return 'REPL';
    if (entry.status === RosterStatus.EXTRA_DUTY) return 'EXTRA';
    return String(entry.status ?? '');
  }

  private shiftLabel(shift: any) {
    const code = String(shift?.code ?? '').toUpperCase();
    if (code === ShiftCode.A) return 'Morning';
    if (code === ShiftCode.B) return 'Afternoon';
    if (code === ShiftCode.C) return 'Night';
    if (code === ShiftCode.G) return 'General';
    return shift?.name ?? code;
  }

  private summaryRows(details: any) {
    const validation = details.validationSummary ?? {};
    return [
      {
        project: details.location?.project?.name,
        location: details.location?.name,
        weekStart: dateKey(details.weekStart),
        weekEnd: dateKey(details.weekEnd),
        status: details.status,
        eligibleEmployees: details.eligibleEmployeeCount,
        requiredDailyHeadcount: details.requiredDailyHeadcount,
        workingDaysPerEmployee: details.workingDaysPerEmployee,
        weeklyOffsPerEmployee: details.weeklyOffsPerEmployee,
        requiredWeeklySlots: details.requiredWeeklySlots,
        availableWeeklySlots: details.availableWeeklySlots,
        extraOrShortageSlots: details.extraOrShortageSlots,
        criticalIssues: validation.criticalCount ?? 0,
        warnings: validation.warningCount ?? 0,
        fairnessScore: details.fairnessSummary?.score,
      },
    ];
  }

  private weeklyRosterRows(details: any) {
    const dates = eachDayOfInterval({ start: details.weekStart, end: details.weekEnd }).map(dateKey);
    const byEmployee = new Map<string, any>();
    for (const assignment of details.weeklyAssignments ?? []) {
      byEmployee.set(assignment.employeeId, {
        employeeCode: assignment.employee?.employeeCode,
        employee: assignment.employee?.name,
        designation: assignment.employee?.designation?.name,
        weeklyGroup: assignment.weeklyGroup,
        shift: assignment.shift?.name,
        weeklyOffs: Array.isArray(assignment.weeklyOffDates)
          ? assignment.weeklyOffDates.join(', ')
          : assignment.weeklyOffDate ? dateKey(assignment.weeklyOffDate) : '',
      });
    }
    for (const entry of details.dailyEntries ?? []) {
      const row = byEmployee.get(entry.employeeId);
      if (!row) continue;
      const key = typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date);
      row[key] = entry.status === RosterStatus.SCHEDULED ? entry.shift?.code ?? entry.shiftId : entry.status;
    }
    return Array.from(byEmployee.values()).map((row) => {
      for (const date of dates) row[date] ??= '';
      return row;
    });
  }

  private dailyCoverageRows(details: any) {
    const dates = eachDayOfInterval({ start: details.weekStart, end: details.weekEnd }).map(dateKey);
    return dates.map((date) => {
      const row: any = { date };
      let total = 0;
      for (const target of details.targetSummary ?? []) {
        const count = (details.dailyEntries ?? []).filter((entry: any) => {
          const entryDate = typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date);
          return entryDate === date && entry.shiftId === target.shiftId && entry.status === RosterStatus.SCHEDULED;
        }).length;
        row[target.shiftCode ?? target.shiftName ?? target.shiftId] = count;
        total += count;
      }
      row.total = total;
      return row;
    });
  }

  private shiftViewRows(details: any) {
    return (details.dailyEntries ?? []).map((entry: any) => ({
      date: typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date),
      shift: entry.shift?.name,
      shiftCode: entry.shift?.code,
      employeeCode: entry.employee?.employeeCode,
      employee: entry.employee?.name,
      designation: entry.employee?.designation?.name,
      status: entry.status,
      entryType: entry.entryType,
      notes: entry.notes,
    }));
  }

  private designationCoverageRows(details: any) {
    const rows: any[] = [];
    const entries = details.dailyEntries ?? [];
    for (const target of details.targetSummary ?? []) {
      const shiftAssignments = (details.weeklyAssignments ?? []).filter((assignment: any) => assignment.shiftId === target.shiftId);
      const designations = new Set(shiftAssignments.map((assignment: any) => assignment.employee?.designation?.name).filter(Boolean));
      for (const date of eachDayOfInterval({ start: details.weekStart, end: details.weekEnd }).map(dateKey)) {
        for (const designation of designations) {
          const actual = entries.filter((entry: any) => {
            const entryDate = typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date);
            return entryDate === date && entry.shiftId === target.shiftId && entry.status === RosterStatus.SCHEDULED && entry.employee?.designation?.name === designation;
          }).length;
          rows.push({ date, shift: target.shiftName, designation, actual });
        }
      }
    }
    return rows;
  }

  private leaveImpactRows(details: any) {
    return (details.dailyEntries ?? [])
      .filter((entry: any) => entry.status === RosterStatus.ON_LEAVE)
      .map((entry: any) => ({
        date: typeof entry.date === 'string' ? entry.date.slice(0, 10) : dateKey(entry.date),
        employee: entry.employee?.name,
        designation: entry.employee?.designation?.name,
        assignedShift: entry.shift?.name,
        status: entry.status,
      }));
  }

  private replacementRows(details: any) {
    return (details.replacementAssignments ?? []).map((replacement: any) => ({
      date: dateKey(replacement.date),
      shift: replacement.shift?.name,
      replacedEmployee: replacement.replacedEmployee?.name,
      replacementEmployee: replacement.replacementEmployee?.name,
      source: replacement.source,
      status: replacement.status,
      overtimeFlag: replacement.overtimeFlag,
      score: replacement.score,
      reason: replacement.reason,
      explanation: replacement.explanation,
    }));
  }

  private fairnessRows(details: any) {
    return (details.weeklyAssignments ?? []).map((assignment: any) => ({
      employeeCode: assignment.employee?.employeeCode,
      employee: assignment.employee?.name,
      designation: assignment.employee?.designation?.name,
      shift: assignment.shift?.name,
      weeklyGroup: assignment.weeklyGroup,
      score: assignment.score,
      explanation: assignment.assignmentExplanation ?? assignment.explanation,
    }));
  }

  private targetSummaryFromAssignments(assignments: any[]) {
    const map: Record<string, any> = {};
    for (const assignment of assignments) {
      const shift = assignment.shift;
      map[assignment.shiftId] ??= {
        shiftId: assignment.shiftId,
        shiftCode: shift?.code,
        shiftName: shift?.name,
        actual: 0,
      };
      map[assignment.shiftId].actual += 1;
    }
    return Object.values(map);
  }

  private dailyTargetsFromValidation(validationSummary: any) {
    const summary = validationSummary?.targetSummary ?? validationSummary?.dailyTargetSummary ?? [];
    return summary.reduce((acc: Record<string, number>, item: any) => {
      acc[item.shiftId] = Number(item.dailyTarget ?? item.target ?? 0);
      return acc;
    }, {});
  }

  private async synthesizeDailyEntries(rosterWeek: any) {
    const days = eachDayOfInterval({ start: rosterWeek.weekStart, end: rosterWeek.weekEnd });
    const leaves = await this.prisma.leave.findMany({
      where: {
        employeeId: { in: rosterWeek.weeklyAssignments.map((assignment: any) => assignment.employeeId) },
        status: LeaveStatus.APPROVED,
        startDate: { lte: rosterWeek.weekEnd },
        endDate: { gte: rosterWeek.weekStart },
      },
    });
    const leaveMap = this.buildLeaveMap(leaves, days);
    const dailyTargets = this.dailyTargetsFromValidation(rosterWeek.validationSummary);
    const policy = this.policyFromRosterWeek(rosterWeek);
    const assignments: WeeklyAssignmentDraft[] = rosterWeek.weeklyAssignments.map((assignment: any) => ({
      employee: assignment.employee,
      shift: assignment.shift,
      score: assignment.score ?? 0,
      explanation: assignment.assignmentExplanation ?? assignment.explanation ?? '',
      weeklyOffDate: assignment.weeklyOffDate,
      weeklyOffDates: Array.isArray(assignment.weeklyOffDates)
        ? assignment.weeklyOffDates.map((date: string) => startOfDay(parseISO(date)))
        : assignment.weeklyOffDate ? [assignment.weeklyOffDate] : [],
      source: assignment.source,
      weeklyGroup: assignment.weeklyGroup,
      workingDaysCount: assignment.workingDaysCount,
    }));
    const issues: Issue[] = [];
    return this.buildDailyEntryPreview(assignments, days, leaveMap, dailyTargets, policy, issues);
  }

  private policyFromRosterWeek(rosterWeek: any): EffectiveRosterPolicy {
    const validationPolicy = rosterWeek.validationSummary?.policy ?? {};
    return {
      id: rosterWeek.rosterPolicyId ?? validationPolicy.id ?? '',
      organizationId: validationPolicy.organizationId ?? '',
      projectId: rosterWeek.projectId ?? validationPolicy.projectId ?? rosterWeek.location?.projectId ?? '',
      locationId: rosterWeek.locationId,
      requiredDailyHeadcount: rosterWeek.requiredDailyHeadcount ?? validationPolicy.requiredDailyHeadcount ?? 49,
      workingDaysPerEmployee: rosterWeek.workingDaysPerEmployee ?? validationPolicy.workingDaysPerEmployee ?? 6,
      weeklyOffsPerEmployee: rosterWeek.weeklyOffsPerEmployee ?? validationPolicy.weeklyOffsPerEmployee ?? 1,
      shiftDistributionJson: this.normalizeDistribution(validationPolicy.shiftDistributionJson),
      roundingPolicy: validationPolicy.roundingPolicy ?? RoundingPolicy.LARGEST_REMAINDER_DESIGNATION_PRIORITY,
      generalBufferEnabled: validationPolicy.generalBufferEnabled ?? true,
      allowExtraDuty: validationPolicy.allowExtraDuty ?? true,
      allowOvertime: validationPolicy.allowOvertime ?? true,
      weekStartDay: validationPolicy.weekStartDay ?? 'MONDAY',
      minimumRestHours: validationPolicy.minimumRestHours ?? 12,
      publishOverridePolicy: validationPolicy.publishOverridePolicy ?? 'CRITICAL_REQUIRES_APPROVAL',
      isActive: true,
    };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roster')
export class RostersController {
  constructor(private svc: RostersService) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('locationId') locationId?: string,
    @Query('employeeId') employeeId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.svc.list({ from, to, locationId, employeeId, allowedLocationIds: getAllowedLocationIds(user) });
  }

  @Get('my')
  my(@CurrentUser('employeeId') employeeId: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!employeeId) return [];
    return this.svc.myRoster(employeeId, from, to);
  }

  @Get('coverage')
  coverage(@Query('locationId') locationId: string, @Query('date') date: string, @CurrentUser() user?: any) {
    return this.svc.coverage(locationId, date, getAllowedLocationIds(user));
  }

  @Get('weekly')
  weekly(@Query('locationId') locationId: string, @Query('weekStart') weekStart: string, @CurrentUser() user?: any) {
    if (!locationId || !weekStart) return null;
    return this.svc.findWeekly(locationId, weekStart, getAllowedLocationIds(user));
  }

  @Get('period')
  periodReport(
    @Query('projectId') projectId: string,
    @Query('locationId') locationId: string,
    @Query('locationIds') locationIds: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('period') period?: string,
    @Query('scope') scope?: string,
    @CurrentUser() user?: any,
  ) {
    return this.svc.periodReport({ projectId, locationId, locationIds, startDate, endDate, period, scope, allowedLocationIds: getAllowedLocationIds(user) });
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('period/preview')
  previewPeriod(@Body() dto: PeriodPreviewDto, @CurrentUser() user: any) {
    return this.svc.previewPeriod(dto, user);
  }

  @Get('export.xlsx')
  async exportRosterReport(
    @Query('projectId') projectId: string,
    @Query('locationId') locationId: string,
    @Query('locationIds') locationIds: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('period') period: string,
    @Query('scope') scope: string,
    @Res() res: Response,
    @CurrentUser() user?: any,
  ) {
    const buffer = await this.svc.exportRosterReport({ projectId, locationId, locationIds, startDate, endDate, period, scope, allowedLocationIds: getAllowedLocationIds(user) });
    const scopeLabel = scope === 'all' ? 'all-locations' : 'selected-location';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="roster-${period || 'period'}-${scopeLabel}-${startDate}-to-${endDate}.xlsx"`);
    res.send(buffer);
  }

  @Get('weekly/:id')
  weeklyDetails(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.svc.weeklyDetails(id, undefined, getAllowedLocationIds(user));
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('weekly/preview')
  weeklyPreview(@Body() dto: WeeklyPreviewDto, @CurrentUser() user: any) {
    return this.svc.weeklyPreview(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('weekly/:id/publish')
  publishWeekly(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.publishWeekly(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('weekly/:id/regenerate')
  regenerateWeekly(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.regenerateWeekly(id, user);
  }

  @Get('weekly/:id/replacement-suggestions')
  replacementSuggestions(
    @Param('id') id: string,
    @Query('date') date?: string,
    @Query('shiftId') shiftId?: string,
    @Query('designationId') designationId?: string,
    @Query('originalEmployeeId') originalEmployeeId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.svc.replacementSuggestions(id, { date, shiftId, designationId, originalEmployeeId }, getAllowedLocationIds(user));
  }

  @Get('weekly/:id/export.xlsx')
  async exportWeekly(@Param('id') id: string, @Res() res: Response, @CurrentUser() user?: any) {
    const buffer = await this.svc.exportWeekly(id, getAllowedLocationIds(user));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-roster-${id}.xlsx"`);
    res.send(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER)
  @Post('weekly/:id/override')
  createOverride(@Param('id') id: string, @Body() dto: OverrideDto, @CurrentUser() user: any) {
    return this.svc.createOverride(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.COMPLIANCE_ADMIN)
  @Post('weekly/:id/override/:overrideId/approve')
  approveOverride(@Param('id') id: string, @Param('overrideId') overrideId: string, @CurrentUser() user: any) {
    return this.svc.approveOverride(id, overrideId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER)
  @Post('generate')
  generate(@Body() dto: GenerateDto, @CurrentUser() user: any) {
    return this.svc.generate(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER)
  @Post('assign')
  assign(@Body() dto: AssignDto) {
    return this.svc.assign(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.ROSTER_MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({ imports: [RosterPoliciesModule], controllers: [RostersController], providers: [RostersService] })
export class RostersModule {}
