import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: string;
  compatible_diagnoses: string;
  contraindications: string;
  min_mobility_level: 'dependiente' | 'bajo' | 'medio' | 'alto';
  default_sets: number;
  default_repetitions: number;
  default_rest_seconds: number;
  default_duration_seconds: number;
  active: boolean;
  compatible: boolean;
}

export interface RoutineExerciseItem {
  id?: number;
  exercise?: Exercise;
  exercise_id?: string;
  order: number;
  sets: number;
  repetitions: number;
  rest_seconds: number;
  duration_seconds: number;
  notes: string;
}

export interface RoutineAssignmentSummary {
  id: string;
  frequency: string;
  preferred_times: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  special_instructions: string;
  status: 'asignada' | 'activa' | 'completada' | 'cancelada';
  assigned_at: string;
}

export interface Routine {
  id: string;
  terapeuta: number;
  terapeuta_nombre: string;
  paciente: number;
  paciente_nombre: string;
  name: string;
  version: string;
  status: 'borrador' | 'validada';
  estimated_duration_seconds: number;
  validation_warnings: string[];
  items: RoutineExerciseItem[];
  latest_assignment: RoutineAssignmentSummary | null;
  created_at: string;
  updated_at: string;
}

export interface RoutineAssignment {
  id: string;
  routine: Pick<Routine, 'id' | 'name' | 'version' | 'estimated_duration_seconds' | 'validation_warnings' | 'items'>;
  paciente: number;
  paciente_nombre: string;
  terapeuta: number;
  terapeuta_nombre: string;
  frequency: 'diaria' | '3_semana' | '2_semana' | 'semanal';
  preferred_times: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  special_instructions: string;
  status: 'asignada' | 'activa' | 'completada' | 'cancelada';
  assigned_at: string;
  activated_at: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  payload: Record<string, string>;
  is_read: boolean;
  created_at: string;
}

export interface RoutineRiskError {
  requires_confirmation: true;
  warnings: string[];
  detail: string;
}

@Injectable({
  providedIn: 'root',
})
export class RoutineService {
  private http = inject(HttpClient);
  private apiUrl = '/api';

  getExercises(patientId?: number): Observable<Exercise[]> {
    const params = patientId ? { paciente: patientId } : undefined;
    return this.http.get<Exercise[]>(`${this.apiUrl}/exercises/`, { params });
  }

  getRoutines(): Observable<Routine[]> {
    return this.http.get<Routine[]>(`${this.apiUrl}/routines/`);
  }

  createRoutine(payload: Record<string, unknown>): Observable<Routine> {
    return this.http.post<Routine>(`${this.apiUrl}/routines/`, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 409 && error.error?.requires_confirmation) {
          return throwError(() => error.error as RoutineRiskError);
        }
        return throwError(() => error);
      }),
    );
  }

  getAssignments(): Observable<RoutineAssignment[]> {
    return this.http.get<RoutineAssignment[]>(`${this.apiUrl}/routine-assignments/`);
  }

  createAssignment(payload: Record<string, unknown>): Observable<RoutineAssignment> {
    return this.http.post<RoutineAssignment>(`${this.apiUrl}/routine-assignments/`, payload);
  }

  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/notifications/`);
  }

  markNotificationRead(id: string): Observable<Notification> {
    return this.http.patch<Notification>(`${this.apiUrl}/notifications/${id}/marcar_leida/`, {});
  }
}
