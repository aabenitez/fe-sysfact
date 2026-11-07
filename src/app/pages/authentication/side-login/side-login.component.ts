import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { MaterialModule } from '../../../material.module';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [RouterModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './side-login.component.html',
  styleUrls: ['./side-login.component.scss'],
})
export class AppSideLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly year = new Date().getFullYear();
  readonly loading = signal(false);
  readonly hidePassword = signal(true);
  readonly error = signal<string | null>(null);
  readonly sessionExpired =
    this.route.snapshot.queryParamMap.get('motivo') === 'expired';

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    remember: new FormControl(false, { nonNullable: true }),
  });

  get f() {
    return this.form.controls;
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, remember } = this.form.getRawValue();
    this.error.set(null);
    this.loading.set(true);

    this.auth
      .login(email.trim(), password, remember)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigateByUrl(
            returnUrl && returnUrl.startsWith('/') ? returnUrl : '/inicio'
          );
        },
        error: (err: HttpErrorResponse) => this.error.set(this.toMessage(err)),
      });
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 401) return 'Correo o contraseña incorrectos.';
    if (err.status === 0 || err.status === 502 || err.status === 504) {
      return 'No se pudo conectar con el servidor. Verificá que el backend esté levantado.';
    }
    return 'Ocurrió un error inesperado al iniciar sesión. Intentá de nuevo.';
  }
}
