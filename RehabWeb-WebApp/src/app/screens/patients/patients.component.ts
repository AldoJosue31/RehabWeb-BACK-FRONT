import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RoleAccount } from '../../services/account-admin.service';
import { ClinicalDataService } from '../../services/clinical-data.service';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rw-page">
      <header class="rw-page-header">
        <div>
          <h1 class="rw-title">Directorio de Pacientes</h1>
          <p class="rw-subtitle">Pacientes reales asociados al terapeuta autenticado.</p>
        </div>
      </header>

      @if (loading()) {
        <div class="rw-card rw-card-pad text-sm text-secondary">Cargando pacientes reales...</div>
      } @else if (errorMsg()) {
        <div class="rounded-lg border border-danger bg-danger-bg p-4 text-sm font-bold text-danger">{{ errorMsg() }}</div>
      } @else {
        <div class="rw-card rw-toolbar">
          <label class="rw-field text-sm">
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            <input class="w-full bg-transparent outline-none placeholder:text-muted" placeholder="Buscar en pacientes cargados..." (input)="updateSearch($any($event.target).value)" />
          </label>
          <span class="rw-action">{{ filteredPatients().length }} registros</span>
        </div>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (patient of filteredPatients(); track patient.id) {
            <article class="rw-card p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div class="mb-4 h-1 rounded-full" [ngClass]="statusBarClass(patient)"></div>
              <div class="mb-5 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="m-0 truncate text-base font-bold leading-solid text-main">{{ displayName(patient) }}</h2>
                  <p class="mt-1 text-xs text-secondary">ID {{ patient.id }} · {{ patient.username }}</p>
                </div>
                <span class="rounded-md px-3 py-1 text-xs font-bold" [ngClass]="statusClass(patient)">{{ patient.estado || 'activo' }}</span>
              </div>

              <dl class="grid gap-3 border-t border-line pt-4">
                <div>
                  <dt class="text-xs font-bold uppercase tracking-wide text-muted">Diagnóstico principal</dt>
                  <dd class="mt-1 text-sm font-bold text-main">{{ patient.diagnostico_principal || 'Sin diagnóstico registrado' }}</dd>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wide text-muted">Movilidad</dt>
                    <dd class="mt-1 text-sm text-main">{{ patient.nivel_movilidad || 'Sin dato' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wide text-muted">Nacimiento</dt>
                    <dd class="mt-1 text-sm text-main">{{ patient.fecha_nacimiento || 'Sin dato' }}</dd>
                  </div>
                </div>
              </dl>
            </article>
          } @empty {
            <p class="rounded-lg border border-line bg-surface p-6 text-sm text-secondary shadow-sm">No hay pacientes reales para mostrar con el filtro actual.</p>
          }
        </div>
      }
    </section>
  `,
})
export class PatientsComponent implements OnInit {
  private clinicalDataService = inject(ClinicalDataService);

  loading = signal(true);
  errorMsg = signal('');
  patients = signal<RoleAccount[]>([]);
  search = signal('');
  filteredPatients = signal<RoleAccount[]>([]);

  ngOnInit(): void {
    this.clinicalDataService.visiblePatients().subscribe({
      next: (patients) => {
        this.patients.set(patients);
        this.filteredPatients.set(patients);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudieron cargar los pacientes reales.');
        this.loading.set(false);
      },
    });

  }

  updateSearch(value: string): void {
    this.search.set(value);
    const normalized = value.trim().toLowerCase();
    this.filteredPatients.set(
      this.patients().filter((patient) =>
        [
          patient.username,
          patient.nombre_completo,
          patient.email,
          patient.diagnostico_principal,
          patient.estado,
          patient.nivel_movilidad,
        ].some((field) => (field || '').toLowerCase().includes(normalized)),
      ),
    );
  }

  displayName(account: RoleAccount): string {
    return this.clinicalDataService.displayName(account);
  }

  statusClass(account: RoleAccount): string {
    return account.estado === 'inactivo' ? 'bg-danger-bg text-danger' : 'bg-primary-low text-primary';
  }

  statusBarClass(account: RoleAccount): string {
    return account.estado === 'inactivo' ? 'bg-danger' : 'bg-primary';
  }
}
