import { Body, Controller, Delete, Get, Module, Param, Post, Put, Query, UseGuards, Injectable } from '@nestjs/common';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

class DesigDto {
  @IsString() @IsNotEmpty() name: string;
  @Type(() => Number) @IsInt() @Min(1) level: number;
  @IsOptional() @IsBoolean() isCritical?: boolean;
}
class UpdateDesigDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @Type(() => Number) @IsInt() level?: number;
  @IsOptional() @IsBoolean() isCritical?: boolean;
}

@Injectable()
export class DesignationsService {
  constructor(private prisma: PrismaService) {}
  async list(page?: number, pageSize?: number) {
    const include = {
      _count: { select: { employees: true } },
    };
    const orderBy = { level: 'asc' as const };
    if (!page && !pageSize) return this.prisma.designation.findMany({ include, orderBy });
    const safePage = Math.max(1, page || 1);
    const safePageSize = Math.min(100, Math.max(1, pageSize || 10));
    const [data, total] = await Promise.all([
      this.prisma.designation.findMany({
        include,
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.designation.count(),
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
  create(data: DesigDto) { return this.prisma.designation.create({ data }); }
  update(id: string, data: UpdateDesigDto) { return this.prisma.designation.update({ where: { id }, data }); }
  remove(id: string) { return this.prisma.designation.delete({ where: { id } }); }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('designations')
export class DesignationsController {
  constructor(private svc: DesignationsService) {}
  @Get() list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }
  @Roles(UserRole.ADMIN) @Post() create(@Body() dto: DesigDto) { return this.svc.create(dto); }
  @Roles(UserRole.ADMIN) @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateDesigDto) { return this.svc.update(id, dto); }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ controllers: [DesignationsController], providers: [DesignationsService] })
export class DesignationsModule {}
