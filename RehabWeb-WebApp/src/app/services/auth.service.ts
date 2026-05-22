import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

export type AuthRole = 'terapeuta' | 'paciente';

export interface LoginResponse {
  token: string;
  user_id: number;
  username: string;
  role: AuthRole | null;
  roles: AuthRole[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = '/api/auth/token/';

  login(username: string, password: string, role: AuthRole): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        this.apiUrl,
        { username, password, role },
        { withCredentials: true },
      )
      .pipe(tap((response) => this.saveSession(response, role)));
  }

  logout(): void {
    if (!this.hasLocalStorage()) return;

    window.localStorage.removeItem('token');
    window.localStorage.removeItem('user_id');
    window.localStorage.removeItem('username');
    window.localStorage.removeItem('role');
    window.localStorage.removeItem('roles');
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getCurrentUserId() && !!this.getRole();
  }

  getToken(): string | null {
    return this.getItem('token');
  }

  getRole(): AuthRole | null {
    const role = this.getItem('role');
    return role === 'terapeuta' || role === 'paciente' ? role : null;
  }

  getUsername(): string | null {
    return this.getItem('username');
  }

  getRoles(): AuthRole[] {
    const rawRoles = this.getItem('roles');
    if (!rawRoles) return [];

    try {
      const roles = JSON.parse(rawRoles) as unknown;
      return Array.isArray(roles)
        ? roles.filter((role): role is AuthRole => role === 'terapeuta' || role === 'paciente')
        : [];
    } catch {
      return [];
    }
  }

  getCurrentUserId(): number | null {
    const userId = this.getItem('user_id');
    const parsed = userId ? Number.parseInt(userId, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private saveSession(response: LoginResponse, requestedRole: AuthRole): void {
    if (!this.hasLocalStorage()) return;

    const selectedRole = response.role ?? requestedRole;
    window.localStorage.setItem('token', response.token);
    window.localStorage.setItem('user_id', response.user_id.toString());
    window.localStorage.setItem('username', response.username);
    window.localStorage.setItem('role', selectedRole);
    window.localStorage.setItem('roles', JSON.stringify(response.roles ?? [selectedRole]));
  }

  private getItem(key: string): string | null {
    return this.hasLocalStorage() ? window.localStorage.getItem(key) : null;
  }

  private hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
