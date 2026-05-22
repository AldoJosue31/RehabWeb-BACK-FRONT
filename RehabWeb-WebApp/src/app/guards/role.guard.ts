import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthRole, AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data?.['roles'] ?? []) as AuthRole[];
  const currentRole = authService.getRole();

  if (!allowedRoles.length || (currentRole && allowedRoles.includes(currentRole))) {
    return true;
  }

  return router.createUrlTree(['/tablero-control']);
};
