import { Routes } from '@angular/router';

import { AppShellComponent } from './layout/app-shell.component';
import { MensajeriaComponent } from './screens/mensajeria/mensajeria.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tablero-control' },
  {
    path: 'login',
    loadComponent: () =>
      import('./screens/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'tablero-control',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta', 'paciente'] },
        loadComponent: () =>
          import('./screens/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'pacientes',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta'] },
        loadComponent: () =>
          import('./screens/patients/patients.component').then((m) => m.PatientsComponent),
      },
      {
        path: 'rutinas/nueva',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta'] },
        loadComponent: () =>
          import('./screens/routines/routines.component').then((m) => m.RoutinesComponent),
      },
      {
        path: 'historial-sesiones',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta', 'paciente'] },
        loadComponent: () =>
          import('./screens/sessions/sessions.component').then((m) => m.SessionsComponent),
      },
      {
        path: 'comparativa-desempeno',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta'] },
        loadComponent: () =>
          import('./screens/performance/performance.component').then((m) => m.PerformanceComponent),
      },
      {
        path: 'alertas-inactividad',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta'] },
        loadComponent: () =>
          import('./screens/alerts/alerts.component').then((m) => m.AlertsComponent),
      },
      {
        path: 'reportes',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta', 'paciente'] },
        loadComponent: () =>
          import('./screens/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'mensajeria',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta', 'paciente'] },
        component: MensajeriaComponent,
      },
      {
        path: 'configuraciones',
        canActivate: [roleGuard],
        data: { roles: ['terapeuta', 'paciente'] },
        loadComponent: () =>
          import('./screens/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  {
    path: 'landing',
    loadComponent: () =>
      import('./screens/landing/landing').then((m) => m.LandingComponent),
  },
  { path: '**', redirectTo: 'login' },
];
