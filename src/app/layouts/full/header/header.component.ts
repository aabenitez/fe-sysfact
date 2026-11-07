import {
  Component,
  Output,
  EventEmitter,
  Input,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { AuthService } from 'src/app/core/auth/auth.service';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule, NgScrollbarModule, MaterialModule, MatButtonModule],
  templateUrl: './header.component.html',
  styles: [
    `
      .profile-trigger { height: 48px !important; border-radius: 12px !important; padding: 0 10px !important; }
      .user-avatar {
        display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%;
        font-size: 13px; font-weight: 700; color: #fff;
        background: linear-gradient(135deg, #635bff, #3b32c9);
      }
      .user-meta { margin-left: 10px; text-align: left; line-height: 1.2; }
      .user-name { display: block; font-size: 14px; font-weight: 600; color: #111c2d; }
      .user-role { display: block; font-size: 12px; color: #707a82; }
      @media (max-width: 575px) { .user-meta { display: none; } }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
})

export class HeaderComponent {
  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
  }
}
