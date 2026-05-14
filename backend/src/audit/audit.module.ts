import {
  CallHandler, Controller, ExecutionContext, Get, Injectable, Module, NestInterceptor, Query, UseGuards,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function stable(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc: any, key) => {
      if (key !== 'hash') acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function hashAudit(value: any) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function sanitize(value: any): any {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => {
      if (/password|token|secret/i.test(key)) return [key, '[REDACTED]'];
      return [key, sanitize(val)];
    }));
  }
  return value;
}

function entityTypeFromPath(path: string) {
  const segment = path.replace(/^\/api\/?/, '').split('/').filter(Boolean)[0] ?? 'system';
  return segment.replace(/(^|-)([a-z])/g, (_, __, char) => char.toUpperCase()).replace(/-/g, '');
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(input: {
    action: string;
    entityType: string;
    entityId: string;
    actor?: any;
    method?: string;
    route?: string;
    employeeId?: string | null;
    metadata?: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorUserId: input.actor?.userId,
        actorEmail: input.actor?.email,
        actorRole: input.actor?.role,
        method: input.method,
        route: input.route,
        employeeId: input.employeeId ?? input.actor?.employeeId,
        metadata: sanitize(input.metadata ?? {}),
      },
    });
  }

  async list(filters: { q?: string; action?: string; entityType?: string; actorEmail?: string; page?: number; pageSize?: number }) {
    const where: any = {};
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.actorEmail) where.actorEmail = { contains: filters.actorEmail, mode: 'insensitive' };
    if (filters.q) {
      where.OR = [
        { action: { contains: filters.q, mode: 'insensitive' } },
        { entityType: { contains: filters.q, mode: 'insensitive' } },
        { entityId: { contains: filters.q, mode: 'insensitive' } },
        { actorEmail: { contains: filters.q, mode: 'insensitive' } },
        { route: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 25));
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { sequence: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      integrity: await this.verify(),
    };
  }

  async verify() {
    const rows = await this.prisma.auditLog.findMany({
      where: { hash: { not: null } },
      orderBy: { sequence: 'asc' },
    });
    let previousHash: string | null = null;
    for (const row of rows) {
      if ((row.previousHash ?? null) !== previousHash) {
        return { valid: false, checked: rows.length, failedAt: row.id, reason: 'Previous hash mismatch' };
      }
      const expected = hashAudit({
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorUserId: row.actorUserId,
        actorEmail: row.actorEmail,
        actorRole: row.actorRole,
        method: row.method,
        route: row.route,
        employeeId: row.employeeId,
        previousProjectId: row.previousProjectId,
        updatedProjectId: row.updatedProjectId,
        metadata: row.metadata,
        previousHash: row.previousHash,
        createdAt: row.createdAt,
      });
      if (row.hash !== expected) {
        return { valid: false, checked: rows.length, failedAt: row.id, reason: 'Log hash mismatch' };
      }
      previousHash = row.hash;
    }
    return { valid: true, checked: rows.length };
  }
}

@Injectable()
class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const route = req.originalUrl ?? req.url ?? '';
    if (!MUTATING_METHODS.has(method) || route.includes('/audit-logs')) return next.handle();

    return next.handle().pipe(tap((result) => {
      const entityType = entityTypeFromPath(route);
      const entityId = req.params?.id ?? result?.id ?? result?.employeeId ?? 'bulk';
      void this.audit.record({
        action: `${method}_${entityType}`.toUpperCase(),
        entityType,
        entityId: String(entityId),
        actor: req.user,
        method,
        route: route.split('?')[0],
        employeeId: req.params?.employeeId ?? result?.employeeId ?? req.user?.employeeId,
        metadata: {
          params: req.params,
          query: req.query,
          body: req.body,
          result: result && typeof result === 'object' ? { id: result.id, status: result.status, updated: result.updated, created: result.created } : undefined,
        },
      }).catch(() => undefined);
    }));
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('audit-logs')
class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorEmail') actorEmail?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.list({
      q,
      action,
      entityType,
      actorEmail,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('verify')
  verify() {
    return this.audit.verify();
  }
}

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
