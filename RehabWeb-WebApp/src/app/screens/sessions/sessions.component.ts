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
              </div>
              <span class="rounded-md bg-surface px-4 py-2 text-sm font-bold text-primary">Visualizaci&oacute;n inmediata</span>
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
                  Dolor 0-10
                  <input class="rw-input normal-case tracking-normal" type="number" min="0" max="10" formControlName="pain_level" />
                </label>
              </div>

              <label class="grid min-w-0 gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                Movilidad (opcional)
                <input class="rw-input normal-case tracking-normal" type="number" min="0" step="0.01" formControlName="mobility_score" />
              </label>

              <button class="rw-action rw-action--primary" type="submit" [disabled]="sessionForm.invalid || saving()">
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
                <h2 class="m-0 text-lg font-bold text-main">Colecci&oacute;n de insignias</h2>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  @for (badge of badges(); track badge.code) {
                    <div class="rounded-md border border-primary bg-primary-low p-4">
                      <strong class="text-sm text-primary">{{ badge.name }}</strong>
                      <p class="m-0 mt-1 text-xs text-secondary">{{ badge.description }}</p>
                      <p class="m-0 mt-2 text-xs text-muted">{{ badge.awarded_at | date:'medium' }}</p>
                    </div>
                  } @empty {
                    <p class="rounded-md bg-app p-4 text-sm text-secondary">A&uacute;n no hay insignias desbloqueadas.</p>
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

  loading = signal(true);
  saving = signal(false);
  celebrating = signal(false);
  sessions = signal<ExerciseSession[]>([]);
  patients = signal<RoleAccount[]>([]);
  motivation = signal<MotivationProfile | null>(null);
  badges = signal<PatientBadge[]>([]);
  lastSession = signal<ExerciseSession | null>(null);
  role = computed(() => this.authService.getRole() ?? 'paciente');

  sessionForm = this.fb.nonNullable.group({
    paciente: [0],
    exercise_name: ['Flexion controlada', [Validators.required, Validators.maxLength(140)]],
    repetitions_completed: [10, [Validators.required, Validators.min(0)]],
    planned_repetitions: [10, [Validators.required, Validators.min(0)]],
    duration_seconds: [60, [Validators.required, Validators.min(0)]],
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
    }
  }

  submit(): void {
    if (this.sessionForm.invalid) return;

    const raw = this.sessionForm.getRawValue();
    const payload: Partial<ExerciseSession> = {
      exercise_name: raw.exercise_name,
      repetitions_completed: raw.repetitions_completed,
      planned_repetitions: raw.planned_repetitions,
      duration_seconds: raw.duration_seconds,
      pain_level: raw.pain_level,
      mobility_score: raw.mobility_score === null ? null : String(raw.mobility_score),
    };
    if (this.role() === 'terapeuta') payload.paciente = raw.paciente;

    this.saving.set(true);
    this.engagementService.createSession(payload).subscribe({
      next: (session) => {
        this.lastSession.set(session);
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
  }
}
