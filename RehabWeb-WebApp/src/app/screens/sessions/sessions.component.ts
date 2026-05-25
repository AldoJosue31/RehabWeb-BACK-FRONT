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
} from '../../services/engagement.service';
import { RoutineAssignment, RoutineExerciseItem, RoutineService, Notification } from '../../services/routine.service';

type BadgeVisibility = 'all' | 'earned';

interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  requirement: string;
}

interface BadgeCollectionItem extends BadgeDefinition {
  unlocked: boolean;
  awarded_at: string | null;
  source_session: number | null;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    code: 'FIRST_SESSION',
    name: 'Primer Paso',
    description: 'Celebra el inicio de su viaje.',
    requirement: 'Registra la primera sesion de rehabilitacion.',
  },
  {
    code: 'STREAK_3',
    name: 'Constancia 3 dias',
    description: 'Completo sesiones durante 3 dias seguidos.',
    requirement: 'Completa sesiones durante 3 dias consecutivos.',
  },
  {
    code: 'STREAK_7',
    name: 'Semana Completa',
    description: 'Completo 7 sesiones consecutivas.',
    requirement: 'Mantiene una racha activa de 7 dias.',
  },
  {
    code: 'STREAK_30',
    name: 'Mes Dedicado',
    description: 'Completo 30 sesiones consecutivas.',
    requirement: 'Alcanza 30 dias seguidos con sesiones.',
  },
  {
    code: 'POINTS_100',
    name: 'Fortaleza',
    description: 'Acumulo sus primeros 100 puntos.',
    requirement: 'Suma 100 puntos totales.',
  },
  {
    code: 'POINTS_500',
    name: 'Superestrella',
    description: 'Acumulo 500 puntos.',
    requirement: 'Suma 500 puntos totales.',
  },
  {
    code: 'HIGH_REPS_100',
    name: '100 repeticiones',
    description: 'Completo 100 repeticiones en una sesion.',
    requirement: 'Completa 100 repeticiones en una sola sesion.',
  },
  {
    code: 'SPEED_20',
    name: 'Velocidad',
    description: 'Completo una sesion al menos 20% mas rapido.',
    requirement: 'Termina una sesion al menos 20% antes del tiempo estimado.',
  },
  {
    code: 'COGNITIVE_5',
    name: 'Cerebro Ganador',
    description: 'Completo ejercicios cognitivos 5 veces.',
    requirement: 'Completa 5 sesiones con ejercicios cognitivos.',
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
      </header>

      @if (loading()) {
        <div class="rw-card rw-card-pad text-sm text-secondary">Cargando sesiones reales...</div>
      } @else {
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

        <div class="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
          <article class="rw-card rw-card-pad min-w-0">
            <h2 class="m-0 text-lg font-bold leading-solid text-main">Registrar sesi&oacute;n</h2>
            <form class="mt-5 grid gap-4" [formGroup]="sessionForm" (ngSubmit)="submit()">
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

              <button class="rw-action rw-action--primary" type="button" [disabled]="sessionForm.invalid || saving()" (click)="submit()">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                Guardar sesi&oacute;n
              </button>
            </form>
          </article>

          <div class="grid gap-5">
            @if (role() === 'paciente' && motivation(); as stats) {
              <div class="grid gap-4 md:grid-cols-3">
                <article class="rw-card rw-card-pad">
                  <p class="m-0 text-sm text-secondary">Puntos totales</p>
                  <p class="mt-2 text-2xl font-bold text-main">{{ stats.total_points }}</p>
                </article>
                <article class="rw-card rw-card-pad">
                  <p class="m-0 text-sm text-secondary">Racha activa</p>
                  <p class="mt-2 text-2xl font-bold text-primary">{{ stats.current_streak }}</p>
                </article>
                <article class="rw-card rw-card-pad">
                  <p class="m-0 text-sm text-secondary">Mejor racha</p>
                  <p class="mt-2 text-2xl font-bold text-info">{{ stats.best_streak }}</p>
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
                      <option value="all">Mostrar todas</option>
                      <option value="earned">Ocultar pendientes</option>
                    </select>
                  </label>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (badge of visibleBadgeCollection(); track badge.code) {
                    <div
                      class="grid min-h-[184px] grid-rows-[auto_1fr_auto] rounded-md border p-4"
                      [ngClass]="badge.unlocked ? 'border-primary bg-primary-low shadow-sm' : 'border-line bg-app opacity-80 grayscale'"
                    >
                      <div class="flex items-start gap-3">
                        <span
                          class="grid h-16 w-16 shrink-0 place-items-center rounded-md border bg-surface"
                          [ngClass]="badge.unlocked ? 'border-primary/35 text-primary' : 'border-line text-muted'"
                          aria-hidden="true"
                        >
                          <svg class="h-14 w-14" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="27" fill="currentColor" opacity="0.12" />
                            <path d="M32 5l7 6 9-1 4 8 8 4-1 9 6 7-6 7 1 9-8 4-4 8-9-1-7 6-7-6-9 1-4-8-8-4 1-9-6-7 6-7-1-9 8-4 4-8 9 1 7-6Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                            @switch (badge.code) {
                              @case ('FIRST_SESSION') {
                                <path d="M24 42c-4-1-7-4-7-8 0-6 5-10 11-10h2" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                                <path d="M30 18h16l-4 7 4 7H30V18Z" fill="currentColor" opacity="0.22" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                                <circle cx="24" cy="42" r="3" fill="currentColor" />
                              }
                              @case ('STREAK_3') {
                                <path d="M33 48c8-4 13-10 13-18 0-8-5-14-9-18-1 7-6 10-10 14-4 4-7 8-7 13 0 6 5 10 13 9Z" fill="currentColor" opacity="0.22" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <path d="M31 42c4-2 6-5 6-9 0-3-2-6-4-8-1 4-4 6-6 9-2 3-2 6 4 8Z" fill="currentColor" />
                                <path d="M21 18h22" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55" />
                              }
                              @case ('STREAK_7') {
                                <rect x="17" y="18" width="30" height="28" rx="5" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2.4" />
                                <path d="M17 27h30M25 14v8M39 14v8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                                <path d="m24 36 5 5 11-12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                              }
                              @case ('STREAK_30') {
                                <circle cx="32" cy="32" r="15" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2.4" />
                                <path d="M32 17v30M17 32h30" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5" />
                                <path d="M24 39c2-6 6-11 8-14 2 3 6 8 8 14" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M25 25h14" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                              }
                              @case ('POINTS_100') {
                                <path d="M32 15l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2 5-11Z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <path d="M23 34h18M27 28h10M28 40h8" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                              }
                              @case ('POINTS_500') {
                                <path d="M32 14l18 14-18 22-18-22 18-14Z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <path d="M14 28h36M24 28l8 22 8-22M23 28l9-14 9 14" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                                <circle cx="32" cy="30" r="3" fill="currentColor" />
                              }
                              @case ('HIGH_REPS_100') {
                                <path d="M16 34h32M22 26v16M42 26v16M12 29v10M52 29v10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                                <rect x="24" y="22" width="16" height="20" rx="4" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2.4" />
                                <path d="M28 32h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                              }
                              @case ('SPEED_20') {
                                <path d="M21 44c-4-4-6-9-4-15 2-8 10-13 18-11 8 2 13 10 11 18-1 4-3 7-6 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                                <path d="M32 34l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                                <circle cx="32" cy="34" r="4" fill="currentColor" opacity="0.22" stroke="currentColor" stroke-width="2.4" />
                                <path d="M18 22l4 3M46 22l-4 3M32 16v5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                              }
                              @case ('COGNITIVE_5') {
                                <path d="M24 45c-5-2-8-7-8-13 0-7 5-12 11-13 2-4 9-4 11 0 6 1 10 6 10 13 0 6-3 11-8 13" fill="currentColor" opacity="0.14" />
                                <path d="M27 19c-6 1-11 6-11 13 0 6 3 11 8 13M37 19c6 1 11 6 11 13 0 6-3 11-8 13M32 18v29M24 30h16M24 38h7M33 25h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                              }
                            }
                          </svg>
                        </span>
                        <div class="min-w-0">
                          <strong class="text-sm" [ngClass]="badge.unlocked ? 'text-primary' : 'text-main'">{{ badge.name }}</strong>
                          <p class="m-0 mt-1 text-xs text-secondary">{{ badge.description }}</p>
                        </div>
                      </div>
                      <p class="m-0 mt-3 text-xs text-secondary">{{ badge.requirement }}</p>
                      <p class="m-0 mt-3 rounded-md px-3 py-2 text-xs font-bold" [ngClass]="badge.unlocked ? 'bg-surface text-primary' : 'bg-line text-muted'">
                        @if (badge.unlocked) {
                          Conseguida {{ badge.awarded_at | date:'medium' }}
                        } @else {
                          A&uacute;n no conseguida
                        }
                      </p>
                    </div>
                  } @empty {
                    <p class="rounded-md bg-app p-4 text-sm text-secondary">No hay insignias desbloqueadas con este filtro.</p>
                  }
                </div>
              </article>
            }

            <article class="rw-card rw-card-pad">
              <h2 class="m-0 text-lg font-bold text-main">Historial</h2>
              <div class="mt-4 grid gap-3">
                @for (session of sessions(); track session.id) {
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
            </article>
          </div>
        </div>
      }
    </section>
  `,
})
export class SessionsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private clinicalDataService = inject(ClinicalDataService);
  private engagementService = inject(EngagementService);
  private routineService = inject(RoutineService);

  loading = signal(true);
  saving = signal(false);
  celebrating = signal(false);
  sessions = signal<ExerciseSession[]>([]);
  patients = signal<RoleAccount[]>([]);
  motivation = signal<MotivationProfile | null>(null);
  badges = signal<PatientBadge[]>([]);
  badgeVisibility = signal<BadgeVisibility>('all');
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
      this.routineService.getAssignments().subscribe((assignments) => this.assignments.set(assignments));
      this.routineService.getNotifications().subscribe((notifications) => {
        this.notifications.set(notifications.filter((notification) => !notification.is_read));
      });
    }
  }

  submit(): void {
    if (this.sessionForm.invalid) return;

    const raw = this.sessionForm.getRawValue();
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
        this.celebrate();
        if (this.role() === 'paciente') {
          this.engagementService.getMotivation().subscribe((stats) => this.motivation.set(stats));
          this.engagementService.getBadges().subscribe((badges) => this.badges.set(badges));
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

  prepareAssignedExercise(item: RoutineExerciseItem): void {
    this.sessionForm.patchValue({
      exercise_name: item.exercise?.name ?? 'Ejercicio asignado',
      repetitions_completed: item.repetitions,
      planned_repetitions: item.repetitions,
      duration_seconds: item.duration_seconds,
      planned_duration_seconds: item.duration_seconds,
      pain_level: 0,
    });
  }

  markNotificationRead(id: string): void {
    this.routineService.markNotificationRead(id).subscribe(() => {
      this.notifications.update((notifications) => notifications.filter((notification) => notification.id !== id));
    });
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
