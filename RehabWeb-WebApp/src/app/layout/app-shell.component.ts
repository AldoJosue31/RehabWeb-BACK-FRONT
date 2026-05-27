import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EMPTY, Subscription, merge, switchMap, timer, catchError } from 'rxjs';
import { RoleAccount } from '../services/account-admin.service';
import { AuthService } from '../services/auth.service';
import { ClinicalDataService } from '../services/clinical-data.service';
import { EngagementService, MotivationProfile } from '../services/engagement.service';

type NavIcon = 'pulse' | 'users' | 'routine' | 'history' | 'chart' | 'bell' | 'report' | 'message' | 'settings';

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
          @if (role() === 'paciente') {
            <ng-container [ngTemplateOutlet]="motivationMetrics" [ngTemplateOutletContext]="{ compact: collapsed() }"></ng-container>
          }

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
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </section>
            </nav>

            <div class="shrink-0 border-t border-line p-4">
              @if (role() === 'paciente') {
                <ng-container [ngTemplateOutlet]="motivationMetrics" [ngTemplateOutletContext]="{ compact: false }"></ng-container>
              }

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
        @case ('routine') {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5h6M9 3h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2ZM8 12h8M8 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
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

    <ng-template #motivationMetrics let-compact="compact">
      <section
        class="mb-4"
        [ngClass]="compact ? 'grid justify-items-center gap-2' : 'grid grid-cols-2 gap-3'"
        aria-label="Resumen de motivacion del paciente"
      >
        <article
          class="motivation-metric relative min-w-0 rounded-md border text-center shadow-sm"
          [ngClass]="[
            compact ? 'grid h-[70px] w-14 place-items-center px-1 pb-2 pt-4' : 'px-3 py-3',
            hasActiveStreak() ? 'border-warning/50 bg-warning/10 text-warning' : 'border-line bg-app text-muted'
          ]"
          [class.motivation-metric--changed]="streakChange() !== null"
          [attr.title]="compact ? streakDays() + ' dias de racha' : null"
        >
          @if (streakChange(); as change) {
            <span
              class="motivation-pop absolute rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none shadow-sm"
              [ngClass]="[
                compact ? 'left-1 right-1 top-1 truncate text-center' : 'right-2 top-2',
                change > 0 ? 'bg-warning text-white' : 'bg-danger-bg text-danger'
              ]"
            >
              {{ streakChangeLabel() }}
            </span>
          }

          <div class="grid place-items-center" [ngClass]="compact ? 'gap-1' : 'gap-2'">
            <span class="grid shrink-0 place-items-center" [ngClass]="compact ? 'h-6 w-6' : 'h-9 w-9'">
              @if (hasActiveStreak()) {
                <svg class="h-full w-full" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d="M25.7 4.4c1.5 6.5 8.8 8.8 8.8 18 0 8-5.4 14.1-12.3 14.1-6.5 0-11.7-4.9-11.7-11.8 0-5.6 3.1-9 6.2-12.5.2 3.7 1.8 6 4.2 7.4.7-6.5 1.7-10.8 4.8-15.2Z" fill="currentColor" />
                  <path d="M22.7 43.5c-8.4 0-15.2-6.7-15.2-15 0-4.7 2.1-8.4 5.3-12.2-.4 2.5-.1 5 1.2 7.1 1.1 1.8 2.9 3.1 5.1 3.8.3-7.7 2.8-13.9 7-18.8-.6 5.6 6.8 8.6 9.8 14 1.5 2.8 2.2 5.8 1.7 9.1-1.1 7.1-7 12-14.9 12Z" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M24.3 37.2c3.8-.7 6.4-3.4 6.4-7 0-3.1-2.1-5.5-4-7.8-.7 3.3-2.3 5.5-4.9 7-1.4-1.5-2.1-3.2-2.2-5.2-2 2-3.1 4.2-3.1 6.6 0 3.8 3.1 6.6 7.8 6.4Z" fill="white" opacity=".72" />
                </svg>
              } @else {
                <svg class="h-full w-full" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d="M25.7 6.3c1.2 5.4 6.9 7.6 6.9 15.1 0 6.4-4.5 11.2-10.5 11.2-5.8 0-10.3-4.3-10.3-10.1 0-4.3 2.3-7.1 5.1-10.3.2 3 1.5 4.9 3.5 6 1-5.1 2.2-8.8 5.3-11.9Z" fill="currentColor" opacity=".18" />
                  <path d="M15.2 38.8c3.2-1.1 5.8-1.1 8.8 0 3.2 1.2 5.8 1.2 8.8 0M13.1 33.9c3.7-1.5 6.6-1.5 10 0 3.7 1.6 6.7 1.6 10.3 0" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
                  <path d="M22.1 32.6c-5.8 0-10.3-4.3-10.3-10.1 0-4.3 2.3-7.1 5.1-10.3.2 3 1.5 4.9 3.5 6 1-5.1 2.2-8.8 5.3-11.9 1.2 5.4 6.9 7.6 6.9 15.1 0 3.4-1.3 6.3-3.5 8.2M9.2 8.8l29.6 29.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              }
            </span>

            @if (!compact) {
              <div class="min-w-0">
                <p class="m-0 text-[11px] font-bold uppercase tracking-wide">Racha</p>
                <p class="m-0 mt-1 text-base font-black leading-solid text-main">{{ streakDays() }} {{ streakDays() === 1 ? 'dia' : 'dias' }}</p>
              </div>
            } @else {
              <strong class="block max-w-full truncate text-[11px] font-black leading-none text-main tabular-nums">{{ streakDays() }}</strong>
            }
          </div>
        </article>

        <article
          class="motivation-metric relative min-w-0 rounded-md border border-info/40 bg-info/10 text-center text-info shadow-sm"
          [ngClass]="compact ? 'grid h-[70px] w-14 place-items-center px-1 pb-2 pt-4' : 'px-3 py-3'"
          [class.motivation-metric--changed]="pointsChange() !== null"
          [attr.title]="compact ? currentPoints() + ' puntos' : null"
        >
          @if (pointsChange(); as change) {
            <span
              class="motivation-pop absolute rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none shadow-sm"
              [ngClass]="[
                compact ? 'left-1 right-1 top-1 truncate text-center' : 'right-2 top-2',
                change > 0 ? 'bg-info text-white' : 'bg-danger-bg text-danger'
              ]"
            >
              {{ pointsChangeLabel() }}
            </span>
          }

          <div class="grid place-items-center" [ngClass]="compact ? 'gap-1' : 'gap-2'">
            <span class="grid shrink-0 place-items-center" [ngClass]="compact ? 'h-6 w-6' : 'h-9 w-9'">
              <svg class="h-full w-full" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path d="m24 5.2 4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5-9.4-5-9.4 5 1.8-10.5-7.7-7.5 10.6-1.5L24 5.2Z" fill="currentColor" opacity=".9" />
                <path d="m24 5.2 4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5-9.4-5-9.4 5 1.8-10.5-7.7-7.5 10.6-1.5L24 5.2Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                <path d="m37.5 31.4 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5 1.5-3ZM10.5 29.8l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4 1.3-2.6Z" fill="currentColor" opacity=".7" />
                <path d="m21.7 17.3 2.3-4.8 2.3 4.8 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.8Z" fill="white" opacity=".6" />
              </svg>
            </span>

            @if (!compact) {
              <div class="min-w-0">
                <p class="m-0 text-[11px] font-bold uppercase tracking-wide">Puntos</p>
                <p class="m-0 mt-1 text-base font-black leading-solid text-main">{{ currentPoints() | number:'1.0-0' }}</p>
              </div>
            } @else {
              <strong class="block max-w-full truncate text-[11px] font-black leading-none text-main tabular-nums">{{ currentPoints() }}</strong>
            }
          </div>
        </article>
      </section>
    </ng-template>
  `,
  styles: [`
    .motivation-metric {
      transition:
        transform var(--baseline-motion-medium) var(--baseline-motion-ease),
        box-shadow var(--baseline-motion-medium) var(--baseline-motion-ease);
    }

    .motivation-metric--changed {
      animation: motivation-glow 900ms var(--baseline-motion-ease) both;
    }

    .motivation-pop {
      animation: motivation-pop 1400ms var(--baseline-motion-ease) both;
      pointer-events: none;
      z-index: 1;
    }

    @keyframes motivation-pop {
      0% {
        opacity: 0;
        transform: translateY(4px) scale(0.82);
      }
      16% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      76% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
    }

    @keyframes motivation-glow {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 28%, transparent);
      }
      38% {
        transform: scale(1.035);
        box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 14%, transparent);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
      }
    }
  `],
})
export class AppShellComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private clinicalDataService = inject(ClinicalDataService);
  private engagementService = inject(EngagementService);
  private router = inject(Router);
  private subscriptions = new Subscription();
  private pointsChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private streakChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private motivationInitialized = false;

  collapsed = signal(false);
  mobileMenuOpen = signal(false);
  currentAccount = signal<RoleAccount | null>(null);
  motivationStats = signal<MotivationProfile | null>(null);
  pointsChange = signal<number | null>(null);
  streakChange = signal<number | null>(null);

  private mainNavItems: NavItem[] = [
    { label: 'Tablero de Control', path: '/tablero-control', icon: 'pulse', roles: ['terapeuta', 'paciente'] },
    { label: 'Pacientes', path: '/pacientes', icon: 'users', roles: ['terapeuta'] },
    { label: 'Nueva Rutina', path: '/rutinas/nueva', icon: 'routine', roles: ['terapeuta'] },
    { label: 'Sesiones y Progreso', path: '/historial-sesiones', icon: 'history', roles: ['terapeuta', 'paciente'] },
    { label: 'Comparativa de Desempeño', path: '/comparativa-desempeno', icon: 'chart', roles: ['terapeuta'] },
    { label: 'Alertas Clínicas', path: '/alertas', icon: 'bell', roles: ['terapeuta'] },
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
  streakDays = computed(() => Math.max(0, this.motivationStats()?.current_streak ?? this.currentAccount()?.current_streak ?? 0));
  currentPoints = computed(() => Math.max(0, this.motivationStats()?.total_points ?? this.currentAccount()?.total_points ?? 0));
  hasActiveStreak = computed(() => this.streakDays() > 0);
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
    this.subscriptions.add(
      this.clinicalDataService.currentAccount().subscribe((account) => this.currentAccount.set(account)),
    );
    this.startMotivationSync();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearPointsChange();
    this.clearStreakChange();
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

  pointsChangeLabel(): string {
    const change = this.pointsChange() ?? 0;
    return `${change > 0 ? '+' : ''}${change}`;
  }

  streakChangeLabel(): string {
    const change = this.streakChange() ?? 0;
    const abs = Math.abs(change);
    const unit = abs === 1 ? 'dia' : 'dias';
    return `${change > 0 ? '+' : ''}${change} ${unit}`;
  }

  private startMotivationSync(): void {
    if (typeof window === 'undefined' || this.role() !== 'paciente') return;

    this.subscriptions.add(
      merge(timer(0, 5000), this.engagementService.motivationRefreshes$)
        .pipe(
          switchMap(() =>
            this.engagementService.getMotivation().pipe(catchError(() => EMPTY)),
          ),
        )
        .subscribe((stats) => this.applyMotivationStats(stats)),
    );
  }

  private applyMotivationStats(stats: MotivationProfile): void {
    const previous = this.motivationStats();
    this.motivationStats.set(stats);

    if (!this.motivationInitialized) {
      this.motivationInitialized = true;
      return;
    }

    const previousPoints = previous?.total_points ?? this.currentAccount()?.total_points ?? stats.total_points;
    const previousStreak = previous?.current_streak ?? this.currentAccount()?.current_streak ?? stats.current_streak;
    const pointsDelta = stats.total_points - previousPoints;
    const streakDelta = stats.current_streak - previousStreak;

    if (pointsDelta !== 0) this.showPointsChange(pointsDelta);
    if (streakDelta !== 0) this.showStreakChange(streakDelta);
  }

  private showPointsChange(delta: number): void {
    this.clearPointsChange();
    this.pointsChange.set(delta);
    this.pointsChangeTimeout = setTimeout(() => this.clearPointsChange(), 1500);
  }

  private showStreakChange(delta: number): void {
    this.clearStreakChange();
    this.streakChange.set(delta);
    this.streakChangeTimeout = setTimeout(() => this.clearStreakChange(), 1500);
  }

  private clearPointsChange(): void {
    if (this.pointsChangeTimeout) {
      clearTimeout(this.pointsChangeTimeout);
      this.pointsChangeTimeout = null;
    }
    this.pointsChange.set(null);
  }

  private clearStreakChange(): void {
    if (this.streakChangeTimeout) {
      clearTimeout(this.streakChangeTimeout);
      this.streakChangeTimeout = null;
    }
    this.streakChange.set(null);
  }
}
