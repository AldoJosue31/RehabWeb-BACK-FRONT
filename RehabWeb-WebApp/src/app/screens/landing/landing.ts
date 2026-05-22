import { Component } from '@angular/core';

@Component({
  selector: 'app-landing',
  standalone: true,
  template: `
    <main class="grid min-h-dvh place-content-center gap-3 bg-app p-6 text-center font-sans text-main">
      <h1 class="m-0 text-2xl font-bold leading-solid">RehabWeb</h1>
      <p class="m-0 text-base leading-default text-secondary">Frontend y backend en funcionamiento.</p>
    </main>
  `,
})
export class LandingComponent {}
