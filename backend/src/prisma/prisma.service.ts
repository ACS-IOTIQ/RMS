import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

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

function auditHash(value: any) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();
    this.$use(async (params, next) => {
      if (params.model === 'AuditLog' && params.action === 'create') {
        const data = params.args.data ?? {};
        if (!data.hash && (data.method || data.route)) {
          const previous = await this.auditLog.findFirst({
            where: { hash: { not: null } },
            orderBy: { sequence: 'desc' },
            select: { hash: true },
          });
          data.createdAt ??= new Date();
          data.previousHash ??= previous?.hash ?? null;
          data.hash = auditHash({
            action: data.action,
            entityType: data.entityType,
            entityId: data.entityId,
            actorUserId: data.actorUserId,
            actorEmail: data.actorEmail,
            actorRole: data.actorRole,
            method: data.method,
            route: data.route,
            employeeId: data.employeeId,
            previousProjectId: data.previousProjectId,
            updatedProjectId: data.updatedProjectId,
            metadata: data.metadata,
            previousHash: data.previousHash,
            createdAt: data.createdAt,
          });
          params.args.data = data;
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
