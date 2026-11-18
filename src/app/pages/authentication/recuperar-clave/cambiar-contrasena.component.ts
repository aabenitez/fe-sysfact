import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { MaterialModule } from '../../../material.module';
import { RecuperarClaveService } from '../../../core/services/recuperar-clave.service';
import { mensajeError } from '../../../core/http-error';

/** Group validator: both password fields must be equal. */
function iguales(group: AbstractControl): ValidationErrors | null {
  const { password, passwordConfirm } = group.value as { password: string; passwordConfirm: string };
  return password && passwordConfirm && password !== passwordConfirm ? { distintas: true } : null;
}

type Estado = 'validando' | 'invalido' | 'formulario' | 'listo';

/** Page the recovery e-mail links to (/cambiar-contrasena?token=...): sets a new password. */
@Component({
  selector: 'app-cambiar-contrasena',
  standalone: true,
  imports: [RouterModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './cambiar-contrasena.component.html',
  styleUrls: ['../side-login/side-login.component.scss', './recuperar-clave.scss'],
})
export class CambiarContrasenaComponent implements OnInit {
  private readonly service = inject(RecuperarClaveService);
  private readonly route = inject(ActivatedRoute);

  readonly year = new Date().getFullYear();
  readonly minimo = 8;
  readonly estado = signal<Estado>('validando');
  readonly loading = signal(false);
  readonly hide = signal(true);
  readonly error = signal<string | null>(null);

  private readonly token = (this.route.snapshot.queryParamMap.get('token') ?? '').trim();

  readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(this.minimo), Validators.maxLength(100)],
      }),
      passwordConfirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: iguales }
  );

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    if (!this.token) {
      this.estado.set('invalido');
      return;
    }
    this.service.validar(this.token).subscribe({
      next: (valido) => this.estado.set(valido ? 'formulario' : 'invalido'),
      // If the check itself fails, still show the form: submitting reports the real problem.
      error: () => this.estado.set('formulario'),
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    const { password, passwordConfirm } = this.form.getRawValue();
    this.error.set(null);
    this.loading.set(true);
    this.service
      .cambiar(this.token, password, passwordConfirm)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.estado.set('listo'),
        error: (e: HttpErrorResponse) =>
          this.error.set(mensajeError(e, 'No se pudo cambiar la contraseña. Intentá de nuevo.')),
      });
  }
}
