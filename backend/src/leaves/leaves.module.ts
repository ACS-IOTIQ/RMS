import {
  Body, Controller, Delete, Get, Module, Param, Post, Put, UseGuards, Injectable, Query, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, CurrentUser } from '../auth/roles.guard';
import { UserRole, LeaveType, LeaveStatus } from '@prisma/client';
import { parseISO } from 'date-fns';

class LeaveDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsEnum(LeaveType) type: LeaveType;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() reason?: string;
}

class DecisionDto {
  @IsEnum(LeaveStatus) status: LeaveStatus;
}

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  list(filters: { status?: LeaveStatus; employeeId?: string; approverEmployeeId?: string }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.approverEmployeeId) where.approverEmployeeId = filters.approverEmployeeId;
    return this.prisma.leave.findMany({
      where,
      include: {
        employee: { include: { designation: true, location: true, reportingManager: true } },
        approver: { select: { id: true, name: true, employeeCode: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  myLeaves(employeeId: string) {
    return this.prisma.leave.findMany({
      where: { employeeId },
      include: { approver: { select: { id: true, name: true, employeeCode: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  approvalQueue(approverEmployeeId: string, status?: LeaveStatus) {
    if (!approverEmployeeId) return [];
    return this.list({ approverEmployeeId, status });
  }

  async create(dto: LeaveDto, requesterEmployeeId?: string, requesterRole?: UserRole) {
    const empId = dto.employeeId ?? requesterEmployeeId;
    if (!empId) throw new BadRequestException('employeeId required');
    if (requesterRole === UserRole.EMPLOYEE && dto.employeeId && dto.employeeId !== requesterEmployeeId) {
      throw new ForbiddenException('Cannot apply leave for another employee');
    }
    const start = parseISO(dto.startDate);
    const end = parseISO(dto.endDate);
    if (end < start) throw new BadRequestException('endDate must be after startDate');
    const employee = await this.prisma.employee.findUnique({
      where: { id: empId },
      select: { id: true, reportingManagerId: true, name: true },
    });
    if (!employee) throw new BadRequestException('Employee not found');
    if (requesterRole !== UserRole.ADMIN && !employee.reportingManagerId) {
      throw new BadRequestException('Reporting manager is not assigned');
    }
    const leave = await this.prisma.leave.create({
      data: {
        employeeId: empId,
        approverEmployeeId: requesterRole === UserRole.ADMIN ? null : employee.reportingManagerId,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
        status: requesterRole === UserRole.ADMIN ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
      },
    });
    if (leave.approverEmployeeId) {
      await this.prisma.notification.create({
        data: {
          employeeId: leave.approverEmployeeId,
          title: 'Leave approval pending',
          message: `${employee.name} requested ${dto.type} leave from ${dto.startDate} to ${dto.endDate}.`,
          type: 'LEAVE_APPROVAL',
        },
      });
    }
    return leave;
  }

  async decide(id: string, dto: DecisionDto, approver: any) {
    const existing = await this.prisma.leave.findUnique({ where: { id }, include: { employee: true } });
    if (!existing) throw new BadRequestException('Leave request not found');
    if (approver.role !== UserRole.ADMIN && existing.approverEmployeeId !== approver.employeeId) {
      throw new ForbiddenException('Only the reporting manager can approve this leave');
    }
    const leave = await this.prisma.leave.update({
      where: { id },
      data: { status: dto.status, approvedBy: approver.userId, approvedAt: new Date() },
    });
    // If approved: cancel impacted roster entries
    if (dto.status === LeaveStatus.APPROVED) {
      await this.prisma.rosterEntry.updateMany({
        where: {
          employeeId: leave.employeeId,
          date: { gte: leave.startDate, lte: leave.endDate },
        },
        data: { status: 'CANCELLED' },
      });
    }
    await this.prisma.notification.create({
      data: {
        employeeId: leave.employeeId,
        title: `Leave ${dto.status.toLowerCase()}`,
        message: `Your ${existing.type} leave request was ${dto.status.toLowerCase()}.`,
        type: 'LEAVE_DECISION',
      },
    });
    return leave;
  }

  remove(id: string, employeeId?: string, role?: UserRole) {
    if (role === UserRole.EMPLOYEE) {
      return this.prisma.leave.deleteMany({ where: { id, employeeId, status: LeaveStatus.PENDING } });
    }
    return this.prisma.leave.delete({ where: { id } });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private svc: LeavesService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('status') status?: LeaveStatus,
    @Query('employeeId') employeeId?: string,
  ) {
    if (user.role === UserRole.EMPLOYEE) {
      return this.svc.approvalQueue(user.employeeId, status);
    }
    return this.svc.list({ status, employeeId });
  }

  @Get('approvals')
  approvals(@CurrentUser() user: any, @Query('status') status?: LeaveStatus) {
    if (user.role === UserRole.ADMIN) return this.svc.list({ status });
    return this.svc.approvalQueue(user.employeeId, status);
  }

  @Get('my')
  my(@CurrentUser('employeeId') employeeId: string) {
    if (!employeeId) return [];
    return this.svc.myLeaves(employeeId);
  }

  @Post()
  create(@Body() dto: LeaveDto, @CurrentUser() user: any) {
    return this.svc.create(dto, user.employeeId, user.role);
  }

  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.ROSTER_MANAGER, UserRole.PROJECT_MANAGER) @Put(':id/decision')
  decide(@Param('id') id: string, @Body() dto: DecisionDto, @CurrentUser() user: any) {
    return this.svc.decide(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, user.employeeId, user.role);
  }
}

@Module({ controllers: [LeavesController], providers: [LeavesService] })
export class LeavesModule {}
