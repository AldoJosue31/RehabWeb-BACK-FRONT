import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoleAccount } from '../../services/account-admin.service';
import { AuthService } from '../../services/auth.service';
import { ClinicalDataService, DashboardData } from '../../services/clinical-data.service';
import { EngagementService, MotivationProfile, RehabAlert } from '../../services/engagement.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="rw-page">
      <header class="rw-page-header">
        <div>
          <h1 class="rw-title">{{ role() === 'paciente' ? 'Mi tablero' : 'Tablero de Control' }}</h1>
          <p class="rw-subtitle">{{ subtitle() }}</p>
        </div>
        @if (role() === 'terapeuta') {
          <a class="rw-action rw-action--primary rounded-full" routerLink="/rutinas/nueva">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            Nueva Rutina
          </a>
          <a class="rw-action rw-action--primary rounded-full" routerLink="/mensajeria">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Abrir mensajería
          </a>
        }
      </header>

      @if (loading()) {
        <div class="rw-card rw-card-pad text-sm text-secondary">Cargando información real del usuario...</div>
      } @else if (errorMsg()) {
        <div class="rounded-lg border border-danger bg-danger-bg p-4 text-sm font-bold text-danger">{{ errorMsg() }}</div>
      } @else {
        @if (role() === 'terapeuta') {
          <article class="rounded-lg border border-warning/60 bg-warning/10 p-4 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning/20 text-warning">
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </span>
                <div>
                  <h2 class="m-0 text-base font-bold leading-solid text-main">Alertas clínicas</h2>
                  <p class="m-0 text-sm text-secondary">{{ inactiveCount() }} pacientes requieren atención inmediata.</p>
                </div>
              </div>
              <a class="rw-action rounded-full border-warning/40 bg-surface text-main" routerLink="/alertas">Ver todos ({{ inactiveCount() }})</a>
            </div>
          </article>
        }

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          @for (metric of metrics(); track metric.label) {
            <article class="rw-card rw-card-pad transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <p class="m-0 text-sm font-medium text-secondary">{{ metric.label }}</p>
              <p class="mt-2 text-2xl font-bold leading-solid text-main">{{ metric.value }}</p>
              <span class="mt-4 inline-flex rounded-full px-2 py-1 text-xs font-bold" [ngClass]="metric.className">{{ metric.caption }}</span>
            </article>
          }
        </div>

        @if (role() === 'terapeuta') {
          <article class="rw-card rw-card-pad">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="m-0 text-lg font-bold leading-solid text-main">Pacientes visibles</h2>
                <p class="m-0 text-sm text-secondary">Datos cargados desde cuentas y conversaciones reales.</p>
              </div>
              <span class="rounded-full bg-primary-low px-3 py-1 text-xs font-bold text-primary">{{ patients().length }} registros</span>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              @for (patient of patients(); track patient.id) {
                <div class="rw-muted-panel">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="m-0 text-base font-bold leading-solid text-main">{{ displayName(patient) }}</h3>
                      <p class="mt-1 text-sm text-secondary">{{ patient.diagnostico_principal || 'Sin diagnóstico registrado' }}</p>
                    </div>
                    <span class="rounded-md px-3 py-1 text-xs font-bold" [ngClass]="statusClass(patient)">{{ patient.estado || 'activo' }}</span>
                  </div>
                </div>
              } @empty {
                <p class="rounded-md border border-line bg-app p-4 text-sm text-secondary">No hay pacientes reales vinculados para mostrar.</p>
              }
            </div>
          </article>
        } @else {
          <article class="rw-card rw-card-pad">
            <h2 class="m-0 text-lg font-bold leading-solid text-main">Información clínica</h2>
            @if (currentAccount()) {
              <dl class="mt-5 grid gap-4 sm:grid-cols-2">
                <div class="rounded-md bg-app p-4">
                  <dt class="text-xs font-bold uppercase tracking-wide text-muted">Diagnóstico</dt>
                  <dd class="mt-2 text-sm font-bold text-main">{{ currentAccount()?.diagnostico_principal || 'Sin diagnóstico registrado' }}</dd>
                </div>
                <div class="rounded-md bg-app p-4">
                  <dt class="text-xs font-bold uppercase tracking-wide text-muted">Nivel movilidad</dt>
                  <dd class="mt-2 text-sm font-bold text-main">{{ currentAccount()?.nivel_movilidad || 'Sin dato' }}</dd>
                </div>
                <div class="rounded-md bg-app p-4">
                  <dt class="text-xs font-bold uppercase tracking-wide text-muted">Estrategia validación</dt>
                  <dd class="mt-2 text-sm font-bold text-main">{{ currentAccount()?.estrategia_validacion || 'Sin dato' }}</dd>
                </div>
                <div class="rounded-md bg-app p-4">
                  <dt class="text-xs font-bold uppercase tracking-wide text-muted">Estrategia progreso</dt>
                  <dd class="mt-2 text-sm font-bold text-main">{{ currentAccount()?.estrategia_progreso || 'Sin dato' }}</dd>
                </div>
              </dl>
            } @else {
              <p class="mt-4 rounded-md border border-line bg-app p-4 text-sm text-secondary">No se pudo cargar la cuenta actual.</p>
            }
          </article>
        }
      }
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  private clinicalDataService = inject(ClinicalDataService);
  private authService = inject(AuthService);
  private engagementService = inject(EngagementService);

  loading = signal(true);
  errorMsg = signal('');
  dashboardData = signal<DashboardData | null>(null);
  alerts = signal<RehabAlert[]>([]);
  motivation = signal<MotivationProfile | null>(null);
  role = computed(() => this.authService.getRole() ?? 'paciente');
  patients = computed(() => this.dashboardData()?.patients ?? []);
  currentAccount = computed(() => this.dashboardData()?.currentAccount ?? null);
  inactiveCount = computed(() => this.alerts().filter((alert) => alert.status === 'activa' && alert.alert_type === 'INACTIVITY_WARNING').length);
  criticalCount = computed(() => this.alerts().filter((alert) => alert.status === 'activa' && alert.severity === 'critical').length);
  subtitle = computed(() => this.role() === 'paciente'
    ? 'Información real asociada a tu cuenta y plan clínico.'
    : 'Resumen basado en pacientes y conversaciones reales vinculadas a tu usuario.');
  metrics = computed(() => {
    const patients = this.patients();
    const conversations = this.dashboardData()?.conversations ?? [];
    if (this.role() === 'paciente') {
      return [
        { label: 'Conversaciones', value: conversations.length.toString(), caption: 'Mensajería real', className: 'bg-primary-low text-primary' },
        { label: 'Puntos', value: (this.motivation()?.total_points ?? this.currentAccount()?.total_points ?? 0).toString(), caption: 'Otorgamiento automático', className: 'bg-info/10 text-info' },
        { label: 'Racha activa', value: (this.motivation()?.current_streak ?? this.currentAccount()?.current_streak ?? 0).toString(), caption: 'Días consecutivos', className: 'bg-primary-low text-primary' },
        { label: 'Alertas activas', value: this.alerts().filter((alert) => alert.status === 'activa').length.toString(), caption: 'Seguimiento clínico', className: this.criticalCount() ? 'bg-danger-bg text-danger' : 'bg-line text-secondary' },
      ];
    }

    return [
      { label: 'Pacientes', value: patients.length.toString(), caption: 'Cuentas visibles', className: 'bg-primary-low text-primary' },
      { label: 'Activos', value: patients.filter((patient) => patient.estado !== 'inactivo').length.toString(), caption: 'Estado activo', className: 'bg-primary-low text-primary' },
      { label: 'Inactividad', value: this.inactiveCount().toString(), caption: 'Alertas activas', className: this.inactiveCount() ? 'bg-warning/10 text-warning' : 'bg-line text-secondary' },
      { label: 'Críticas', value: this.criticalCount().toString(), caption: 'Dolor o deterioro', className: this.criticalCount() ? 'bg-danger-bg text-danger' : 'bg-info/10 text-info' },
    ];
  });

  ngOnInit(): void {
    this.clinicalDataService.dashboardData().subscribe({
      next: (data) => {
        this.dashboardData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar la información real del usuario.');
        this.loading.set(false);
      },
    });

    this.engagementService.getAlerts().subscribe({
      next: (alerts) => this.alerts.set(alerts),
      error: () => this.alerts.set([]),
    });

    if (this.role() === 'paciente') {
      this.engagementService.getMotivation().subscribe({
        next: (motivation) => this.motivation.set(motivation),
        error: () => this.motivation.set(null),
      });
    }
  }

  displayName(account: RoleAccount | null): string {
    return this.clinicalDataService.displayName(account);
  }

  statusClass(account: RoleAccount | null): string {
    return account?.estado === 'inactivo' ? 'bg-danger-bg text-danger' : 'bg-primary-low text-primary';
  }
}
