import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { employee: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const token = this.signToken(user);
    return {
      token,
      user: this.sanitize(user),
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already in use');

    let employeeId: string | null = null;
    let role: UserRole = UserRole.EMPLOYEE;

    if (dto.employeeCode) {
      const emp = await this.prisma.employee.findUnique({
        where: { employeeCode: dto.employeeCode },
        include: { user: true },
      });
      if (!emp) throw new BadRequestException('Employee code not found');
      if (emp.user) throw new BadRequestException('Employee already has an account');
      if (emp.email.toLowerCase() !== dto.email.toLowerCase()) {
        throw new BadRequestException('Email does not match employee record');
      }
      employeeId = emp.id;
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        role,
        employeeId,
      },
      include: { employee: true },
    });

    const token = this.signToken(user);
    return { token, user: this.sanitize(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          include: {
            designation: true,
            location: true,
            project: true,
            department: true,
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  private signToken(user: any) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    });
  }

  private sanitize(user: any) {
    const { password, ...rest } = user;
    return rest;
  }
}
