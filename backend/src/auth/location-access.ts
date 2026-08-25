import { UserRole } from '@prisma/client';

export type LocationScopedUser = { role?: UserRole; locationId?: string | null } | null | undefined;

/**
 * Resolves the location ids a user is allowed to see roster/location data for.
 *
 * `null` means unrestricted (every location) - only ADMIN accounts get this.
 * Every other role is scoped to the single location on their linked Employee
 * record (carried on the JWT as `locationId`); if they have no employee/location
 * link, they are allowed no locations at all.
 */
export function getAllowedLocationIds(user: LocationScopedUser): string[] | null {
  if (!user) return [];
  if (user.role === UserRole.ADMIN) return null;
  return user.locationId ? [user.locationId] : [];
}
