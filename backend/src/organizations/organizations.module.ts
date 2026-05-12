import { Body, Controller, Delete, Get, Module, Param, Post, Put, Query, UseGuards, Injectable } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

class OrgDto {
  @IsString() name: string;
  @IsOptional() @IsString() code?: string;
}
class UpdateOrgDto {
  @IsOptional() @IsString() name?: string;
}

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async list(page?: number, pageSize?: number) {
    const include = { _count: { select: { projects: true } } };
    const orderBy = { name: 'asc' as const };
    if (!page && !pageSize) return this.prisma.organization.findMany({ include, orderBy });

    const safePage = Math.max(1, page || 1);
    const safePageSize = Math.min(100, Math.max(1, pageSize || 10));
    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        include,
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.organization.count(),
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

  get(id: string) { return this.prisma.organization.findUnique({ where: { id }, include: { projects: true } }); }

  async create(data: OrgDto) {
    return this.prisma.organization.create({
      data: {
        name: data.name,
        code: await this.nextCode(),
      },
    });
  }

  update(id: string, data: UpdateOrgDto) { return this.prisma.organization.update({ where: { id }, data }); }
  remove(id: string) { return this.prisma.organization.delete({ where: { id } }); }

  private async nextCode() {
    const prefix = process.env.ORG_CODE_PREFIX ?? 'ORG';
    const pad = Number(process.env.ORG_CODE_PAD ?? 4);
    let seq = await this.prisma.organization.count();
    while (true) {
      seq += 1;
      const code = `${prefix}-${String(seq).padStart(pad, '0')}`;
      const exists = await this.prisma.organization.findUnique({ where: { code } });
      if (!exists) return code;
    }
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private svc: OrganizationsService) {}
  @Get() list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Roles(UserRole.ADMIN) @Post() create(@Body() dto: OrgDto) { return this.svc.create(dto); }
  @Roles(UserRole.ADMIN) @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateOrgDto) { return this.svc.update(id, dto); }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ controllers: [OrganizationsController], providers: [OrganizationsService] })
export class OrganizationsModule {}
