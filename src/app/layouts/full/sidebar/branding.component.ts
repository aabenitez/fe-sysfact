import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrandingService } from '../../../core/branding/branding.service';

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="branding">
      <a [routerLink]="['/']" class="branding-link" aria-label="Ir al inicio">
        <img
          [src]="branding.logoUrl()"
          (error)="branding.markFailed()"
          class="branding-logo"
          alt="Logo de la empresa"
        />
      </a>
    </div>
  `,
  styles: [
    `
      /* Take all the width the sidebar header leaves free (next to the mobile close button). */
      :host {
        display: block;
        flex: 1 1 auto;
        min-width: 0;
      }
      .branding-link {
        display: block;
      }
      .branding-logo {
        display: block;
        width: 100%;
        height: auto;
        max-height: 72px;
        object-fit: contain;
        object-position: left center;
      }
    `,
  ],
})
export class BrandingComponent {
  readonly branding = inject(BrandingService);
}
