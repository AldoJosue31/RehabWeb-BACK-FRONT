import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RoleAccount } from '../services/account-admin.service';
import { AuthService } from '../services/auth.service';
import { ClinicalDataService } from '../services/clinical-data.service';

type NavIcon = 'pulse' | 'users' | 'history' | 'chart' | 'bell' | 'report' | 'message' | 'settings';

interface NavItem {
  label: string;
  path: string;
  icon: NavIcon;
  roles: Array<'terapeuta' | 'paciente'>;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="flex min-h-dvh bg-app font-sans text-main">
      <aside
        class="sticky top-0 z-30 hidden h-dvh shrink-0 overflow-visible border-r border-line bg-surface transition-all duration-[var(--baseline-motion-medium)] ease-[var(--baseline-motion-ease)] lg:flex lg:flex-col"
        [ngClass]="collapsed() ? 'w-[88px]' : 'w-[260px]'"
      >
        <div class="flex h-[76px] items-center gap-3 border-b border-line px-5">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-white shadow-sm">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h3l2-5 4 10 2-5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          @if (!collapsed()) {
            <strong class="text-base font-bold leading-solid text-nav">PhysioMetrics</strong>
          }
        </div>

        <button
          class="absolute -right-5 top-[66px] z-50 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-line bg-surface text-secondary shadow-md transition duration-[var(--baseline-motion-medium)] hover:border-primary hover:text-primary"
          type="button"
          (click)="toggleCollapsed()"
          [attr.aria-label]="collapsed() ? 'Expandir menu' : 'Contraer menu'"
        >
          <svg class="h-4 w-4 transition duration-[var(--baseline-motion-medium)]" [ngClass]="collapsed() ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <nav class="flex grow flex-col gap-7 overflow-x-hidden overflow-y-auto px-4 py-6">
          <section>
            @if (!collapsed()) {
              <p class="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-muted">Main menu</p>
            }
            <div class="grid gap-1">
              @for (item of mainNav(); track item.path) {
                <a
                  class="group flex min-h-11 items-center gap-3 rounded-md text-sm font-medium text-secondary transition duration-[var(--baseline-motion-medium)] hover:bg-primary-low hover:text-primary"
                  [ngClass]="collapsed() ? 'justify-center px-0' : 'px-3'"
                  [routerLink]="item.path"
                  routerLinkActive="bg-primary-low text-primary"
                  [routerLinkActiveOptions]="{ exact: true }"
                  [attr.title]="collapsed() ? item.label : null"
                >
                  <span class="shrink-0">
                    <ng-container [ngTemplateOutlet]="iconTemplate" [ngTemplateOutletContext]="{ icon: item.icon }"></ng-container>
                  </span>
                  @if (!collapsed()) {
                    <span class="truncate">{{ item.label }}</span>
                  }
                </a>
              }
            </div>
          </section>

          <section>
            @if (!collapsed()) {
              <p class="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-muted">Settings</p>
            }
            <div class="grid gap-1">
              @for (item of settingsNav(); track item.path) {
                <a
                  class="group flex min-h-11 items-center gap-3 rounded-md text-sm font-medium text-secondary transition duration-[var(--baseline-motion-medium)] hover:bg-primary-low hover:text-primary"
                  [ngClass]="collapsed() ? 'justify-center px-0' : 'px-3'"
                  [routerLink]="item.path"
                  routerLinkActive="bg-primary-low text-primary"
                  [routerLinkActiveOptions]="{ exact: true }"
                  [attr.title]="collapsed() ? item.label : null"
                >
                  <span class="shrink-0">
                    <ng-container [ngTemplateOutlet]="iconTemplate" [ngTemplateOutletContext]="{ icon: item.icon }"></ng-container>
                  </span>
                  @if (!collapsed()) {
                    <span class="truncate">{{ item.label }}</span>
                  }
                </a>
              }

              <button
                class="flex min-h-11 items-center gap-3 rounded-md text-left text-sm font-medium text-secondary transition duration-[var(--baseline-motion-medium)] hover:bg-danger-bg hover:text-danger"
                [ngClass]="collapsed() ? 'justify-center px-0' : 'px-3'"
                type="button"
                (click)="logout()"
                [attr.title]="collapsed() ? 'Cerrar sesi\u00f3n' : null"
              >
                <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M10 17l5-5-5-5M15 12H3M21 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                @if (!collapsed()) {
                  <span>Cerrar sesión</span>
                }
              </button>
            </div>
          </section>
        </nav>

        <div class="border-t border-line p-4">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-low text-sm font-bold text-primary">
              {{ initials() }}
            </span>
            @if (!collapsed()) {
              <div class="min-w-0">
                <p class="m-0 truncate text-sm font-bold leading-solid text-main">{{ displayName() }}</p>
                <p class="m-0 text-xs leading-default text-secondary">{{ roleLabel() }}</p>
              </div>
            }
          </div>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12h3l2-5 4 10 2-5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <strong class="text-base font-bold text-nav">PhysioMetrics</strong>
          </div>
          <button class="rounded-md border border-line px-3 py-2 text-sm font-bold text-secondary" type="button" (click)="toggleMobileMenu()">
            Menu
          </button>
        </header>

        @if (mobileMenuOpen()) {
          <div class="fixed inset-0 z-40 bg-nav/35 lg:hidden" (click)="toggleMobileMenu()"></div>
          <aside class="fixed inset-y-0 left-0 z-50 flex h-dvh w-full max-w-[340px] flex-col overflow-hidden border-r border-line bg-surface shadow-lg sm:max-w-[360px] lg:hidden">
            <div class="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
              <div class="flex min-w-0 items-center gap-3">
                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-white shadow-sm">
                  <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 12h3l2-5 4 10 2-5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <strong class="truncate text-base font-bold leading-solid text-nav">PhysioMetrics</strong>
              </div>
              <button class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-secondary shadow-sm hover:border-primary hover:text-primary" type="button" (click)="toggleMobileMenu()" aria-label="Cerrar menu">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <nav class="flex min-h-0 grow flex-col gap-7 overflow-x-hidden overflow-y-auto px-4 py-6">
              <section>
                <p class="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-muted">Main menu</p>
                <div class="grid gap-1">
                  @for (item of mainNav(); track item.path) {
                    <a
                      class="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-secondary transition duration-200 hover:bg-primary-low hover:text-primary"
                      [routerLink]="item.path"
                      routerLinkActive="bg-primary-low text-primary"
                      [routerLinkActiveOptions]="{ exact: true }"
                      (click)="closeMobileMenu()"
                    >
                      <span class="shrink-0">
                        <ng-container [ngTemplateOutlet]="iconTemplate" [ngTemplateOutletContext]="{ icon: item.icon }"></ng-container>
                      </span>
                      <span class="min-w-0 truncate">{{ item.label }}</span>
                    </a>
                  }
                </div>
              </section>

              <section>
                <p class="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-muted">Settings</p>
                <div class="grid gap-1">
                  @for (item of settingsNav(); track item.path) {
                    <a
                      class="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-secondary transition duration-200 hover:bg-primary-low hover:text-primary"
                      [routerLink]="item.path"
                      routerLinkActive="bg-primary-low text-primary"
                      [routerLinkActiveOptions]="{ exact: true }"
                      (click)="closeMobileMenu()"
                    >
                      <span class="shrink-0">
                        <ng-container [ngTemplateOutlet]="iconTemplate" [ngTemplateOutletContext]="{ icon: item.icon }"></ng-container>
                      </span>
                      <span class="min-w-0 truncate">{{ item.label }}</span>
                    </a>
                  }

                  <button
                    class="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-secondary transition duration-200 hover:bg-danger-bg hover:text-danger"
                    type="button"
                    (click)="logout()"
                  >
                    <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M10 17l5-5-5-5M15 12H3M21 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span>Cerrar sesiÃ³n</span>
                  </button>
                </div>
              </section>
            </nav>

            <div class="shrink-0 border-t border-line p-4">
              <div class="flex items-center gap-3">
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-low text-sm font-bold text-primary">
                  {{ initials() }}
                </span>
                <div class="min-w-0">
                  <p class="m-0 truncate text-sm font-bold leading-solid text-main">{{ displayName() }}</p>
                  <p class="m-0 truncate text-xs leading-default text-secondary">{{ roleLabel() }}</p>
                </div>
              </div>
            </div>
          </aside>
        }

        <main class="rw-route-host min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-10">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <ng-template #iconTemplate let-icon="icon">
      @switch (icon) {
        @case ('pulse') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h4l2-6 4 12 2-6h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
        @case ('users') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
        @case ('history') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
        @case ('chart') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 19V5M8 17V9M12 19V3M16 16v-5M20 19V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
        @case ('bell') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
        @case ('report') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
        @case ('message') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
        @default {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.07 4.24l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.19.6.74 1 1.36 1H21a2 2 0 1 1 0 4h-.09c-.62 0-1.17.4-1.51 1Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        }
      }
    </ng-template>
  `,
})
export class AppShellComponent implements OnInit {
  private authService = inject(AuthService);
  private clinicalDataService = inject(ClinicalDataService);
  private router = inject(Router);

  collapsed = signal(false);
  mobileMenuOpen = signal(false);
  currentAccount = signal<RoleAccount | null>(null);

  private mainNavItems: NavItem[] = [
    { label: 'Tablero de Control', path: '/tablero-control', icon: 'pulse', roles: ['terapeuta', 'paciente'] },
    { label: 'Pacientes', path: '/pacientes', icon: 'users', roles: ['terapeuta'] },
    { label: 'Sesiones y Progreso', path: '/historial-sesiones', icon: 'history', roles: ['terapeuta', 'paciente'] },
    { label: 'Comparativa de Desempeño', path: '/comparativa-desempeno', icon: 'chart', roles: ['terapeuta'] },
    { label: 'Alertas de Inactividad', path: '/alertas-inactividad', icon: 'bell', roles: ['terapeuta'] },
    { label: 'Generación de Reportes', path: '/reportes', icon: 'report', roles: ['terapeuta', 'paciente'] },
    { label: 'Mensajería', path: '/mensajeria', icon: 'message', roles: ['terapeuta', 'paciente'] },
  ];

  private settingsNavItems: NavItem[] = [
    { label: 'Configuraciones', path: '/configuraciones', icon: 'settings', roles: ['terapeuta', 'paciente'] },
  ];

  role = computed(() => this.authService.getRole() ?? 'paciente');
  mainNav = computed(() => this.mainNavItems.filter((item) => item.roles.includes(this.role())));
  settingsNav = computed(() => this.settingsNavItems.filter((item) => item.roles.includes(this.role())));
  allNav = computed(() => [...this.mainNav(), ...this.settingsNav()]);
  displayName = computed(() => this.clinicalDataService.displayName(this.currentAccount()));
  initials = computed(() => {
    const parts = this.displayName().trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0]?.slice(0, 2) || 'US').toUpperCase();
  });
  roleLabel = computed(() => {
    const account = this.currentAccount();
    if (this.role() === 'paciente') {
      return account?.diagnostico_principal || 'Paciente';
    }

    return account?.especialidad || 'Fisioterapeuta';
  });

  ngOnInit(): void {
    this.clinicalDataService.currentAccount().subscribe((account) => this.currentAccount.set(account));
  }

  toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((value) => !value);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.closeMobileMenu();
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
