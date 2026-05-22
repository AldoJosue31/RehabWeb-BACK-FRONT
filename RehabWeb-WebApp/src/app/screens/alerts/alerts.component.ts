import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { EngagementService, RehabAlert } from '../../services/engagement.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rw-page">
      <header class="rw-page-header">
        <div>
          <h1 class="rw-title">Alertas clÃ­nicas</h1>
          <p class="rw-subtitle">Inactividad, dolor alto y deterioro persisten hasta revisarse o resolverse.</p>
        </div>
        <button class="rw-action rw-action--primary" type="button" (click)="runDetection()" [disabled]="loading()">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6v6l4 2M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          Detectar inactividad
        </button>
      </header>

      @if (loading()) {
        <div class="rw-card rw-card-pad text-sm text-secondary">Cargando alertas reales...</div>
      } @else {
        @if (notice()) {
          <div class="rounded-lg border border-info bg-info/10 p-4 text-sm font-bold text-info">{{ notice() }}</div>
        }

        <div class="grid gap-4 md:grid-cols-3">
          <article class="rw-card rw-card-pad">
            <p class="m-0 text-sm font-medium text-secondary">Activas</p>
            <p class="mt-2 text-2xl font-bold leading-solid text-danger">{{ activeAlerts().length }}</p>
          </article>
          <article class="rw-card rw-card-pad">
            <p class="m-0 text-sm font-medium text-secondary">Dolor/deterioro</p>
            <p class="mt-2 text-2xl font-bold leading-solid text-danger">{{ painAlerts().length }}</p>
          </article>
          <article class="rw-card rw-card-pad">
            <p class="m-0 text-sm font-medium text-secondary">Inactividad</p>
            <p class="mt-2 text-2xl font-bold leading-solid text-warning">{{ inactivityAlerts().length }}</p>
          </article>
        </div>

        <div class="grid gap-4">
          @for (alert of alerts(); track alert.id) {
            <article class="rw-card grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center" [ngClass]="alert.severity === 'critical' ? 'border-danger' : 'border-warning/60'">
              <div>
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="rounded-md px-3 py-1 text-xs font-bold" [ngClass]="alert.severity === 'critical' ? 'bg-danger-bg text-danger' : 'bg-warning/10 text-warning'">
                    {{ alert.alert_type === 'PAIN_OR_DETERIORATION' ? 'Dolor o deterioro' : 'Inactividad' }}
                  </span>
                  <span class="rounded-md bg-line px-3 py-1 text-xs font-bold text-secondary">{{ alert.status }}</span>
                </div>
                <h2 class="m-0 text-base font-bold leading-solid text-main">{{ alert.title }}</h2>
                <p class="mt-1 text-sm text-secondary">{{ alert.paciente_nombre }} Â· {{ alert.message }}</p>
                <p class="mt-2 text-xs text-muted">{{ alert.detected_at | date:'medium' }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="rw-action" type="button" (click)="markReviewed(alert)" [disabled]="alert.status !== 'activa'">Revisada</button>
                <button class="rw-action rw-action--primary" type="button" (click)="resolve(alert)" [disabled]="alert.status === 'resuelta'">Resuelta</button>
              </div>
            </article>
          } @empty {
            <p class="rounded-lg border border-line bg-surface p-6 text-sm text-secondary shadow-sm">No hay alertas reales pendientes.</p>
          }
        </div>
      }
    </section>
  `,
})
export class AlertsComponent implements OnInit {
  private engagementService = inject(EngagementService);

  loading = signal(true);
  notice = signal('');
  alerts = signal<RehabAlert[]>([]);
  activeAlerts = computed(() => this.alerts().filter((alert) => alert.status === 'activa'));
  painAlerts = computed(() => this.activeAlerts().filter((alert) => alert.alert_type === 'PAIN_OR_DETERIORATION'));
  inactivityAlerts = computed(() => this.activeAlerts().filter((alert) => alert.alert_type === 'INACTIVITY_WARNING'));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.engagementService.getAlerts().subscribe((alerts) => {
      this.alerts.set(alerts);
      this.loading.set(false);
    });
  }

  runDetection(): void {
    this.loading.set(true);
    this.engagementService.runInactivityDetection().subscribe({
      next: (result) => {
        this.notice.set(`Deteccion completada. Alertas nuevas: ${result.generadas}.`);
        this.load();
      },
      error: () => {
        this.notice.set('No se pudo ejecutar la deteccion de inactividad.');
        this.loading.set(false);
      },
    });
  }

  markReviewed(alert: RehabAlert): void {
    this.engagementService.markAlertReviewed(alert.id).subscribe((updated) => this.replace(updated));
  }

  resolve(alert: RehabAlert): void {
    this.engagementService.resolveAlert(alert.id).subscribe((updated) => this.replace(updated));
  }

  private replace(updated: RehabAlert): void {
    this.alerts.update((alerts) => alerts.map((alert) => alert.id === updated.id ? updated : alert));
  }
}
