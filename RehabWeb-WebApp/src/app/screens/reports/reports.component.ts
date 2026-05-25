import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RoleAccount } from '../../services/account-admin.service';
import { AuthService } from '../../services/auth.service';
import { ClinicalDataService } from '../../services/clinical-data.service';
import {
  EngagementService,
  LeaderboardEntry,
  MotivationProfile,
  WeeklySummary,
} from '../../services/engagement.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rw-page rw-page--narrow">
      <header class="rw-page-header">
        <div>
          <h1 class="rw-title">Generación de Reportes</h1>
          <p class="rw-subtitle">Reportes preparados únicamente con pacientes reales visibles para tu rol.</p>
        </div>
      </header>

      <article class="rw-card rw-card-pad">
        @if (loading()) {
          <p class="m-0 text-sm text-secondary">Cargando datos reales...</p>
        } @else {
          <div class="mb-6 flex items-center gap-4">
            <span class="grid h-12 w-12 place-items-center rounded-lg bg-info/10 text-info">
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
            <div>
              <h2 class="m-0 text-lg font-bold leading-solid text-main">Exportación de Datos Clínicos</h2>
              <p class="m-0 text-sm text-secondary">{{ role() === 'paciente' ? 'Tu cuenta será usada como fuente del reporte.' : 'Selecciona un paciente real de tu directorio.' }}</p>
            </div>
          </div>

          <div class="mb-6 grid gap-4 md:grid-cols-2">
            <section class="rounded-md border border-line bg-app p-4">
              <h3 class="m-0 text-base font-bold text-main">Resumen semanal motivacional</h3>
              @if (weeklySummary(); as summary) {
                <dl class="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wide text-muted">Completadas</dt>
                    <dd class="mt-1 text-xl font-bold text-primary">{{ summary.sessions_completed }}/{{ summary.sessions_scheduled }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wide text-muted">Puntos</dt>
                    <dd class="mt-1 text-xl font-bold text-info">{{ summary.points_obtained }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wide text-muted">Semana</dt>
                    <dd class="mt-1 text-sm font-bold text-main">{{ summary.week_start }} - {{ summary.week_end }}</dd>
                  </div>
                </dl>
              } @else {
                <p class="m-0 mt-3 text-sm text-secondary">No hay resumen semanal disponible.</p>
              }
            </section>

            <section class="rounded-md border border-line bg-app p-4">
              <h3 class="m-0 text-base font-bold text-main">Ranking opcional Top 10</h3>
              <div class="mt-4 grid gap-2">
                @if (role() === 'paciente' && !canSeeLeaderboard()) {
                  <p class="m-0 text-sm text-secondary">
                    Activa tu consentimiento en Configuraciones para participar. No esta disponible para menores.
                  </p>
                } @else {
                  @for (entry of leaderboard(); track entry.nombre) {
                    <div class="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm">
                      <span class="font-bold text-main">{{ entry.nombre }}</span>
                      <span class="text-secondary">{{ entry.total_points }} pts</span>
                    </div>
                  } @empty {
                    <p class="m-0 text-sm text-secondary">Aun no hay pacientes con consentimiento activo.</p>
                  }
                }
              </div>
            </section>
          </div>

          <form class="grid gap-5">
            <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
              Selección de paciente
              <select class="rounded-md border border-line bg-app px-4 py-3 text-sm font-medium normal-case tracking-normal text-main outline-none focus:border-focus focus:ring-2 focus:ring-focus/20" [disabled]="patients().length === 0">
                @for (patient of patients(); track patient.id) {
                  <option [value]="patient.id">{{ displayName(patient) }}</option>
                } @empty {
                  <option>No hay pacientes reales disponibles</option>
                }
              </select>
            </label>

            <div class="grid gap-5 sm:grid-cols-2">
              <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                Fecha de inicio
                <input class="rounded-md border border-line bg-app px-4 py-3 text-sm font-medium normal-case tracking-normal text-main outline-none focus:border-focus focus:ring-2 focus:ring-focus/20" type="date" />
              </label>
              <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                Fecha de fin
                <input class="rounded-md border border-line bg-app px-4 py-3 text-sm font-medium normal-case tracking-normal text-main outline-none focus:border-focus focus:ring-2 focus:ring-focus/20" type="date" />
              </label>
            </div>

            <div class="rounded-md border border-line bg-app p-4 text-sm text-secondary">
              Los botones de exportación quedan deshabilitados hasta que exista un endpoint real de reportes.
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <button class="rounded-lg border border-line bg-surface p-6 text-center opacity-60 shadow-sm" type="button" disabled>
                <strong class="block text-base font-bold text-main">Descargar Excel</strong>
                <span class="mt-1 block text-xs text-secondary">Pendiente de endpoint real</span>
              </button>
              <button class="rounded-lg border border-line bg-surface p-6 text-center opacity-60 shadow-sm" type="button" disabled>
                <strong class="block text-base font-bold text-main">Descargar PDF</strong>
                <span class="mt-1 block text-xs text-secondary">Pendiente de endpoint real</span>
              </button>
            </div>
          </form>
        }
      </article>
    </section>
  `,
})
export class ReportsComponent implements OnInit {
  private clinicalDataService = inject(ClinicalDataService);
  private authService = inject(AuthService);
  private engagementService = inject(EngagementService);

  loading = signal(true);
  patients = signal<RoleAccount[]>([]);
  weeklySummary = signal<WeeklySummary | null>(null);
  leaderboard = signal<LeaderboardEntry[]>([]);
  motivation = signal<MotivationProfile | null>(null);
  role = computed(() => this.authService.getRole() ?? 'paciente');
  canSeeLeaderboard = computed(() => {
    const motivation = this.motivation();
    return this.role() !== 'paciente' || !!(motivation?.leaderboard_enabled && motivation.leaderboard_opt_in);
  });

  ngOnInit(): void {
    this.clinicalDataService.visiblePatients().subscribe((patients) => {
      this.patients.set(patients);
      this.loading.set(false);
    });
    if (this.role() === 'paciente') {
      this.engagementService.getWeeklySummary().subscribe({
        next: (summary) => this.weeklySummary.set(summary),
        error: () => this.weeklySummary.set(null),
      });
      this.engagementService.getMotivation().subscribe({
        next: (motivation) => this.motivation.set(motivation),
        error: () => this.motivation.set(null),
      });
    }
    this.engagementService.getLeaderboard().subscribe({
      next: (entries) => this.leaderboard.set(entries),
      error: () => this.leaderboard.set([]),
    });
  }

  displayName(account: RoleAccount): string {
    return this.clinicalDataService.displayName(account);
  }
}
