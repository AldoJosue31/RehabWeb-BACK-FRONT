import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { EngagementService, RehabAlert } from '../../services/engagement.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rw-page">
      <header class="rw-page-header">
        <div>
          <h1 class="rw-title">Alertas clínicas</h1>
          <p class="rw-subtitle">Inactividad, dolor alto y deterioro persisten hasta revisarse o resolverse.</p>
        </div>
        <button class="rw-action rw-action--primary" type="button" (click)="runDetection()" [disabled]="loading() || actionLoading() !== null">
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

        @if (errorMsg()) {
          <div class="rounded-lg border border-danger bg-danger-bg p-4 text-sm font-bold text-danger">{{ errorMsg() }}</div>
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
                  <span class="rounded-md bg-line px-3 py-1 text-xs font-bold text-secondary">{{ statusLabel(alert.status) }}</span>
                </div>
                <h2 class="m-0 text-base font-bold leading-solid text-main">{{ cleanText(alert.title) }}</h2>
                <p class="mt-1 text-sm text-secondary">{{ cleanText(alert.paciente_nombre) }} · {{ cleanText(alert.message) }}</p>
                <p class="mt-2 text-xs text-muted">{{ alert.detected_at | date:'medium' }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="rw-action" type="button" (click)="markReviewed(alert)" [disabled]="alert.status !== 'activa' || actionLoading() !== null">
                  {{ isReviewing(alert) ? 'Guardando...' : 'Revisada' }}
                </button>
                <button class="rw-action rw-action--primary" type="button" (click)="resolve(alert)" [disabled]="alert.status === 'resuelta' || actionLoading() !== null">
                  {{ isResolving(alert) ? 'Guardando...' : 'Resuelta' }}
                </button>
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
  actionLoading = signal<string | null>(null);
  notice = signal('');
  errorMsg = signal('');
  alerts = signal<RehabAlert[]>([]);
  activeAlerts = computed(() => this.alerts().filter((alert) => alert.status === 'activa'));
  painAlerts = computed(() => this.activeAlerts().filter((alert) => alert.alert_type === 'PAIN_OR_DETERIORATION'));
  inactivityAlerts = computed(() => this.activeAlerts().filter((alert) => alert.alert_type === 'INACTIVITY_WARNING'));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMsg.set('');
    this.engagementService.getAlerts().subscribe({
      next: (alerts) => {
        this.alerts.set(alerts);
        this.loading.set(false);
      },
      error: () => {
        this.alerts.set([]);
        this.errorMsg.set('No se pudieron cargar las alertas clínicas.');
        this.loading.set(false);
      },
    });
  }

  runDetection(): void {
    this.loading.set(true);
    this.notice.set('');
    this.errorMsg.set('');
    this.engagementService.runInactivityDetection().subscribe({
      next: (result) => {
        this.notice.set(`Detección completada. Alertas nuevas: ${result.generadas}.`);
        this.load();
      },
      error: () => {
        this.errorMsg.set('No se pudo ejecutar la detección de inactividad.');
        this.loading.set(false);
      },
    });
  }

  markReviewed(alert: RehabAlert): void {
    if (alert.status !== 'activa' || this.actionLoading()) return;

    this.errorMsg.set('');
    this.actionLoading.set(`${alert.id}:review`);
    this.engagementService.markAlertReviewed(alert.id)
      .pipe(finalize(() => this.actionLoading.set(null)))
      .subscribe({
        next: (updated) => this.replace(updated),
        error: () => this.errorMsg.set('No se pudo marcar la alerta como revisada.'),
      });
  }

  resolve(alert: RehabAlert): void {
    if (alert.status === 'resuelta' || this.actionLoading()) return;

    this.errorMsg.set('');
    this.actionLoading.set(`${alert.id}:resolve`);
    this.engagementService.resolveAlert(alert.id)
      .pipe(finalize(() => this.actionLoading.set(null)))
      .subscribe({
        next: (updated) => this.replace(updated),
        error: () => this.errorMsg.set('No se pudo marcar la alerta como resuelta.'),
      });
  }

  isReviewing(alert: RehabAlert): boolean {
    return this.actionLoading() === `${alert.id}:review`;
  }

  isResolving(alert: RehabAlert): boolean {
    return this.actionLoading() === `${alert.id}:resolve`;
  }

  statusLabel(status: RehabAlert['status']): string {
    const labels: Record<RehabAlert['status'], string> = {
      activa: 'Activa',
      revisada: 'Revisada',
      resuelta: 'Resuelta',
    };
    return labels[status] ?? status;
  }

  cleanText(value: string | null | undefined): string {
    if (!value) return '';

    const replacements: Array<[string, string]> = [
      ['\u00c3\u00a1', 'á'],
      ['\u00c3\u00a9', 'é'],
      ['\u00c3\u00ad', 'í'],
      ['\u00c3\u00b3', 'ó'],
      ['\u00c3\u00ba', 'ú'],
      ['\u00c3\u00b1', 'ñ'],
      ['\u00c3\u0081', 'Á'],
      ['\u00c3\u0089', 'É'],
      ['\u00c3\u008d', 'Í'],
      ['\u00c3\u0093', 'Ó'],
      ['\u00c3\u009a', 'Ú'],
      ['\u00c3\u0091', 'Ñ'],
      ['\u00c3\u0192\u00c2\u00a1', 'á'],
      ['\u00c3\u0192\u00c2\u00a9', 'é'],
      ['\u00c3\u0192\u00c2\u00ad', 'í'],
      ['\u00c3\u0192\u00c2\u00b3', 'ó'],
      ['\u00c3\u0192\u00c2\u00ba', 'ú'],
      ['\u00c3\u0192\u00c2\u00b1', 'ñ'],
      ['\u00c3\u0192\u00c2\u0081', 'Á'],
      ['\u00c3\u0192\u00c2\u0089', 'É'],
      ['\u00c3\u0192\u00c2\u008d', 'Í'],
      ['\u00c3\u0192\u00c2\u0093', 'Ó'],
      ['\u00c3\u0192\u00c2\u009a', 'Ú'],
      ['\u00c3\u0192\u00c2\u0091', 'Ñ'],
      ['\u00c2\u00b7', '·'],
    ];

    return replacements.reduce((text, [bad, good]) => text.replaceAll(bad, good), value);
  }

  private replace(updated: RehabAlert): void {
    this.alerts.update((alerts) => alerts.map((alert) => alert.id === updated.id ? updated : alert));
  }
}
