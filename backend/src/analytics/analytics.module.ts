import { Controller, Get, Module, UseGuards, Injectable, Query, Res } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { RosterStatus, UserRole } from '@prisma/client';
import { addDays, eachDayOfInterval, parseISO, subDays, format, startOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { Response } from 'express';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const [
      employees, activeEmployees, locations, projects, designations,
      pendingLeaves, shifts, todayEntries,
    ] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { status: 'ACTIVE' } }),
      this.prisma.location.count(),
      this.prisma.project.count(),
      this.prisma.designation.count(),
      this.prisma.leave.count({ where: { status: 'PENDING' } }),
      this.prisma.shift.count(),
      this.prisma.rosterEntry.count({
        where: { date: new Date(new Date().toISOString().slice(0, 10)) },
      }),
    ]);

    return {
      employees, activeEmployees, locations, projects, designations,
      pendingLeaves, shifts, todayEntries,
    };
  }

  async statusBreakdown() {
    const rows = await this.prisma.employee.groupBy({ by: ['status'], _count: true });
    return rows.map((r) => ({ status: r.status, count: r._count }));
  }

  async designationBreakdown() {
    const rows = await this.prisma.employee.groupBy({ by: ['designationId'], _count: true });
    const designations = await this.prisma.designation.findMany();
    return rows.map((r) => ({
      designation: designations.find((d) => d.id === r.designationId)?.name ?? '—',
      count: r._count,
    }));
  }

  async shiftDistribution(days = 30) {
    const from = subDays(new Date(), days);
    const rows = await this.prisma.rosterEntry.groupBy({
      by: ['shiftId'],
      where: { date: { gte: from } },
      _count: true,
    });
    const shifts = await this.prisma.shift.findMany();
    return rows.map((r) => {
      const s = shifts.find((x) => x.id === r.shiftId);
      return { shift: s ? `${s.code} – ${s.name}` : '—', count: r._count };
    });
  }

  async leavesByMonth() {
    // group by year-month in JS (Prisma groupBy on date is awkward across DBs)
    const leaves = await this.prisma.leave.findMany({ where: { status: 'APPROVED' } });
    const map: Record<string, number> = {};
    for (const l of leaves) {
      const key = format(l.startDate, 'yyyy-MM');
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
  }

  async fairness() {
    // Compute night-shift count per employee (last 30 days)
    const since = subDays(new Date(), 30);
    const entries = await this.prisma.rosterEntry.findMany({
      where: { date: { gte: since }, shift: { code: 'C' } },
      include: { employee: true },
    });
    const map: Record<string, { name: string; count: number }> = {};
    for (const e of entries) {
      const key = e.employeeId;
      map[key] ??= { name: e.employee.name, count: 0 };
      map[key].count++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 20);
  }

  async roster(projectId?: string, locationId?: string, weekStart?: string) {
    const start = weekStart ? startOfDay(parseISO(weekStart)) : startOfDay(new Date());
    const end = addDays(start, 6);
    const where: any = { date: { gte: start, lte: end } };
    if (locationId) where.shift = { locationId };
    else if (projectId) where.shift = { location: { projectId } };

    const [entries, weeks, locations] = await Promise.all([
      this.prisma.rosterEntry.findMany({
        where,
        include: {
          employee: { include: { designation: true, department: true } },
          shift: { include: { location: true } },
          replacementAssignment: true,
        },
        orderBy: [{ date: 'asc' }, { shift: { code: 'asc' } }],
      }),
      this.prisma.rosterWeek.findMany({
        where: {
          weekStart: start,
          ...(locationId ? { locationId } : {}),
          ...(projectId ? { location: { projectId } } : {}),
        },
        include: { location: true, weeklyAssignments: { include: { employee: { include: { designation: true } }, shift: true } }, replacementAssignments: true },
      }),
      this.prisma.location.findMany({ where: projectId ? { projectId } : {}, orderBy: { name: 'asc' } }),
    ]);

    const days = eachDayOfInterval({ start, end }).map((date) => format(date, 'yyyy-MM-dd'));
    const coverage = days.map((date) => {
      const dayEntries = entries.filter((entry) => format(entry.date, 'yyyy-MM-dd') === date && entry.status === RosterStatus.SCHEDULED);
      const byShift: Record<string, number> = {};
      for (const entry of dayEntries) byShift[entry.shift.code] = (byShift[entry.shift.code] ?? 0) + 1;
      return { date, ...byShift, total: dayEntries.length };
    });
    const designationCoverage: Record<string, number> = {};
    const offDistribution: Record<string, number> = {};
    const nightBurden: Record<string, { employee: string; count: number }> = {};
    for (const entry of entries) {
      const date = format(entry.date, 'yyyy-MM-dd');
      if (entry.status === RosterStatus.SCHEDULED) {
        const key = `${date}:${entry.shift.code}:${entry.employee.designation?.name ?? 'Unknown'}`;
        designationCoverage[key] = (designationCoverage[key] ?? 0) + 1;
        if (entry.shift.code === 'C') {
          nightBurden[entry.employeeId] ??= { employee: entry.employee.name, count: 0 };
          nightBurden[entry.employeeId].count += 1;
        }
      }
      if (entry.status === RosterStatus.WEEKLY_OFF) offDistribution[date] = (offDistribution[date] ?? 0) + 1;
    }

    const validationIssues = weeks.flatMap((week) => ((week.validationSummary as any)?.issues ?? []).map((issue: any) => ({
      location: week.location.name,
      ...issue,
    })));

    return {
      projectId,
      locationId,
      weekStart: format(start, 'yyyy-MM-dd'),
      weekEnd: format(end, 'yyyy-MM-dd'),
      locations,
      summary: weeks.map((week) => ({
        rosterWeekId: week.id,
        locationId: week.locationId,
        location: week.location.name,
        status: week.status,
        eligibleEmployees: week.eligibleEmployeeCount,
        requiredDailyHeadcount: week.requiredDailyHeadcount,
        requiredWeeklySlots: week.requiredWeeklySlots,
        availableWeeklySlots: week.availableWeeklySlots,
        extraOrShortageSlots: week.extraOrShortageSlots,
        fairnessScore: (week.fairnessSummary as any)?.score,
        criticalIssues: (week.validationSummary as any)?.criticalCount ?? 0,
        warnings: (week.validationSummary as any)?.warningCount ?? 0,
      })),
      shiftCoverageTrend: coverage,
      designationCoverage: Object.entries(designationCoverage).map(([key, actual]) => {
        const [date, shift, designation] = key.split(':');
        return { date, shift, designation, actual };
      }),
      weeklyOffDistribution: Object.entries(offDistribution).map(([date, count]) => ({ date, count })),
      leaveImpact: entries.filter((entry) => entry.status === RosterStatus.ON_LEAVE).map((entry) => ({
        date: format(entry.date, 'yyyy-MM-dd'),
        employee: entry.employee.name,
        designation: entry.employee.designation?.name,
        shift: entry.shift.name,
        location: entry.shift.location.name,
      })),
      replacementWorkload: weeks.flatMap((week) => week.replacementAssignments.map((replacement) => ({
        locationId: week.locationId,
        date: format(replacement.date, 'yyyy-MM-dd'),
        status: replacement.status,
        source: replacement.source,
        overtimeFlag: replacement.overtimeFlag,
      }))),
      fairnessScore: weeks.map((week) => ({ location: week.location.name, score: (week.fairnessSummary as any)?.score ?? 0 })),
      nightShiftBurden: Object.values(nightBurden).sort((a, b) => b.count - a.count),
      manualOverrides: weeks.flatMap((week) => ((week.validationSummary as any)?.manualOverrides ?? [])),
      extraDutyOvertime: entries.filter((entry) => ['EXTRA_DUTY', 'REPLACEMENT'].includes(String(entry.status)) || entry.isReplacement).length,
      validationIssues,
    };
  }

  async rosterExport(projectId?: string, locationId?: string, weekStart?: string) {
    const data = await this.roster(projectId, locationId, weekStart);
    const workbook = XLSX.utils.book_new();
    const append = (name: string, rows: any[]) => XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: 'No data' }]),
      name.slice(0, 31),
    );
    append('Summary', data.summary);
    append('Shift Coverage Trend', data.shiftCoverageTrend);
    append('Designation Coverage', data.designationCoverage);
    append('Weekly Off Distribution', data.weeklyOffDistribution);
    append('Leave Impact', data.leaveImpact);
    append('Replacement Workload', data.replacementWorkload);
    append('Fairness', data.fairnessScore);
    append('Night Shift Burden', data.nightShiftBurden);
    append('Manual Overrides', data.manualOverrides);
    append('Validation Issues', data.validationIssues);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}
  @Get('overview') overview() { return this.svc.overview(); }
  @Get('status') status() { return this.svc.statusBreakdown(); }
  @Get('designations') designations() { return this.svc.designationBreakdown(); }
  @Get('shifts') shifts() { return this.svc.shiftDistribution(); }
  @Get('leaves') leaves() { return this.svc.leavesByMonth(); }
  @Get('fairness') fairness() { return this.svc.fairness(); }
  @Get('roster')
  roster(@Query('projectId') projectId?: string, @Query('locationId') locationId?: string, @Query('weekStart') weekStart?: string) {
    return this.svc.roster(projectId, locationId, weekStart);
  }
  @Get('roster/export.xlsx')
  async rosterExport(
    @Query('projectId') projectId: string,
    @Query('locationId') locationId: string,
    @Query('weekStart') weekStart: string,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.rosterExport(projectId, locationId, weekStart);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="roster-analytics.xlsx"');
    res.send(buffer);
  }
}

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
