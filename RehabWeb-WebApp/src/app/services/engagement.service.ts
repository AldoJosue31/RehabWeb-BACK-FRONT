import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, map } from 'rxjs';

export interface RehabAlert {
  id: string;
  paciente: number;
  paciente_nombre: string;
  terapeuta: number;
  terapeuta_nombre: string;
  alert_type: 'INACTIVITY_WARNING' | 'PAIN_OR_DETERIORATION';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  status: 'activa' | 'revisada' | 'resuelta';
  detected_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
  source_session: number | null;
}

export interface ExerciseSession {
  id: number;
  paciente: number;
  paciente_nombre: string;
  terapeuta: number | null;
  performed_at: string;
  scheduled_for: string | null;
  exercise_name: string;
  repetitions_completed: number;
  planned_repetitions: number;
  duration_seconds: number;
  planned_duration_seconds: number;
  pain_level: number;
  mobility_score: string | null;
  points_awarded: number;
  speed_bonus_points: number;
  streak_days: number;
  positive_feedback: string;
  performance_notes: string;
  new_badges: PatientBadge[];
  created_at: string;
}

export interface MotivationProfile {
  total_points: number;
  current_streak: number;
  best_streak: number;
  last_session_date: string | null;
  level: {
    name: string;
    color: string;
    description: string;
    progress: number;
    points_to_next: number;
  };
  streak_status: 'intacta' | 'en_peligro' | 'perdida';
  streak_bonus_percent: number;
  streak_hours_remaining: number | null;
  next_session_streak: number;
  next_session_streak_bonus_percent: number;
  leaderboard_opt_in: boolean;
  leaderboard_enabled: boolean;
  updated_at: string;
}

export interface PatientBadge {
  id: number;
  code: string;
  name: string;
  description: string;
  awarded_at: string;
  source_session: number | null;
}

export interface WeeklySummary {
  id: number;
  week_start: string;
  week_end: string;
  sessions_completed: number;
  sessions_scheduled: number;
  points_obtained: number;
  completion_percentage: number;
  daily_activity: Array<{
    date: string;
    day: string;
    points: number;
    completed: boolean;
  }>;
  sent_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  nombre: string;
  total_points: number;
  best_streak: number;
}

export interface MessagePage {
  messages: unknown[];
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class EngagementService {
  private http = inject(HttpClient);
  private apiUrl = '/api';
  private motivationRefreshSubject = new Subject<void>();

  motivationRefreshes$ = this.motivationRefreshSubject.asObservable();

  getAlerts(): Observable<RehabAlert[]> {
    return this.http.get<RehabAlert[]>(`${this.apiUrl}/alertas/`);
  }

  markAlertReviewed(id: string): Observable<RehabAlert> {
    return this.http.patch<RehabAlert>(`${this.apiUrl}/alertas/${id}/marcar_revisada/`, {});
  }

  resolveAlert(id: string): Observable<RehabAlert> {
    return this.http.patch<RehabAlert>(`${this.apiUrl}/alertas/${id}/resolver/`, {});
  }

  runInactivityDetection(): Observable<{ generadas: number }> {
    return this.http.post<{ generadas: number }>(`${this.apiUrl}/alertas/generar_inactividad/`, {});
  }

  getSessions(): Observable<ExerciseSession[]> {
    return this.http.get<ExerciseSession[]>(`${this.apiUrl}/sessions/`);
  }

  createSession(payload: Partial<ExerciseSession>): Observable<ExerciseSession> {
    return this.http.post<ExerciseSession>(`${this.apiUrl}/sessions/`, payload);
  }

  getMotivation(): Observable<MotivationProfile> {
    return this.http.get<MotivationProfile>(`${this.apiUrl}/motivation/me/`);
  }

  notifyMotivationChanged(): void {
    this.motivationRefreshSubject.next();
  }

  updateMotivation(payload: Partial<MotivationProfile>): Observable<MotivationProfile> {
    return this.http.patch<MotivationProfile>(`${this.apiUrl}/motivation/me/`, payload);
  }

  getBadges(): Observable<PatientBadge[]> {
    return this.http.get<PatientBadge[]>(`${this.apiUrl}/motivation/badges/`);
  }

  getWeeklySummary(): Observable<WeeklySummary> {
    return this.http.get<WeeklySummary>(`${this.apiUrl}/motivation/weekly-summary/`);
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.apiUrl}/motivation/leaderboard/`);
  }

  readHasMore<T>(request: Observable<HttpResponse<T[]>>): Observable<{ items: T[]; hasMore: boolean }> {
    return request.pipe(
      map((response) => ({
        items: response.body ?? [],
        hasMore: response.headers.get('X-Has-More') === 'true',
      })),
    );
  }
}
