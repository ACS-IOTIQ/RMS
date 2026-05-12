import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { LocationsModule } from './locations/locations.module';
import { DepartmentsModule } from './departments/departments.module';
import { DesignationsModule } from './designations/designations.module';
import { ShiftsModule } from './shifts/shifts.module';
import { RosterPoliciesModule } from './roster-policies/roster-policies.module';
import { RostersModule } from './rosters/rosters.module';
import { LeavesModule } from './leaves/leaves.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    OrganizationsModule,
    ProjectsModule,
    LocationsModule,
    DepartmentsModule,
    DesignationsModule,
    ShiftsModule,
    RosterPoliciesModule,
    RostersModule,
    LeavesModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
