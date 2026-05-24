import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountAdminRole, AccountAdminService, RoleAccount } from '../../services/account-admin.service';
import { AuthRole, AuthService } from '../../services/auth.service';

type ExampleAccount = Omit<Partial<RoleAccount>, 'id' | 'role' | 'username' | 'password'>;

const EXAMPLE_ACCOUNTS: Record<AccountAdminRole, ExampleAccount[]> = {
  terapeutas: [
    {
      nombre_completo: 'Dra. Valeria Mendoza',
      email: 'valeria.mendoza@rehabweb.test',
      especialidad: 'Fisioterapia neurologica',
      numero_licencia: 'TER-1042',
    },
    {
      nombre_completo: 'Dr. Mateo Herrera',
      email: 'mateo.herrera@rehabweb.test',
      especialidad: 'Rehabilitacion deportiva',
      numero_licencia: 'TER-1187',
    },
    {
      nombre_completo: 'Dra. Camila Torres',
      email: 'camila.torres@rehabweb.test',
      especialidad: 'Terapia ocupacional',
      numero_licencia: 'TER-1264',
    },
    {
      nombre_completo: 'Dr. Andres Salazar',
      email: 'andres.salazar@rehabweb.test',
      especialidad: 'Fisioterapia respiratoria',
      numero_licencia: 'TER-1398',
    },
    {
      nombre_completo: 'Dra. Sofia Rivas',
      email: 'sofia.rivas@rehabweb.test',
      especialidad: 'Rehabilitacion ortopedica',
      numero_licencia: 'TER-1475',
    },
    {
      nombre_completo: 'Dr. Diego Navarro',
      email: 'diego.navarro@rehabweb.test',
      especialidad: 'Medicina fisica y rehabilitacion',
      numero_licencia: 'TER-1531',
    },
  ],
  pacientes: [
    {
      nombre_completo: 'Lucia Fernandez',
      email: 'lucia.fernandez@rehabweb.test',
      fecha_nacimiento: '1992-04-18',
      estado: 'activo',
      estrategia_validacion: 'Dolor menor a 4/10 despues de la rutina',
      estrategia_progreso: 'Aumentar repeticiones cada 2 semanas',
      diagnostico_principal: 'Lesion de rodilla en rehabilitacion',
      historial_medico: 'Esguince previo y dolor ocasional al subir escaleras.',
      nivel_movilidad: 'medio',
      restricciones: 'Evitar saltos y sentadillas profundas',
    },
    {
      nombre_completo: 'Carlos Jimenez',
      email: 'carlos.jimenez@rehabweb.test',
      fecha_nacimiento: '1985-09-07',
      estado: 'activo',
      estrategia_validacion: 'Registrar fatiga y rango de movimiento',
      estrategia_progreso: 'Incrementar resistencia con bandas elasticas',
      diagnostico_principal: 'Recuperacion postoperatoria de hombro',
      historial_medico: 'Cirugia artroscopica reciente sin complicaciones.',
      nivel_movilidad: 'bajo',
      restricciones: 'No cargar peso sobre el brazo derecho',
    },
    {
      nombre_completo: 'Mariana Lopez',
      email: 'mariana.lopez@rehabweb.test',
      fecha_nacimiento: '1978-12-22',
      estado: 'activo',
      estrategia_validacion: 'Confirmar estabilidad durante marcha asistida',
      estrategia_progreso: 'Reducir apoyo externo de forma gradual',
      diagnostico_principal: 'Secuela de evento vascular cerebral',
      historial_medico: 'Debilidad en hemicuerpo izquierdo y terapia previa.',
      nivel_movilidad: 'dependiente',
      restricciones: 'Supervision en ejercicios de equilibrio',
    },
    {
      nombre_completo: 'Roberto Castro',
      email: 'roberto.castro@rehabweb.test',
      fecha_nacimiento: '1969-06-03',
      estado: 'activo',
      estrategia_validacion: 'Monitorear dolor lumbar antes y despues',
      estrategia_progreso: 'Agregar movilidad toracica si no hay dolor',
      diagnostico_principal: 'Lumbalgia mecanica cronica',
      historial_medico: 'Trabajo sedentario y episodios recurrentes de dolor.',
      nivel_movilidad: 'medio',
      restricciones: 'Evitar flexion lumbar sostenida',
    },
    {
      nombre_completo: 'Ana Paula Ortega',
      email: 'ana.ortega@rehabweb.test',
      fecha_nacimiento: '2001-01-29',
      estado: 'activo',
      estrategia_validacion: 'Controlar inflamacion despues de actividad',
      estrategia_progreso: 'Pasar de movilidad activa a fortalecimiento',
      diagnostico_principal: 'Tendinopatia de tobillo',
      historial_medico: 'Dolor tras entrenamiento de carrera.',
      nivel_movilidad: 'alto',
      restricciones: 'Evitar carrera continua por ahora',
    },
    {
      nombre_completo: 'Miguel Alvarez',
      email: 'miguel.alvarez@rehabweb.test',
      fecha_nacimiento: '1957-11-14',
      estado: 'activo',
      estrategia_validacion: 'Revisar tolerancia cardiopulmonar',
      estrategia_progreso: 'Aumentar duracion de caminata controlada',
      diagnostico_principal: 'Desacondicionamiento fisico',
      historial_medico: 'Hipertension controlada con seguimiento medico.',
      nivel_movilidad: 'bajo',
      restricciones: 'Pausas frecuentes y evitar sobreesfuerzo',
    },
  ],
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private accountAdminService = inject(AccountAdminService);
  private router = inject(Router);

  role = signal<AuthRole>('terapeuta');
  loading = signal(false);
  errorMsg = signal('');
  accountModalOpen = signal(false);
  accountRole = signal<AccountAdminRole>('terapeutas');
  accounts = signal<RoleAccount[]>([]);
  therapistOptions = signal<RoleAccount[]>([]);
  knownUsernames = signal<string[]>([]);
  editingAccountId = signal<number | null>(null);
  accountLoading = signal(false);
  accountError = signal('');
  accountSuccess = signal('');

  loginForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  accountForm = this.fb.nonNullable.group({
    username: '',
    password: '',
    email: '',
    nombre_completo: '',
    especialidad: 'Fisioterapia',
    numero_licencia: '',
    terapeuta_id: '',
    fecha_nacimiento: '',
    estado: 'activo',
    estrategia_validacion: 'Libre',
    estrategia_progreso: 'Por rutinas',
    diagnostico_principal: '',
    historial_medico: '',
    nivel_movilidad: 'medio',
    restricciones: '',
  });

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      void this.router.navigateByUrl('/tablero-control');
    }
  }

  setRole(role: AuthRole): void {
    this.role.set(role);
    this.errorMsg.set('');
  }

  toggleRole(): void {
    this.setRole(this.role() === 'terapeuta' ? 'paciente' : 'terapeuta');
  }

  submit(): void {
    if (this.loginForm.invalid || this.loading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { username, password } = this.loginForm.getRawValue();
    this.loading.set(true);
    this.errorMsg.set('');

    this.authService.login(username.trim(), password, this.role()).subscribe({
      next: () => void this.router.navigateByUrl('/tablero-control'),
      error: (error: { status?: number; error?: { detail?: string } }) => {
        this.loading.set(false);
        if (error.status === 403) {
          this.errorMsg.set(error.error?.detail ?? 'Este usuario no tiene el rol seleccionado.');
          return;
        }
        this.errorMsg.set('Usuario o contrasena incorrectos.');
      },
    });
  }

  openAccounts(role: AccountAdminRole = 'terapeutas', createMode = false): void {
    this.accountModalOpen.set(true);
    this.setAccountRole(role);
    if (createMode) {
      this.resetAccountForm();
    }
  }

  closeAccounts(): void {
    this.accountModalOpen.set(false);
    this.accountError.set('');
    this.accountSuccess.set('');
  }

  setAccountRole(role: AccountAdminRole): void {
    this.accountRole.set(role);
    this.accountError.set('');
    this.accountSuccess.set('');
    this.resetAccountForm();
    this.loadAccounts();
    this.loadKnownUsernames();
    if (role === 'pacientes') {
      this.loadTherapists();
    }
  }

  editAccount(account: RoleAccount): void {
    this.editingAccountId.set(account.id);
    this.accountError.set('');
    this.accountSuccess.set('');
    this.accountForm.patchValue({
      username: account.username ?? '',
      password: '',
      email: account.email ?? '',
      nombre_completo: account.nombre_completo ?? '',
      especialidad: account.especialidad ?? 'Fisioterapia',
      numero_licencia: account.numero_licencia ?? '',
      terapeuta_id: account.terapeuta_id ? account.terapeuta_id.toString() : '',
      fecha_nacimiento: account.fecha_nacimiento ?? '',
      estado: account.estado ?? 'activo',
      estrategia_validacion: account.estrategia_validacion ?? 'Libre',
      estrategia_progreso: account.estrategia_progreso ?? 'Por rutinas',
      diagnostico_principal: account.diagnostico_principal ?? '',
      historial_medico: account.historial_medico ?? '',
      nivel_movilidad: account.nivel_movilidad ?? 'medio',
      restricciones: account.restricciones ?? '',
    });
  }

  saveAccount(): void {
    const payload = this.accountPayload();
    if (!payload.username) {
      this.accountError.set('El usuario es obligatorio.');
      return;
    }
    if (!this.editingAccountId() && !payload.password) {
      this.accountError.set('La contrasena es obligatoria para crear la cuenta.');
      return;
    }

    this.accountLoading.set(true);
    this.accountError.set('');
    this.accountSuccess.set('');
    const role = this.accountRole();
    const request = this.editingAccountId()
      ? this.accountAdminService.update(role, this.editingAccountId()!, payload)
      : this.accountAdminService.create(role, payload);

    request.subscribe({
      next: () => {
        this.accountLoading.set(false);
        this.accountSuccess.set(this.editingAccountId() ? 'Cuenta actualizada.' : 'Cuenta creada.');
        this.resetAccountForm();
        this.loadAccounts();
        this.loadKnownUsernames();
        if (role === 'terapeutas') {
          this.loadTherapists();
        }
      },
      error: (error: { error?: unknown }) => {
        this.accountLoading.set(false);
        this.accountError.set(this.formatApiError(error.error));
      },
    });
  }

  deleteAccount(account: RoleAccount): void {
    if (!confirm(`Eliminar la cuenta ${account.username}?`)) {
      return;
    }

    this.accountAdminService.delete(this.accountRole(), account.id).subscribe({
      next: () => {
        this.accountSuccess.set('Cuenta eliminada.');
        this.loadAccounts();
        this.loadKnownUsernames();
        if (this.editingAccountId() === account.id) {
          this.resetAccountForm();
        }
      },
      error: () => this.accountError.set('No se pudo eliminar la cuenta.'),
    });
  }

  resetAccountForm(): void {
    this.editingAccountId.set(null);
    this.accountForm.reset({
      username: '',
      password: '',
      email: '',
      nombre_completo: '',
      especialidad: 'Fisioterapia',
      numero_licencia: '',
      terapeuta_id: '',
      fecha_nacimiento: '',
      estado: 'activo',
      estrategia_validacion: 'Libre',
      estrategia_progreso: 'Por rutinas',
      diagnostico_principal: '',
      historial_medico: '',
      nivel_movilidad: 'medio',
      restricciones: '',
    });
  }

  autofillExampleAccount(): void {
    const username = this.nextAvailableUsername();
    const sample = this.nextExampleAccount(username);
    const therapist = this.therapistOptions()[0];

    this.editingAccountId.set(null);
    this.accountError.set('');
    this.accountSuccess.set('');
    this.accountForm.patchValue({
      username,
      password: '123456',
      email: this.exampleEmail(sample.email, username),
      nombre_completo: sample.nombre_completo ?? '',
      especialidad: sample.especialidad ?? 'Fisioterapia',
      numero_licencia: this.exampleLicense(sample.numero_licencia, username),
      terapeuta_id: this.accountRole() === 'pacientes' && therapist ? therapist.id.toString() : '',
      fecha_nacimiento: sample.fecha_nacimiento ?? '',
      estado: sample.estado ?? 'activo',
      estrategia_validacion: sample.estrategia_validacion ?? 'Libre',
      estrategia_progreso: sample.estrategia_progreso ?? 'Por rutinas',
      diagnostico_principal: sample.diagnostico_principal ?? '',
      historial_medico: sample.historial_medico ?? '',
      nivel_movilidad: sample.nivel_movilidad ?? 'medio',
      restricciones: sample.restricciones ?? '',
    });
  }

  private loadAccounts(): void {
    this.accountLoading.set(true);
    this.accountAdminService.list(this.accountRole()).subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.accountLoading.set(false);
      },
      error: () => {
        this.accountLoading.set(false);
        this.accountError.set('No se pudieron cargar las cuentas.');
      },
    });
  }

  private loadTherapists(): void {
    this.accountAdminService.list('terapeutas').subscribe({
      next: (accounts) => this.therapistOptions.set(accounts),
      error: () => this.therapistOptions.set([]),
    });
  }

  private loadKnownUsernames(): void {
    const usernames: string[] = [];
    let pendingRequests = 2;

    const finish = () => {
      pendingRequests -= 1;
      if (pendingRequests === 0) {
        this.knownUsernames.set(usernames.length ? usernames : this.accounts().map((account) => account.username));
      }
    };

    this.accountAdminService.list('terapeutas').subscribe({
      next: (accounts) => usernames.push(...accounts.map((account) => account.username)),
      error: finish,
      complete: finish,
    });

    this.accountAdminService.list('pacientes').subscribe({
      next: (accounts) => usernames.push(...accounts.map((account) => account.username)),
      error: finish,
      complete: finish,
    });
  }

  private nextAvailableUsername(): string {
    const occupied = new Set([
      ...this.knownUsernames(),
      ...this.accounts().map((account) => account.username),
      ...this.therapistOptions().map((account) => account.username),
    ].map((username) => username.toLowerCase()));

    let index = 1;
    while (occupied.has(`user${index}`)) {
      index += 1;
    }

    return `user${index}`;
  }

  private nextExampleAccount(username: string): ExampleAccount {
    const examples = EXAMPLE_ACCOUNTS[this.accountRole()];
    const index = Number(username.replace('user', '')) - 1;
    return examples[index % examples.length];
  }

  private exampleEmail(email: string | undefined, username: string): string {
    if (!email) {
      return `${username}@rehabweb.test`;
    }

    const domain = email.split('@')[1] ?? 'rehabweb.test';
    return `${username}@${domain}`;
  }

  private exampleLicense(license: string | undefined, username: string): string {
    if (this.accountRole() !== 'terapeutas') {
      return '';
    }

    const index = username.replace('user', '').padStart(4, '0');
    return license ? `${license}-${index}` : `TER-${index}`;
  }

  private accountPayload(): Partial<RoleAccount> {
    const raw = this.accountForm.getRawValue();
    const payload: Partial<RoleAccount> = {
      username: raw.username.trim(),
      email: raw.email.trim(),
      nombre_completo: raw.nombre_completo.trim(),
    };

    if (raw.password.trim()) {
      payload.password = raw.password;
    }

    if (this.accountRole() === 'terapeutas') {
      payload.especialidad = raw.especialidad.trim();
      payload.numero_licencia = raw.numero_licencia.trim();
    } else {
      payload.terapeuta_id = raw.terapeuta_id ? Number(raw.terapeuta_id) : null;
      payload.fecha_nacimiento = raw.fecha_nacimiento || null;
      payload.estado = raw.estado as 'activo' | 'inactivo';
      payload.estrategia_validacion = raw.estrategia_validacion.trim();
      payload.estrategia_progreso = raw.estrategia_progreso.trim();
      payload.diagnostico_principal = raw.diagnostico_principal.trim();
      payload.historial_medico = raw.historial_medico.trim();
      payload.nivel_movilidad = raw.nivel_movilidad as 'bajo' | 'medio' | 'alto' | 'dependiente';
      payload.restricciones = raw.restricciones.trim();
    }

    return payload;
  }

  private formatApiError(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return 'No se pudo guardar la cuenta.';
    }

    const values = Object.values(error as Record<string, unknown>).flat();
    return values.length ? values.join(' ') : 'No se pudo guardar la cuenta.';
  }
}
