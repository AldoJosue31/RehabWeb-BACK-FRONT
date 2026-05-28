import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RoleAccount } from '../../services/account-admin.service';
import { AuthService } from '../../services/auth.service';
import { ClinicalDataService } from '../../services/clinical-data.service';
import {
  EngagementService,
  ExerciseSession,
  MotivationProfile,
  PatientBadge,
  WeeklySummary,
} from '../../services/engagement.service';
import { RoutineAssignment, RoutineExerciseItem, RoutineService, Notification } from '../../services/routine.service';

type BadgeVisibility = 'all' | 'earned';

interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  requirement: string;
  category: string;
  reward: string;
  accent: string;
  accentSoft: string;
}

interface BadgeCollectionItem extends BadgeDefinition {
  unlocked: boolean;
  awarded_at: string | null;
  source_session: number | null;
}

interface SessionCelebration {
  points: number;
  streakDays: number;
  streakDelta: number;
  streakActivated: boolean;
  badges: PatientBadge[];
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    code: 'FIRST_SESSION',
    name: 'Primer Paso',
    description: 'Celebra el inicio de su viaje.',
    requirement: 'Registra la primera sesion de rehabilitacion.',
    category: 'Inicio',
    reward: 'Primer registro completo',
    accent: '#00a781',
    accentSoft: '#e6f6f2',
  },
  {
    code: 'STREAK_3',
    name: 'Constancia 3 dias',
    description: 'Completo sesiones durante 3 dias seguidos.',
    requirement: 'Completa sesiones durante 3 dias consecutivos.',
    category: 'Racha',
    reward: 'Habito inicial',
    accent: '#f59e0b',
    accentSoft: '#fff7ed',
  },
  {
    code: 'STREAK_7',
    name: 'Semana Completa',
    description: 'Completo 7 sesiones consecutivas.',
    requirement: 'Mantiene una racha activa de 7 dias.',
    category: 'Racha',
    reward: 'Semana consistente',
    accent: '#4d94ff',
    accentSoft: '#eff6ff',
  },
  {
    code: 'STREAK_30',
    name: 'Mes Dedicado',
    description: 'Completo 30 sesiones consecutivas.',
    requirement: 'Alcanza 30 dias seguidos con sesiones.',
    category: 'Racha',
    reward: 'Disciplina avanzada',
    accent: '#8b5cf6',
    accentSoft: '#f5f3ff',
  },
  {
    code: 'POINTS_100',
    name: 'Fortaleza',
    description: 'Acumulo sus primeros 100 puntos.',
    requirement: 'Suma 100 puntos totales.',
    category: 'Puntos',
    reward: '100 pts acumulados',
    accent: '#10b981',
    accentSoft: '#ecfdf5',
  },
  {
    code: 'POINTS_500',
    name: 'Superestrella',
    description: 'Acumulo 500 puntos.',
    requirement: 'Suma 500 puntos totales.',
    category: 'Puntos',
    reward: '500 pts acumulados',
    accent: '#e11d48',
    accentSoft: '#fff1f2',
  },
  {
    code: 'HIGH_REPS_100',
    name: '100 repeticiones',
    description: 'Completo 100 repeticiones en una sesion.',
    requirement: 'Completa 100 repeticiones en una sola sesion.',
    category: 'Fuerza',
    reward: 'Volumen destacado',
    accent: '#ea580c',
    accentSoft: '#fff7ed',
  },
  {
    code: 'SPEED_20',
    name: 'Velocidad',
    description: 'Completo una sesion al menos 20% mas rapido.',
    requirement: 'Termina una sesion al menos 20% antes del tiempo estimado.',
    category: 'Rendimiento',
    reward: 'Bonus de velocidad',
    accent: '#0891b2',
    accentSoft: '#ecfeff',
  },
  {
    code: 'COGNITIVE_5',
    name: 'Cerebro Ganador',
    description: 'Completo ejercicios cognitivos 5 veces.',
    requirement: 'Completa 5 sesiones con ejercicios cognitivos.',
    category: 'Cognitivo',
    reward: '5 retos cognitivos',
    accent: '#7c3aed',
    accentSoft: '#f5f3ff',
  },
];

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="rw-page">
      <header class="rw-page-header">
        <div>
          <h1 class="rw-title">{{ role() === 'paciente' ? 'Mis ejercicios' : 'Sesiones de pacientes' }}</h1>
          <p class="rw-subtitle">Registro real de ejercicios, dolor, puntos, rachas e insignias.</p>
        </div>
        <button class="rw-action rw-action--primary shrink-0" type="button" [disabled]="loading()" (click)="openSessionModal()">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Registrar sesi&oacute;n
        </button>
      </header>

      @if (loading()) {
        <div class="rw-card rw-card-pad text-sm text-secondary">Cargando sesiones reales...</div>
      } @else {
        @if (role() === 'paciente' && weeklySummary(); as summary) {
          <article class="rw-card sessions-weekly-bar">
            <div class="sessions-weekly-bar__intro">
              <div>
                <h2 class="m-0 text-lg font-bold text-main">Resumen semanal</h2>
                <p class="m-0 mt-1 text-sm text-secondary">
                  {{ summary.week_start | date:'mediumDate' }} - {{ summary.week_end | date:'mediumDate' }}
                </p>
              </div>
              <span class="sessions-weekly-bar__pill">{{ summary.completion_percentage }}% cumplimiento</span>
            </div>

            <div class="sessions-weekly-bar__metrics">
              <div>
                <p class="m-0 text-xs text-secondary">Sesiones</p>
                <strong class="text-main">{{ summary.sessions_completed }}/{{ summary.sessions_scheduled }}</strong>
              </div>
              <div>
                <p class="m-0 text-xs text-secondary">Puntos</p>
                <strong class="text-primary">{{ summary.points_obtained }}</strong>
              </div>
              <div>
                <p class="m-0 text-xs text-secondary">Mejor racha</p>
                <strong class="text-info">{{ motivation()?.best_streak ?? 0 }}</strong>
              </div>
            </div>

            <div class="sessions-weekly-bar__chart" aria-label="Actividad diaria de la semana">
              @for (day of summary.daily_activity; track day.date) {
                <div class="sessions-weekly-bar__day">
                  <div class="sessions-weekly-bar__bar">
                    <div
                      [ngClass]="day.completed ? 'bg-primary' : 'bg-line'"
                      [style.height.%]="dailyBarHeight(day.points)"
                      [title]="day.points + ' puntos'"
                    ></div>
                  </div>
                  <span>{{ day.day }}</span>
                </div>
              }
            </div>
          </article>
        }

        @if (lastSession(); as session) {
          <article class="rounded-lg border border-primary bg-primary-low p-4 shadow-sm" [ngClass]="celebrating() ? 'animate-pulse' : ''">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 class="m-0 text-base font-bold text-primary">{{ session.positive_feedback }}</h2>
                <p class="m-0 mt-1 text-sm text-secondary">
                  +{{ session.points_awarded }} puntos &middot; bonus velocidad {{ session.speed_bonus_points }} &middot; racha {{ session.streak_days }} d&iacute;as
                </p>
                @if (newlyUnlockedBadges().length) {
                  <p class="m-0 mt-2 text-sm font-bold text-primary">
                    Insignia desbloqueada: {{ newlyUnlockedBadges()[0].name }}
                  </p>
                }
              </div>
              <span class="rounded-md bg-surface px-4 py-2 text-sm font-bold text-primary">Visualizaci&oacute;n inmediata</span>
            </div>
          </article>
        }

        @if (role() === 'paciente' && notifications().length) {
          <article class="rounded-lg border border-info bg-info/10 p-4">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 class="m-0 text-base font-bold text-main">{{ notifications()[0].title }}</h2>
                <p class="m-0 mt-1 text-sm text-secondary">{{ notifications()[0].message }}</p>
              </div>
              <button class="rw-action" type="button" (click)="markNotificationRead(notifications()[0].id)">Marcar leida</button>
            </div>
          </article>
        }

        @if (role() === 'paciente' && assignments().length) {
          <article class="rw-card rw-card-pad">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="m-0 text-lg font-bold text-main">Rutinas asignadas</h2>
                <p class="m-0 text-sm text-secondary">Disponibles tras sincronizacion con la cuenta del paciente.</p>
              </div>
              <span class="rounded-md bg-primary-low px-3 py-1 text-xs font-bold text-primary">{{ assignments().length }} activas/asignadas</span>
            </div>
            <div class="grid gap-3 lg:grid-cols-2">
              @for (assignment of assignments(); track assignment.id) {
                <div class="rounded-md border border-line bg-app p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong class="text-sm text-main">{{ assignment.routine.name }} v{{ assignment.routine.version }}</strong>
                      <p class="m-0 mt-1 text-xs text-secondary">
                        {{ assignment.frequency }} · {{ assignment.preferred_times || 'sin horario fijo' }} · {{ assignment.start_date | date:'mediumDate' }}
                      </p>
                    </div>
                    <span class="rounded-md bg-primary-low px-3 py-1 text-xs font-bold text-primary">{{ assignment.status }}</span>
                  </div>
                  @if (assignment.special_instructions) {
                    <p class="m-0 mt-3 rounded-md bg-surface p-3 text-xs text-secondary">{{ assignment.special_instructions }}</p>
                  }
                  <div class="mt-3 grid gap-2">
                    @for (item of assignment.routine.items; track item.id || item.exercise?.id) {
                      <button class="rounded-md border border-line bg-surface p-3 text-left text-sm hover:border-primary" type="button" (click)="prepareAssignedExercise(item)">
                        <strong class="text-main">{{ item.exercise?.name }}</strong>
                        <span class="ml-2 text-xs text-secondary">{{ item.sets }}x{{ item.repetitions }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </article>
        }

        <div class="grid gap-5">
            @if (role() === 'paciente' && motivation(); as stats) {
              <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <article class="rw-card rw-card-pad">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="m-0 text-sm text-secondary">Nivel actual</p>
                      <h2 class="m-0 mt-1 text-xl font-bold text-main">{{ stats.level.name }}</h2>
                      <p class="m-0 mt-1 text-sm text-secondary">{{ stats.level.description }}</p>
                    </div>
                    <span class="rounded-md bg-surface px-4 py-2 text-sm font-bold text-primary">{{ stats.total_points }} pts</span>
                  </div>
                  <div class="mt-4 h-3 overflow-hidden rounded-full bg-line">
                    <div class="h-full rounded-full" [style.width.%]="stats.level.progress" [style.background-color]="stats.level.color"></div>
                  </div>
                  <p class="m-0 mt-2 text-xs text-secondary">
                    @if (stats.level.points_to_next > 0) {
                      {{ stats.level.points_to_next }} puntos para el siguiente nivel
                    } @else {
                      Nivel maximo alcanzado
                    }
                  </p>
                </article>
                <article class="rw-card rw-card-pad">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="m-0 text-sm text-secondary">Racha de cumplimiento</p>
                      <p class="m-0 mt-1 text-2xl font-bold text-primary">{{ stats.current_streak }} dias</p>
                    </div>
                    <span class="rounded-md px-3 py-1 text-xs font-bold" [ngClass]="streakBadgeClass(stats.streak_status)">
                      {{ streakLabel(stats.streak_status) }}
                    </span>
                  </div>
                  <div class="mt-3 grid gap-2 text-sm text-secondary">
                    <span>Mejor racha: <strong>{{ stats.best_streak }}</strong></span>
                    <span>Bonificacion activa: <strong>+{{ stats.streak_bonus_percent }}%</strong></span>
                  </div>
                  <div class="mt-3 h-2 overflow-hidden rounded-full bg-line">
                    <div class="h-full rounded-full bg-info" [style.width.%]="stats.streak_bonus_percent * 2"></div>
                  </div>
                  @if (stats.streak_status === 'en_peligro' && stats.streak_hours_remaining) {
                    <p class="m-0 mt-3 rounded-md bg-warning/10 p-3 text-xs font-bold text-warning">
                      Tu racha vence en {{ stats.streak_hours_remaining }} h. Completa una sesion hoy.
                    </p>
                  } @else if (stats.streak_status === 'perdida') {
                    <p class="m-0 mt-3 rounded-md bg-danger-bg p-3 text-xs font-bold text-danger">
                      Tu racha se perdio. Hoy puedes iniciar una nueva.
                    </p>
                  }
                </article>
              </div>

              <article class="rw-card rw-card-pad">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 class="m-0 text-lg font-bold text-main">Colecci&oacute;n de insignias</h2>
                    <p class="m-0 mt-1 text-sm text-secondary">
                      {{ earnedBadgeCount() }} desbloqueadas &middot; {{ pendingBadgeCount() }} pendientes
                    </p>
                  </div>
                  <label class="grid min-w-[190px] gap-1 text-xs font-bold uppercase tracking-wide text-secondary">
                    Vista
                    <select class="rw-input normal-case tracking-normal" [value]="badgeVisibility()" (change)="setBadgeVisibility($event)">
                      <option value="earned">Ocultar pendientes</option>
                      <option value="all">Mostrar todas</option>
                    </select>
                  </label>
                </div>

                <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  @for (badge of visibleBadgeCollection(); track badge.code) {
                    <div
                      class="badge-card"
                      [class.badge-card--unlocked]="badge.unlocked"
                      [class.badge-card--locked]="!badge.unlocked"
                      [style.--badge-accent]="badge.unlocked ? badge.accent : '#94a3b8'"
                      [style.--badge-soft]="badge.unlocked ? badge.accentSoft : 'var(--baseline-app)'"
                    >
                      <div class="badge-card__shine" aria-hidden="true"></div>
                      <div class="badge-card__header">
                        <span
                          class="badge-medal"
                          [class.badge-medal--locked]="!badge.unlocked"
                          aria-hidden="true"
                        >
                          <svg class="h-12 w-12" viewBox="0 0 64 64" fill="none">
                            <path d="M24 48l-4 11 8-4 4 6 4-6 8 4-4-11" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                            <circle cx="32" cy="32" r="27" fill="currentColor" opacity="0.10" />
                            <circle cx="32" cy="32" r="21" stroke="currentColor" stroke-width="1.6" opacity="0.28" />
                            <path d="M18 15l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4ZM48 11l1.6 3.2L53 16l-3.4 1.8L48 21l-1.6-3.2L43 16l3.4-1.8L48 11Z" fill="currentColor" opacity="0.45" />
                            <path d="M32 5l7 6 9-1 4 8 8 4-1 9 6 7-6 7 1 9-8 4-4 8-9-1-7 6-7-6-9 1-4-8-8-4 1-9-6-7 6-7-1-9 8-4 4-8 9 1 7-6Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                            @switch (badge.code) {
                              @case ('FIRST_SESSION') {
                                <path d="M22 45c-4.5-1.2-7.5-4.8-7.5-9.2 0-6.7 5.5-11.4 12.3-11.4h2.2" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                                <path d="M30 16h17l-4.2 7.5L47 31H30V16Z" fill="currentColor" opacity="0.22" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                                <path d="M30 16v27" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
                                <path d="m21 38 4 4 8-10" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
                                <circle cx="22" cy="45" r="3.4" fill="currentColor" />
                              }
                              @case ('STREAK_3') {
                                <path d="M33 49c8.5-4.2 13.5-10.4 13.5-18.5 0-8.2-5.2-14.4-9.5-18.5-1.2 7.2-6.4 10.4-10.5 14.8-4.2 4.4-7.2 8.4-7.2 13.4 0 6.2 5.3 10.2 13.7 8.8Z" fill="currentColor" opacity="0.20" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <path d="M31 43c4.5-2.2 6.8-5.6 6.8-9.8 0-3.3-2.1-6.2-4.5-8.4-1.2 4.2-4.4 6.4-6.5 9.5-2.3 3.3-2.1 6.8 4.2 8.7Z" fill="currentColor" />
                                <path d="M22 18h20M24 23h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55" />
                                <path d="M24 47h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45" />
                              }
                              @case ('STREAK_7') {
                                <rect x="16" y="17" width="32" height="30" rx="5" fill="currentColor" opacity="0.14" stroke="currentColor" stroke-width="2.4" />
                                <path d="M16 27h32M24 14v8M40 14v8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                                <path d="M23 34h4M31 34h4M39 34h3M23 40h4M39 40h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45" />
                                <path d="m25 40 5 5 11-13" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
                                <text x="32" y="25" text-anchor="middle" fill="currentColor" font-size="8" font-weight="800">7</text>
                              }
                              @case ('STREAK_30') {
                                <circle cx="32" cy="32" r="16" fill="currentColor" opacity="0.14" stroke="currentColor" stroke-width="2.4" />
                                <circle cx="32" cy="32" r="10" stroke="currentColor" stroke-width="1.8" opacity="0.34" />
                                <path d="M32 16v7M32 41v7M16 32h7M41 32h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55" />
                                <path d="M24 39c2-6 6-11 8-14 2 3 6 8 8 14" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M25 25h14M27 44h10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                                <text x="32" y="35" text-anchor="middle" fill="currentColor" font-size="8" font-weight="800">30</text>
                              }
                              @case ('POINTS_100') {
                                <path d="M32 14l5.2 10.5 11.6 1.8-8.4 8.2 2 11.6L32 40.6l-10.4 5.5 2-11.6-8.4-8.2 11.6-1.8L32 14Z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <circle cx="32" cy="32" r="10" fill="currentColor" opacity="0.12" />
                                <text x="32" y="35" text-anchor="middle" fill="currentColor" font-size="10" font-weight="900">100</text>
                                <path d="M21 49h22" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.5" />
                              }
                              @case ('POINTS_500') {
                                <path d="M32 13l18 15-18 23-18-23 18-15Z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <path d="M14 28h36M24 28l8 23 8-23M23 28l9-15 9 15" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <path d="M21 22h22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.45" />
                                <circle cx="32" cy="30" r="4" fill="currentColor" opacity="0.22" stroke="currentColor" stroke-width="1.8" />
                                <text x="32" y="40" text-anchor="middle" fill="currentColor" font-size="8" font-weight="900">500</text>
                              }
                              @case ('HIGH_REPS_100') {
                                <path d="M15 34h34M22 26v16M42 26v16M11 29v10M53 29v10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                                <rect x="24" y="22" width="16" height="20" rx="4" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2.4" />
                                <path d="M28 31h8M28 36h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                                <path d="M20 18c3-3 7-4 12-4s9 1 12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45" />
                                <text x="32" y="51" text-anchor="middle" fill="currentColor" font-size="7" font-weight="900">100 reps</text>
                              }
                              @case ('SPEED_20') {
                                <path d="M21 45c-4-4-6-9.5-4.2-16 2.2-8.4 10.8-13.4 19.2-11.2 8.2 2.2 13.2 10.8 11 19-1 4-3.4 7.3-6.6 9.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                                <path d="M32 34l11-11" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                                <circle cx="32" cy="34" r="4.5" fill="currentColor" opacity="0.22" stroke="currentColor" stroke-width="2.4" />
                                <path d="M18 22l4 3M46 22l-4 3M32 15v6M20 34h4M40 34h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                                <path d="M13 47h15M11 41h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5" />
                                <text x="38" y="48" text-anchor="middle" fill="currentColor" font-size="7" font-weight="900">20%</text>
                              }
                              @case ('COGNITIVE_5') {
                                <path d="M24 45c-5-2-8-7-8-13 0-7 5-12 11-13 2-4 9-4 11 0 6 1 10 6 10 13 0 6-3 11-8 13" fill="currentColor" opacity="0.14" />
                                <path d="M27 19c-6 1-11 6-11 13 0 6 3 11 8 13M37 19c6 1 11 6 11 13 0 6-3 11-8 13M32 18v29M24 30h16M24 38h7M33 25h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                                <circle cx="25" cy="31" r="2" fill="currentColor" />
                                <circle cx="39" cy="25" r="2" fill="currentColor" />
                                <circle cx="39" cy="39" r="2" fill="currentColor" />
                                <path d="M25 31l7 7 7-13M32 38l7 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
                                <text x="25" y="52" text-anchor="middle" fill="currentColor" font-size="7" font-weight="900">x5</text>
                              }
                            }
                          </svg>
                        </span>
                        <div class="min-w-0">
                          <div class="mb-2 flex flex-wrap gap-2">
                            <span class="badge-chip">{{ badge.category }}</span>
                            <span class="badge-chip badge-chip--muted">{{ badge.reward }}</span>
                          </div>
                          <strong class="badge-card__title">{{ badge.name }}</strong>
                          <p class="m-0 mt-1 text-xs text-secondary">{{ badge.description }}</p>
                        </div>
                      </div>
                      <div class="badge-card__body">
                        <p class="m-0 text-xs font-bold uppercase tracking-wide text-secondary">Meta</p>
                        <p class="m-0 mt-1 text-sm text-main">{{ badge.requirement }}</p>
                      </div>
                      <div class="badge-card__footer">
                        <span class="badge-status" [class.badge-status--locked]="!badge.unlocked">
                          @if (badge.unlocked) {
                            Conseguida
                          } @else {
                            Pendiente
                          }
                        </span>
                        <span class="text-xs text-secondary">
                          @if (badge.unlocked) {
                            {{ badge.awarded_at | date:'medium' }}
                          } @else {
                            Sigue acumulando progreso
                          }
                        </span>
                      </div>
                    </div>
                  } @empty {
                    <p class="rounded-md bg-app p-4 text-sm text-secondary">No hay insignias desbloqueadas con este filtro.</p>
                  }
                </div>
              </article>
            }

            <article class="rw-card rw-card-pad">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="m-0 text-lg font-bold text-main">Historial</h2>
                  <p class="m-0 mt-1 text-sm text-secondary">
                    Mostrando {{ visibleSessions().length }} de {{ sessions().length }} sesiones.
                  </p>
                </div>
                @if (hasMoreSessions()) {
                  <button class="rw-action" type="button" (click)="loadMoreSessions()">Cargar m&aacute;s</button>
                }
              </div>
              <div class="history-list mt-4 grid gap-3" (scroll)="onHistoryScroll($event)">
                @for (session of visibleSessions(); track session.id) {
                  <div class="rounded-md border border-line bg-app p-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong class="text-sm text-main">{{ session.exercise_name }}</strong>
                        <p class="m-0 mt-1 text-xs text-secondary">{{ session.paciente_nombre }} &middot; {{ session.performed_at | date:'medium' }}</p>
                      </div>
                      <span class="rounded-md px-3 py-1 text-xs font-bold" [ngClass]="session.pain_level >= 7 ? 'bg-danger-bg text-danger' : 'bg-primary-low text-primary'">
                        Dolor {{ session.pain_level }}/10
                      </span>
                    </div>
                    <div class="mt-3 grid gap-3 text-sm sm:grid-cols-4">
                      <span>Reps: <strong>{{ session.repetitions_completed }}</strong></span>
                      <span>Puntos: <strong>{{ session.points_awarded }}</strong></span>
                      <span>Bonus: <strong>{{ session.speed_bonus_points }}</strong></span>
                      <span>Racha: <strong>{{ session.streak_days }}</strong></span>
                    </div>
                  </div>
                } @empty {
                  <p class="rounded-md bg-app p-4 text-sm text-secondary">No hay sesiones registradas.</p>
                }
              </div>
              @if (hasMoreSessions()) {
                <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p class="m-0 text-sm text-secondary">{{ remainingSessions() }} sesiones restantes. Tambi&eacute;n puedes llegar al final del historial para cargar m&aacute;s.</p>
                  <button class="rw-action" type="button" (click)="loadMoreSessions()">Cargar m&aacute;s</button>
                </div>
              }
            </article>
        </div>
      }

      @if (sessionModalOpen()) {
        <div class="session-modal-backdrop" (click)="closeSessionModal()">
          <section
            class="session-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-modal-title"
            (click)="$event.stopPropagation()"
          >
            <header class="session-modal__header">
              <div>
                <p class="m-0 text-xs font-bold uppercase tracking-wide text-primary">Nueva actividad</p>
                <h2 id="session-modal-title" class="m-0 mt-1 text-xl font-bold text-main">Registrar sesi&oacute;n</h2>
              </div>
              <button class="session-modal__close" type="button" aria-label="Cerrar modal" (click)="closeSessionModal()">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </header>

            <form class="session-modal__form" [formGroup]="sessionForm" (ngSubmit)="submit()">
              @if (role() === 'terapeuta') {
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Paciente
                  <select class="rw-input normal-case tracking-normal" formControlName="paciente">
                    @for (patient of patients(); track patient.id) {
                      <option [value]="patient.id">{{ displayName(patient) }}</option>
                    }
                  </select>
                </label>
              }

              <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                Ejercicio
                <input class="rw-input normal-case tracking-normal" formControlName="exercise_name" maxlength="140" />
              </label>

              <div class="grid min-w-0 gap-4 sm:grid-cols-2">
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Repeticiones
                  <input class="rw-input normal-case tracking-normal" type="number" min="0" formControlName="repetitions_completed" />
                </label>
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Objetivo
                  <input class="rw-input normal-case tracking-normal" type="number" min="0" formControlName="planned_repetitions" />
                </label>
              </div>

              <div class="grid min-w-0 gap-4 sm:grid-cols-2">
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Duraci&oacute;n (seg)
                  <input class="rw-input normal-case tracking-normal" type="number" min="0" formControlName="duration_seconds" />
                </label>
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Tiempo estimado (seg)
                  <input class="rw-input normal-case tracking-normal" type="number" min="0" formControlName="planned_duration_seconds" />
                </label>
              </div>

              <div class="grid min-w-0 gap-4 sm:grid-cols-2">
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Dolor 0-10
                  <input class="rw-input normal-case tracking-normal" type="number" min="0" max="10" formControlName="pain_level" />
                </label>
                <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Movilidad (opcional)
                  <input class="rw-input normal-case tracking-normal" type="number" min="0" step="0.01" formControlName="mobility_score" />
                </label>
              </div>

              @if (role() === 'paciente' && motivation(); as stats) {
                <div class="session-preview">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="m-0 text-xs font-bold uppercase tracking-wide text-primary">Vista previa de puntos</p>
                      <p class="m-0 mt-1 text-sm text-secondary">
                        Se calcula con repeticiones, bonus de velocidad y bono de racha.
                      </p>
                    </div>
                    <span class="session-preview__points">+{{ projectedPoints() }}</span>
                  </div>
                  <div class="mt-3 grid gap-2 text-xs text-secondary sm:grid-cols-3">
                    <span>Base: <strong>{{ sessionForm.controls.repetitions_completed.value }}</strong></span>
                    <span>Velocidad: <strong>+{{ projectedSpeedBonus() }}</strong></span>
                    <span>Racha prox.: <strong>{{ stats.next_session_streak }} d / +{{ stats.next_session_streak_bonus_percent }}%</strong></span>
                  </div>
                </div>
              }

              <div class="session-modal__actions">
                <button class="rw-action" type="button" [disabled]="saving()" (click)="closeSessionModal()">Cancelar</button>
                <button class="rw-action rw-action--primary" type="submit" [disabled]="sessionForm.invalid || saving()">
                  @if (saving()) {
                    <span class="session-spinner" aria-hidden="true"></span>
                    Guardando...
                  } @else {
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    Guardar sesi&oacute;n
                  }
                </button>
              </div>
            </form>
          </section>
        </div>
      }

      @if (sessionCelebration(); as reward) {
        <div class="session-celebration" aria-live="polite" aria-atomic="true">
          <div class="session-celebration__burst" aria-hidden="true"></div>
          <article class="session-celebration__card">
            <p class="m-0 text-xs font-bold uppercase tracking-wide text-primary">Sesi&oacute;n guardada</p>
            <strong class="session-celebration__points">+{{ reward.points }}</strong>
            <p class="m-0 text-base font-bold text-main">puntos sumados</p>
            @if (reward.streakActivated || reward.streakDelta > 0) {
              <div class="session-celebration__streak">
                <span>
                  @if (reward.streakActivated) {
                    Racha activada
                  } @else {
                    +{{ reward.streakDelta }} d&iacute;a de racha
                  }
                </span>
                <strong>{{ reward.streakDays }} d&iacute;as</strong>
              </div>
            }
            @if (reward.badges.length) {
              <p class="m-0 rounded-md bg-primary-low px-3 py-2 text-sm font-bold text-primary">
                Insignia desbloqueada: {{ reward.badges[0].name }}
              </p>
            }
          </article>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .sessions-weekly-bar {
        display: grid;
        grid-template-columns: minmax(220px, 0.9fr) minmax(300px, 1fr) minmax(260px, 1.1fr);
        gap: 16px;
        align-items: stretch;
        padding: 16px;
        overflow: hidden;
      }

      .sessions-weekly-bar__intro,
      .sessions-weekly-bar__metrics,
      .sessions-weekly-bar__chart {
        min-width: 0;
        border-radius: 8px;
      }

      .sessions-weekly-bar__intro {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .sessions-weekly-bar__pill {
        flex-shrink: 0;
        border: 1px solid color-mix(in srgb, var(--baseline-primary) 25%, var(--baseline-border));
        border-radius: 8px;
        background: var(--baseline-primary-low);
        padding: 8px 10px;
        color: var(--baseline-primary);
        font-size: 12px;
        font-weight: 700;
      }

      .sessions-weekly-bar__metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .sessions-weekly-bar__metrics > div {
        display: grid;
        gap: 4px;
        border: 1px solid var(--baseline-border);
        border-radius: 8px;
        background: var(--baseline-app);
        padding: 12px;
      }

      .sessions-weekly-bar__metrics strong {
        font-size: 22px;
        line-height: 1.15;
      }

      .sessions-weekly-bar__chart {
        display: grid;
        height: 112px;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 8px;
      }

      .sessions-weekly-bar__day {
        display: grid;
        min-width: 0;
        grid-template-rows: 1fr auto;
        gap: 6px;
        text-align: center;
      }

      .sessions-weekly-bar__bar {
        display: flex;
        min-height: 0;
        align-items: flex-end;
        border-radius: 8px;
        background: var(--baseline-app);
        padding: 4px;
      }

      .sessions-weekly-bar__bar > div {
        width: 100%;
        min-height: 8px;
        border-radius: 6px 6px 3px 3px;
      }

      .sessions-weekly-bar__day span {
        color: var(--baseline-secondary);
        font-size: 12px;
        font-weight: 700;
      }

      .badge-card {
        --badge-accent: var(--baseline-primary);
        --badge-soft: var(--baseline-primary-low);
        position: relative;
        display: grid;
        min-height: 230px;
        grid-template-rows: auto 1fr auto;
        gap: 14px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--badge-accent) 36%, var(--baseline-border));
        border-radius: 8px;
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--badge-soft) 82%, var(--baseline-surface)), var(--baseline-surface) 54%),
          var(--baseline-surface);
        padding: 16px;
        box-shadow: var(--shadow-sm);
      }

      .badge-card--locked {
        background: var(--baseline-app);
        opacity: 0.82;
      }

      .badge-card__shine {
        position: absolute;
        inset: -42px -42px auto auto;
        z-index: -1;
        width: 120px;
        height: 120px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--badge-accent) 18%, transparent);
      }

      .badge-card__header {
        display: flex;
        min-width: 0;
        align-items: flex-start;
        gap: 14px;
      }

      .badge-medal {
        display: grid;
        width: 64px;
        height: 64px;
        flex-shrink: 0;
        place-items: center;
        border: 1px solid color-mix(in srgb, var(--badge-accent) 42%, var(--baseline-border));
        border-radius: 8px;
        background:
          radial-gradient(circle at 30% 22%, color-mix(in srgb, #ffffff 75%, transparent), transparent 34%),
          color-mix(in srgb, var(--badge-soft) 78%, var(--baseline-surface));
        color: var(--badge-accent);
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4);
      }

      .badge-medal--locked {
        background: var(--baseline-surface);
        color: var(--baseline-muted);
      }

      .badge-chip {
        display: inline-flex;
        min-height: 24px;
        align-items: center;
        border: 1px solid color-mix(in srgb, var(--badge-accent) 28%, var(--baseline-border));
        border-radius: 8px;
        background: color-mix(in srgb, var(--badge-soft) 76%, var(--baseline-surface));
        padding: 0 8px;
        color: var(--badge-accent);
        font-size: 11px;
        font-weight: 700;
      }

      .badge-chip--muted {
        border-color: var(--baseline-border);
        background: color-mix(in srgb, var(--baseline-surface) 75%, var(--baseline-app));
        color: var(--baseline-secondary);
      }

      .badge-card__title {
        display: block;
        color: color-mix(in srgb, var(--badge-accent) 72%, var(--baseline-text));
        font-size: 15px;
        line-height: 1.25;
      }

      .badge-card__body {
        border-left: 3px solid var(--badge-accent);
        border-radius: 4px;
        background: color-mix(in srgb, var(--badge-soft) 48%, var(--baseline-surface));
        padding: 10px 12px;
      }

      .badge-card__footer {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border-top: 1px solid color-mix(in srgb, var(--badge-accent) 20%, var(--baseline-border));
        padding-top: 12px;
      }

      .badge-status {
        display: inline-flex;
        min-height: 28px;
        align-items: center;
        border-radius: 8px;
        background: var(--badge-accent);
        padding: 0 10px;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
      }

      .badge-status--locked {
        background: var(--baseline-border);
        color: var(--baseline-secondary);
      }

      .history-list {
        max-height: 560px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .session-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 70;
        display: grid;
        place-items: center;
        background: rgb(15 25 35 / 0.58);
        padding: 20px;
        animation: session-fade-in 160ms var(--baseline-motion-ease);
      }

      .session-modal {
        width: min(760px, 100%);
        max-height: min(92vh, 860px);
        overflow: hidden;
        border: 1px solid var(--baseline-border);
        border-radius: 8px;
        background: var(--baseline-surface);
        box-shadow: var(--shadow-lg);
        animation: session-modal-enter 220ms var(--baseline-motion-ease);
      }

      .session-modal__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid var(--baseline-border);
        padding: 20px;
      }

      .session-modal__close {
        display: grid;
        width: 40px;
        height: 40px;
        place-items: center;
        border: 1px solid var(--baseline-border);
        border-radius: 8px;
        background: var(--baseline-app);
        color: var(--baseline-text);
      }

      .session-modal__form {
        display: grid;
        max-height: calc(min(92vh, 860px) - 93px);
        gap: 16px;
        overflow-y: auto;
        padding: 20px;
      }

      .session-modal__actions {
        position: sticky;
        bottom: -20px;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid var(--baseline-border);
        background: color-mix(in srgb, var(--baseline-surface) 92%, transparent);
        padding-top: 16px;
        backdrop-filter: blur(10px);
      }

      .session-preview {
        border: 1px solid color-mix(in srgb, var(--baseline-primary) 30%, var(--baseline-border));
        border-radius: 8px;
        background: linear-gradient(135deg, var(--baseline-primary-low), var(--baseline-surface));
        padding: 16px;
      }

      .session-preview__points {
        border-radius: 8px;
        background: var(--baseline-surface);
        padding: 8px 14px;
        color: var(--baseline-primary);
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
      }

      .session-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgb(255 255 255 / 0.45);
        border-top-color: #fff;
        border-radius: 999px;
        animation: session-spin 720ms linear infinite;
      }

      .session-celebration {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: grid;
        place-items: center;
        pointer-events: none;
      }

      .session-celebration__burst {
        position: absolute;
        width: min(56vw, 360px);
        aspect-ratio: 1;
        border-radius: 999px;
        background:
          radial-gradient(circle, color-mix(in srgb, var(--baseline-primary) 22%, transparent), transparent 62%),
          conic-gradient(from 0deg, #00a781, #4d94ff, #ffb84d, #ff5c5c, #00a781);
        filter: blur(2px);
        opacity: 0.26;
        animation: session-burst 1700ms var(--baseline-motion-ease) forwards;
      }

      .session-celebration__card {
        display: grid;
        min-width: min(360px, calc(100vw - 40px));
        justify-items: center;
        gap: 10px;
        border: 1px solid color-mix(in srgb, var(--baseline-primary) 32%, var(--baseline-border));
        border-radius: 8px;
        background: var(--baseline-surface);
        padding: 24px;
        box-shadow: var(--shadow-lg);
        animation: session-pop 1800ms var(--baseline-motion-ease) forwards;
      }

      .session-celebration__points {
        color: var(--baseline-primary);
        font-size: clamp(56px, 12vw, 92px);
        line-height: 0.95;
      }

      .session-celebration__streak {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--baseline-warning) 18%, var(--baseline-surface));
        padding: 10px 12px;
        color: var(--baseline-text);
        font-size: 14px;
        font-weight: 700;
      }

      @keyframes session-fade-in {
        from {
          opacity: 0;
        }
      }

      @keyframes session-modal-enter {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
      }

      @keyframes session-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes session-pop {
        0% {
          opacity: 0;
          transform: translateY(18px) scale(0.9);
        }

        18%,
        78% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        100% {
          opacity: 0;
          transform: translateY(-12px) scale(0.98);
        }
      }

      @keyframes session-burst {
        0% {
          transform: scale(0.42) rotate(0deg);
        }

        75% {
          opacity: 0.24;
        }

        100% {
          opacity: 0;
          transform: scale(1.3) rotate(60deg);
        }
      }

      @media (max-width: 1120px) {
        .sessions-weekly-bar {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .sessions-weekly-bar__intro,
        .badge-card__footer,
        .session-celebration__streak {
          align-items: flex-start;
          flex-direction: column;
        }

        .sessions-weekly-bar__metrics {
          grid-template-columns: 1fr;
        }

        .session-modal-backdrop {
          align-items: end;
          padding: 12px;
        }

        .session-modal {
          max-height: 94vh;
        }
      }
    `,
  ],
})
export class SessionsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private clinicalDataService = inject(ClinicalDataService);
  private engagementService = inject(EngagementService);
  private routineService = inject(RoutineService);
  private celebrationTimeout: ReturnType<typeof setTimeout> | null = null;

  loading = signal(true);
  saving = signal(false);
  celebrating = signal(false);
  sessionModalOpen = signal(false);
  sessionCelebration = signal<SessionCelebration | null>(null);
  sessions = signal<ExerciseSession[]>([]);
  patients = signal<RoleAccount[]>([]);
  motivation = signal<MotivationProfile | null>(null);
  weeklySummary = signal<WeeklySummary | null>(null);
  badges = signal<PatientBadge[]>([]);
  badgeVisibility = signal<BadgeVisibility>('earned');
  historyVisibleCount = signal(5);
  assignments = signal<RoutineAssignment[]>([]);
  notifications = signal<Notification[]>([]);
  newlyUnlockedBadges = signal<PatientBadge[]>([]);
  lastSession = signal<ExerciseSession | null>(null);
  role = computed(() => this.authService.getRole() ?? 'paciente');
  earnedBadgeCount = computed(() => this.badges().length);
  pendingBadgeCount = computed(() => Math.max(BADGE_DEFINITIONS.length - this.earnedBadgeCount(), 0));
  badgeCollection = computed<BadgeCollectionItem[]>(() => {
    const earnedBadges = new Map(this.badges().map((badge) => [badge.code, badge]));

    return BADGE_DEFINITIONS.map((definition) => {
      const earnedBadge = earnedBadges.get(definition.code);

      return {
        ...definition,
        name: earnedBadge?.name ?? definition.name,
        description: earnedBadge?.description ?? definition.description,
        unlocked: Boolean(earnedBadge),
        awarded_at: earnedBadge?.awarded_at ?? null,
        source_session: earnedBadge?.source_session ?? null,
      };
    });
  });
  visibleBadgeCollection = computed(() => {
    const collection = this.badgeCollection();
    return this.badgeVisibility() === 'earned'
      ? collection.filter((badge) => badge.unlocked)
      : collection;
  });
  visibleSessions = computed(() => this.sessions().slice(0, this.historyVisibleCount()));
  remainingSessions = computed(() => Math.max(this.sessions().length - this.visibleSessions().length, 0));
  hasMoreSessions = computed(() => this.remainingSessions() > 0);

  sessionForm = this.fb.nonNullable.group({
    paciente: [0],
    exercise_name: ['Flexion controlada', [Validators.required, Validators.maxLength(140)]],
    repetitions_completed: [10, [Validators.required, Validators.min(0)]],
    planned_repetitions: [10, [Validators.required, Validators.min(0)]],
    duration_seconds: [60, [Validators.required, Validators.min(0)]],
    planned_duration_seconds: [900, [Validators.required, Validators.min(0)]],
    pain_level: [0, [Validators.required, Validators.min(0), Validators.max(10)]],
    mobility_score: [null as number | null],
  });

  ngOnInit(): void {
    this.load();
    this.clinicalDataService.visiblePatients().subscribe((patients) => {
      this.patients.set(patients);
      if (patients[0]) this.sessionForm.patchValue({ paciente: patients[0].id });
    });
  }

  load(): void {
    this.engagementService.getSessions().subscribe((sessions) => {
      this.sessions.set(sessions);
      this.loading.set(false);
    });

    if (this.role() === 'paciente') {
      this.engagementService.getMotivation().subscribe((stats) => this.motivation.set(stats));
      this.engagementService.getBadges().subscribe((badges) => this.badges.set(badges));
      this.engagementService.getWeeklySummary().subscribe((summary) => this.weeklySummary.set(summary));
      this.routineService.getAssignments().subscribe((assignments) => this.assignments.set(assignments));
      this.routineService.getNotifications().subscribe((notifications) => {
        this.notifications.set(notifications.filter((notification) => !notification.is_read));
      });
    }
  }

  openSessionModal(): void {
    this.sessionModalOpen.set(true);
  }

  closeSessionModal(): void {
    if (this.saving()) return;
    this.sessionModalOpen.set(false);
  }

  loadMoreSessions(): void {
    this.historyVisibleCount.update((count) => Math.min(count + 5, this.sessions().length));
  }

  onHistoryScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const reachedBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 24;
    if (reachedBottom && this.hasMoreSessions()) this.loadMoreSessions();
  }

  submit(): void {
    if (this.sessionForm.invalid) return;

    const raw = this.sessionForm.getRawValue();
    const previousStreak = this.motivation()?.current_streak ?? 0;
    const mobilityScore = raw.mobility_score as number | string | null;
    const payload: Partial<ExerciseSession> = {
      exercise_name: raw.exercise_name,
      repetitions_completed: raw.repetitions_completed,
      planned_repetitions: raw.planned_repetitions,
      duration_seconds: raw.duration_seconds,
      planned_duration_seconds: raw.planned_duration_seconds,
      pain_level: raw.pain_level,
      mobility_score: mobilityScore === null || mobilityScore === '' ? null : String(mobilityScore),
    };
    if (this.role() === 'terapeuta') payload.paciente = raw.paciente;

    this.saving.set(true);
    this.engagementService.createSession(payload).subscribe({
      next: (session) => {
        this.lastSession.set(session);
        this.newlyUnlockedBadges.set(session.new_badges ?? []);
        this.sessions.update((sessions) => [session, ...sessions]);
        this.saving.set(false);
        this.sessionModalOpen.set(false);
        this.showSessionCelebration(session, previousStreak);
        this.celebrate();
        if (this.role() === 'paciente') {
          this.engagementService.notifyMotivationChanged();
          this.engagementService.getMotivation().subscribe((stats) => this.motivation.set(stats));
          this.engagementService.getBadges().subscribe((badges) => this.badges.set(badges));
          this.engagementService.getWeeklySummary().subscribe((summary) => this.weeklySummary.set(summary));
        }
      },
      error: () => this.saving.set(false),
    });
  }

  displayName(account: RoleAccount): string {
    return this.clinicalDataService.displayName(account);
  }

  setBadgeVisibility(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.badgeVisibility.set(value === 'earned' ? 'earned' : 'all');
  }

  projectedSpeedBonus(): number {
    const repetitions = Number(this.sessionForm.controls.repetitions_completed.value) || 0;
    const durationSeconds = Number(this.sessionForm.controls.duration_seconds.value) || 0;
    const plannedDurationSeconds = Number(this.sessionForm.controls.planned_duration_seconds.value) || 0;
    if (!repetitions || !durationSeconds) return 0;

    if (plannedDurationSeconds) {
      const tenMinutesEarly = durationSeconds <= Math.max(plannedDurationSeconds - 600, 0);
      const twentyPercentFaster = durationSeconds <= plannedDurationSeconds * 0.8;
      return tenMinutesEarly || twentyPercentFaster ? Math.max(1, Math.round(repetitions * 0.1)) : 0;
    }

    const repsPerMinute = repetitions / Math.max(durationSeconds / 60, 1);
    if (repsPerMinute >= 30) return Math.max(1, Math.round(repetitions * 0.25));
    if (repsPerMinute >= 15) return Math.max(1, Math.round(repetitions * 0.1));
    return 0;
  }

  projectedPoints(): number {
    const repetitions = Number(this.sessionForm.controls.repetitions_completed.value) || 0;
    const speedBonus = this.projectedSpeedBonus();
    const streakBonus = this.motivation()?.next_session_streak_bonus_percent ?? 0;
    return Math.round((repetitions + speedBonus) * (1 + streakBonus / 100));
  }

  streakLabel(status: MotivationProfile['streak_status']): string {
    if (status === 'intacta') return 'Activa';
    if (status === 'en_peligro') return 'En peligro';
    return 'Perdida';
  }

  streakBadgeClass(status: MotivationProfile['streak_status']): string {
    if (status === 'intacta') return 'bg-primary-low text-primary';
    if (status === 'en_peligro') return 'bg-warning/10 text-warning';
    return 'bg-danger-bg text-danger';
  }

  dailyBarHeight(points: number): number {
    const maxPoints = Math.max(...(this.weeklySummary()?.daily_activity ?? []).map((day) => day.points), 1);
    return Math.max(10, Math.round((points / maxPoints) * 100));
  }

  prepareAssignedExercise(item: RoutineExerciseItem): void {
    this.sessionForm.patchValue({
      exercise_name: item.exercise?.name ?? 'Ejercicio asignado',
      repetitions_completed: item.repetitions,
      planned_repetitions: item.repetitions,
      duration_seconds: item.duration_seconds,
      planned_duration_seconds: item.duration_seconds,
      pain_level: 0,
    });
    this.openSessionModal();
  }

  markNotificationRead(id: string): void {
    this.routineService.markNotificationRead(id).subscribe(() => {
      this.notifications.update((notifications) => notifications.filter((notification) => notification.id !== id));
    });
  }

  private showSessionCelebration(session: ExerciseSession, previousStreak: number): void {
    if (this.celebrationTimeout) {
      clearTimeout(this.celebrationTimeout);
      this.celebrationTimeout = null;
    }

    const streakDelta = Math.max(0, session.streak_days - previousStreak);
    this.sessionCelebration.set({
      points: session.points_awarded,
      streakDays: session.streak_days,
      streakDelta,
      streakActivated: previousStreak <= 0 && session.streak_days > 0,
      badges: session.new_badges ?? [],
    });
    this.celebrationTimeout = setTimeout(() => {
      this.sessionCelebration.set(null);
      this.celebrationTimeout = null;
    }, 1900);
  }

  private celebrate(): void {
    this.celebrating.set(true);
    setTimeout(() => this.celebrating.set(false), 1200);

    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);

    if (this.newlyUnlockedBadges().length) {
      const badgeOscillator = context.createOscillator();
      const badgeGain = context.createGain();
      badgeOscillator.frequency.value = 880;
      badgeGain.gain.value = 0.04;
      badgeOscillator.connect(badgeGain);
      badgeGain.connect(context.destination);
      badgeOscillator.start(context.currentTime + 0.14);
      badgeOscillator.stop(context.currentTime + 0.28);
    }
  }
}
