import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { BackendConversation } from '../models/mensajeria.models';
import { AccountAdminRole, AccountAdminService, RoleAccount } from './account-admin.service';
import { AuthRole, AuthService } from './auth.service';
import { MensajeriaService } from './mensajeria.service';

export interface DashboardData {
  currentAccount: RoleAccount | null;
  patients: RoleAccount[];
  conversations: BackendConversation[];
}

@Injectable({
  providedIn: 'root',
})
export class ClinicalDataService {
  private accountAdminService = inject(AccountAdminService);
  private authService = inject(AuthService);
  private mensajeriaService = inject(MensajeriaService);

  currentRole(): AuthRole | null {
    return this.authService.getRole();
  }

  currentUserId(): number | null {
    return this.authService.getCurrentUserId();
  }

  roleToAccountRole(role: AuthRole | null = this.currentRole()): AccountAdminRole {
    return role === 'paciente' ? 'pacientes' : 'terapeutas';
  }

  currentAccount(): Observable<RoleAccount | null> {
    const userId = this.currentUserId();
    if (!userId) return of(null);

    return this.accountAdminService.get(this.roleToAccountRole(), userId).pipe(
      catchError(() => of(null)),
    );
  }

  visiblePatients(): Observable<RoleAccount[]> {
    const role = this.currentRole();
    const currentUserId = this.currentUserId();

    return this.accountAdminService.list('pacientes').pipe(
      map((patients) => {
        if (role === 'paciente') {
          return currentUserId ? patients.filter((patient) => patient.id === currentUserId) : [];
        }

        if (role === 'terapeuta' && currentUserId) {
          const assigned = patients.filter((patient) => patient.terapeuta_id === currentUserId);
          return assigned.length ? assigned : patients;
        }

        return patients;
      }),
      catchError(() => of([])),
    );
  }

  dashboardData(): Observable<DashboardData> {
    return forkJoin({
      currentAccount: this.currentAccount(),
      patients: this.visiblePatients(),
      conversations: this.mensajeriaService.getConversaciones().pipe(catchError(() => of([]))),
    });
  }

  displayName(account: RoleAccount | null): string {
    return account?.nombre_completo?.trim() || account?.username || this.authService.getUsername() || 'Usuario';
  }
}
