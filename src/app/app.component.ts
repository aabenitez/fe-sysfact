import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrandingService } from './core/branding/branding.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'Modernize Angular Admin Tempplate';

  constructor() {
    // The company favicon (if any) replaces the default one in the browser tab.
    inject(BrandingService).applyFavicon();
  }
}
