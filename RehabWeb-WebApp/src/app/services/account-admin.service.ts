import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type AccountAdminRole = 'terapeutas' | 'pacientes';

export interface RoleAccount {
  id: number;
  username: string;
  email: string;
  nombre_completo: string;
  role: 'terapeuta' | 'paciente';
  password?: string;
  especialidad?: string;
  numero_licencia?: string;
  terapeuta_id?: number | null;
  fecha_nacimiento?: string | null;
  estado?: 'activo' | 'inactivo';
  estrategia_validacion?: string;
  estrategia_progreso?: string;
  diagnostico_principal?: string;
  historial_medico?: string;
  nivel_movilidad?: 'bajo' | 'medio' | 'alto' | 'dependiente';
  restricciones?: string;
  evaluacion_inicial_registrada?: boolean;
  total_points?: number;
  current_streak?: number;
  best_streak?: number;
  leaderboard_opt_in?: boolean;
  leaderboard_enabled?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AccountAdminService {
  private http = inject(HttpClient);
  private apiUrl = '/api/accounts';

  get(role: AccountAdminRole, accountId: number): Observable<RoleAccount> {
    return this.http.get<RoleAccount>(`${this.apiUrl}/${role}/${accountId}/`);
  }

  list(role: AccountAdminRole): Observable<RoleAccount[]> {
    return this.http.get<RoleAccount[]>(`${this.apiUrl}/${role}/`);
  }

  create(role: AccountAdminRole, account: Partial<RoleAccount>): Observable<RoleAccount> {
    return this.http.post<RoleAccount>(`${this.apiUrl}/${role}/`, account);
  }

  update(role: AccountAdminRole, accountId: number, account: Partial<RoleAccount>): Observable<RoleAccount> {
    return this.http.patch<RoleAccount>(`${this.apiUrl}/${role}/${accountId}/`, account);
  }

  delete(role: AccountAdminRole, accountId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${role}/${accountId}/`);
  }
}
