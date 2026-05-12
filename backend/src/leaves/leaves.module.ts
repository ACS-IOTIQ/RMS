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

  list(filters: { status?: LeaveStatus; employeeId?: string }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    return this.prisma.leave.findMany({
      where,
      include: { employee: { include: { designation: true, location: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  myLeaves(employeeId: string) {
    return this.prisma.leave.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
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
    return this.prisma.leave.create({
      data: {
        employeeId: empId,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
        status: requesterRole === UserRole.ADMIN ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
      },
    });
  }

  async decide(id: string, dto: DecisionDto, approverId: string) {
    const leave = await this.prisma.leave.update({
      where: { id },
      data: { status: dto.status, approvedBy: approverId, approvedAt: new Date() },
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
      return this.svc.myLeaves(user.employeeId);
    }
    return this.svc.list({ status, employeeId });
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

  @Roles(UserRole.ADMIN) @Put(':id/decision')
  decide(@Param('id') id: string, @Body() dto: DecisionDto, @CurrentUser('userId') userId: string) {
    return this.svc.decide(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, user.employeeId, user.role);
  }
}

@Module({ controllers: [LeavesController], providers: [LeavesService] })
export class LeavesModule {}
