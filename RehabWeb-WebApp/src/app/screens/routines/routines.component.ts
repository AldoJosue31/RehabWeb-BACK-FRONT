import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RoleAccount } from '../../services/account-admin.service';
import { ClinicalDataService } from '../../services/clinical-data.service';
import {
  Exercise,
  Routine,
  RoutineRiskError,
  RoutineService,
} from '../../services/routine.service';

interface SelectedExercise {
  exercise: Exercise;
  order: number;
  sets: number;
  repetitions: number;
  rest_seconds: number;
  duration_seconds: number;
  notes: string;
}

@Component({
  selector: 'app-routines',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="rw-page">
      <header class="rw-page-header">
        <div>
          <h1 class="rw-title">Nueva rutina</h1>
          <p class="rw-subtitle">Selecciona paciente, ejercicios compatibles, parametros y programacion.</p>
        </div>
        @if (createdRoutine(); as routine) {
          <span class="rounded-md bg-primary-low px-4 py-2 text-sm font-bold text-primary">
            Asignacion creada: v{{ routine.version }}
          </span>
        }
      </header>

      @if (loading()) {
        <div class="rw-card rw-card-pad text-sm text-secondary">Cargando pacientes y biblioteca...</div>
      } @else {
        @if (successMsg()) {
          <article class="rounded-lg border border-primary bg-primary-low p-4 text-sm font-bold text-primary">
            {{ successMsg() }}
          </article>
        }

        @if (errorMsg()) {
          <article class="rounded-lg border border-danger bg-danger-bg p-4 text-sm font-bold text-danger">
            {{ errorMsg() }}
          </article>
        }

        @if (warnings().length) {
          <article class="rounded-lg border border-warning bg-warning/10 p-4">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 class="m-0 text-base font-bold text-main">Advertencias de seguridad</h2>
                <ul class="m-0 mt-3 grid gap-2 pl-5 text-sm text-secondary">
                  @for (warning of warnings(); track warning) {
                    <li>{{ warning }}</li>
                  }
                </ul>
              </div>
              <button class="rw-action" type="button" (click)="submit(true)" [disabled]="saving()">
                Confirmar de todos modos
              </button>
            </div>
          </article>
        }

        <div class="grid gap-5 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
          <aside class="grid content-start gap-5">
            <article class="rw-card rw-card-pad">
              <h2 class="m-0 text-lg font-bold text-main">Paciente</h2>
              <form class="mt-4 grid gap-4" [formGroup]="routineForm">
                <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Seleccion
                  <select class="rw-input normal-case tracking-normal" formControlName="paciente" (change)="loadExercises()">
                    @for (patient of patients(); track patient.id) {
                      <option [value]="patient.id">{{ displayName(patient) }}</option>
                    }
                  </select>
                </label>

                @if (selectedPatient(); as patient) {
                  <div class="rounded-md bg-app p-4">
                    <p class="m-0 text-sm font-bold text-main">{{ patient.diagnostico_principal || 'Sin diagnostico registrado' }}</p>
                    <p class="m-0 mt-1 text-xs text-secondary">Movilidad: {{ patient.nivel_movilidad || 'sin dato' }}</p>
                    <p class="m-0 mt-1 text-xs" [ngClass]="patient.evaluacion_inicial_registrada ? 'text-primary' : 'text-danger'">
                      Evaluacion inicial: {{ patient.evaluacion_inicial_registrada ? 'registrada' : 'pendiente' }}
                    </p>
                  </div>
                }

                <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Nombre de rutina
                  <input class="rw-input normal-case tracking-normal" formControlName="name" maxlength="160" />
                </label>

                <label class="flex items-center gap-3 rounded-md bg-app p-3 text-sm font-bold text-main">
                  <input type="checkbox" formControlName="save_as_template" />
                  Guardar como plantilla
                </label>

                @if (routineForm.controls.save_as_template.value) {
                  <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                    Nombre de plantilla
                    <input class="rw-input normal-case tracking-normal" formControlName="template_name" maxlength="160" />
                  </label>
                }
              </form>
            </article>

            <article class="rw-card rw-card-pad">
              <h2 class="m-0 text-lg font-bold text-main">Programacion</h2>
              <form class="mt-4 grid gap-4" [formGroup]="assignmentForm">
                <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Frecuencia
                  <select class="rw-input normal-case tracking-normal" formControlName="frequency">
                    <option value="diaria">Diaria</option>
                    <option value="3_semana">3 veces por semana</option>
                    <option value="2_semana">2 veces por semana</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </label>

                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                    Inicio
                    <input class="rw-input normal-case tracking-normal" type="date" formControlName="start_date" />
                  </label>
                  <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                    Semanas
                    <input class="rw-input normal-case tracking-normal" type="number" min="1" max="52" formControlName="total_weeks" />
                  </label>
                </div>

                <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Horarios preferidos
                  <input class="rw-input normal-case tracking-normal" formControlName="preferred_times" placeholder="08:00, 18:00" />
                </label>

                <label class="grid gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
                  Notas para paciente
                  <textarea class="rw-input min-h-28 normal-case tracking-normal" formControlName="special_instructions"></textarea>
                </label>
              </form>
            </article>
          </aside>

          <div class="grid gap-5">
            <article class="rw-card rw-card-pad">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="m-0 text-lg font-bold text-main">Biblioteca compatible</h2>
                  <p class="m-0 text-sm text-secondary">{{ exercises().length }} ejercicios filtrados por perfil clinico.</p>
                </div>
                <span class="rounded-md bg-app px-3 py-2 text-xs font-bold text-secondary">Duracion estimada {{ estimatedMinutes() }} min</span>
              </div>

              <div class="mt-4 grid gap-3 md:grid-cols-2">
                @for (exercise of exercises(); track exercise.id) {
                  <button
                    class="rounded-md border border-line bg-app p-4 text-left hover:border-primary hover:bg-primary-low"
                    type="button"
                    (click)="addExercise(exercise)"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <strong class="text-sm text-main">{{ exercise.name }}</strong>
                      <span class="rounded-md bg-surface px-2 py-1 text-xs font-bold text-primary">{{ exercise.category }}</span>
                    </div>
                    <p class="m-0 mt-2 text-xs text-secondary">{{ exercise.description }}</p>
                    <p class="m-0 mt-2 text-xs text-muted">
                      {{ exercise.default_sets }} series · {{ exercise.default_repetitions }} reps · descanso {{ exercise.default_rest_seconds }}s
                    </p>
                  </button>
                } @empty {
                  <p class="rounded-md bg-app p-4 text-sm text-secondary">No hay ejercicios compatibles para el perfil seleccionado.</p>
                }
              </div>
            </article>

            <article class="rw-card rw-card-pad">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="m-0 text-lg font-bold text-main">Rutina seleccionada</h2>
                  <p class="m-0 text-sm text-secondary">{{ selectedExercises().length }} ejercicios listos para validar.</p>
                </div>
                <button class="rw-action rw-action--primary" type="button" (click)="submit(false)" [disabled]="saving() || !canSubmit()">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  Crear y asignar
                </button>
              </div>

              <div class="mt-4 grid gap-3">
                @for (item of selectedExercises(); track item.exercise.id) {
                  <div class="rounded-md border border-line bg-app p-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong class="text-sm text-main">{{ item.order }}. {{ item.exercise.name }}</strong>
                        <p class="m-0 mt-1 text-xs text-secondary">{{ item.exercise.category }}</p>
                      </div>
                      <button class="rounded-md border border-line bg-surface px-3 py-2 text-xs font-bold text-danger" type="button" (click)="removeExercise(item.exercise.id)">
                        Quitar
                      </button>
                    </div>

                    <div class="mt-4 grid gap-3 sm:grid-cols-4">
                      <label class="grid gap-1 text-xs font-bold uppercase tracking-wide text-secondary">
                        Series
                        <input class="rw-input normal-case tracking-normal" type="number" min="1" [value]="item.sets" (input)="updateItem(item.exercise.id, 'sets', $any($event.target).value)" />
                      </label>
                      <label class="grid gap-1 text-xs font-bold uppercase tracking-wide text-secondary">
                        Reps
                        <input class="rw-input normal-case tracking-normal" type="number" min="0" [value]="item.repetitions" (input)="updateItem(item.exercise.id, 'repetitions', $any($event.target).value)" />
                      </label>
                      <label class="grid gap-1 text-xs font-bold uppercase tracking-wide text-secondary">
                        Descanso
                        <input class="rw-input normal-case tracking-normal" type="number" min="0" [value]="item.rest_seconds" (input)="updateItem(item.exercise.id, 'rest_seconds', $any($event.target).value)" />
                      </label>
                      <label class="grid gap-1 text-xs font-bold uppercase tracking-wide text-secondary">
                        Duracion
                        <input class="rw-input normal-case tracking-normal" type="number" min="0" [value]="item.duration_seconds" (input)="updateItem(item.exercise.id, 'duration_seconds', $any($event.target).value)" />
                      </label>
                    </div>
                  </div>
                } @empty {
                  <p class="rounded-md bg-app p-4 text-sm text-secondary">Selecciona ejercicios de la biblioteca para crear la rutina.</p>
                }
              </div>
            </article>
          </div>
        </div>
      }
    </section>
  `,
})
export class RoutinesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clinicalDataService = inject(ClinicalDataService);
  private routineService = inject(RoutineService);

  loading = signal(true);
  saving = signal(false);
  patients = signal<RoleAccount[]>([]);
  exercises = signal<Exercise[]>([]);
  selectedExercises = signal<SelectedExercise[]>([]);
  warnings = signal<string[]>([]);
  errorMsg = signal('');
  successMsg = signal('');
  createdRoutine = signal<Routine | null>(null);

  routineForm = this.fb.nonNullable.group({
    paciente: [0, [Validators.required, Validators.min(1)]],
    name: ['Rutina de rehabilitacion', [Validators.required, Validators.maxLength(160)]],
    save_as_template: [false],
    template_name: [''],
  });

  assignmentForm = this.fb.nonNullable.group({
    frequency: ['diaria', [Validators.required]],
    preferred_times: ['08:00'],
    start_date: [this.todayIso(), [Validators.required]],
    total_weeks: [12, [Validators.required, Validators.min(1), Validators.max(52)]],
    special_instructions: [''],
  });

  selectedPatient = computed(() => {
    const id = Number(this.routineForm.controls.paciente.value);
    return this.patients().find((patient) => patient.id === id) ?? null;
  });

  estimatedMinutes = computed(() => {
    const seconds = this.selectedExercises().reduce((total, item) => {
      return total + item.sets * item.duration_seconds + Math.max(item.sets - 1, 0) * item.rest_seconds;
    }, 0);
    return Math.max(1, Math.round(seconds / 60));
  });

  canSubmit = computed(() => this.routineForm.valid && this.assignmentForm.valid && this.selectedExercises().length > 0);

  ngOnInit(): void {
    this.clinicalDataService.visiblePatients().subscribe({
      next: (patients) => {
        this.patients.set(patients);
        if (patients[0]) this.routineForm.patchValue({ paciente: patients[0].id });
        this.loading.set(false);
        this.loadExercises();
      },
      error: () => {
        this.errorMsg.set('No se pudieron cargar los pacientes.');
        this.loading.set(false);
      },
    });
  }

  loadExercises(): void {
    const patientId = Number(this.routineForm.controls.paciente.value);
    if (!patientId) {
      this.exercises.set([]);
      return;
    }

    this.selectedExercises.set([]);
    this.routineService.getExercises(patientId).subscribe({
      next: (exercises) => this.exercises.set(exercises),
      error: () => this.exercises.set([]),
    });
  }

  addExercise(exercise: Exercise): void {
    if (this.selectedExercises().some((item) => item.exercise.id === exercise.id)) return;

    this.selectedExercises.update((items) => [
      ...items,
      {
        exercise,
        order: items.length + 1,
        sets: exercise.default_sets,
        repetitions: exercise.default_repetitions,
        rest_seconds: exercise.default_rest_seconds,
        duration_seconds: exercise.default_duration_seconds,
        notes: '',
      },
    ]);
  }

  removeExercise(exerciseId: string): void {
    this.selectedExercises.update((items) =>
      items
        .filter((item) => item.exercise.id !== exerciseId)
        .map((item, index) => ({ ...item, order: index + 1 })),
    );
  }

  updateItem(exerciseId: string, key: 'sets' | 'repetitions' | 'rest_seconds' | 'duration_seconds', value: string): void {
    const numericValue = Math.max(0, Number.parseInt(value, 10) || 0);
    this.selectedExercises.update((items) =>
      items.map((item) => (item.exercise.id === exerciseId ? { ...item, [key]: numericValue } : item)),
    );
  }

  submit(confirmRisks: boolean): void {
    if (!this.canSubmit()) return;

    this.saving.set(true);
    this.errorMsg.set('');
    if (!confirmRisks) this.warnings.set([]);

    const routinePayload = {
      paciente: Number(this.routineForm.controls.paciente.value),
      name: this.routineForm.controls.name.value,
      override_warnings: confirmRisks,
      save_as_template: this.routineForm.controls.save_as_template.value,
      template_name: this.routineForm.controls.template_name.value,
      items: this.selectedExercises().map((item) => ({
        exercise_id: item.exercise.id,
        order: item.order,
        sets: item.sets,
        repetitions: item.repetitions,
        rest_seconds: item.rest_seconds,
        duration_seconds: item.duration_seconds,
        notes: item.notes,
      })),
    };

    this.routineService.createRoutine(routinePayload).subscribe({
      next: (routine) => this.createAssignment(routine),
      error: (error: RoutineRiskError | unknown) => {
        this.saving.set(false);
        if ((error as RoutineRiskError).requires_confirmation) {
          this.warnings.set((error as RoutineRiskError).warnings);
          return;
        }
        this.errorMsg.set('No se pudo crear la rutina. Revisa perfil clinico, evaluacion inicial y ejercicios.');
      },
    });
  }

  createAssignment(routine: Routine): void {
    const assignmentPayload = {
      routine_id: routine.id,
      frequency: this.assignmentForm.controls.frequency.value,
      preferred_times: this.assignmentForm.controls.preferred_times.value,
      start_date: this.assignmentForm.controls.start_date.value,
      total_weeks: this.assignmentForm.controls.total_weeks.value,
      special_instructions: this.assignmentForm.controls.special_instructions.value,
    };

    this.routineService.createAssignment(assignmentPayload).subscribe({
      next: () => {
        this.createdRoutine.set(routine);
        this.successMsg.set('Rutina validada, guardada como version 1.0, asignada y notificada al paciente.');
        this.warnings.set([]);
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('La rutina se creo, pero no se pudo completar la asignacion.');
      },
    });
  }

  displayName(account: RoleAccount): string {
    return this.clinicalDataService.displayName(account);
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
