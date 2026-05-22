import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountAdminRole, AccountAdminService, RoleAccount } from '../../services/account-admin.service';
import { AuthRole, AuthService } from '../../services/auth.service';

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
