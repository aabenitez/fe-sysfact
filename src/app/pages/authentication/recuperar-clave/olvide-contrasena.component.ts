import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { MaterialModule } from '../../../material.module';
import { RecuperarClaveService } from '../../../core/services/recuperar-clave.service';
import { mensajeError } from '../../../core/http-error';

/** "I forgot my password": asks for the e-mail and sends the recovery link. */
@Component({
  selector: 'app-olvide-contrasena',
  standalone: true,
  imports: [RouterModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './olvide-contrasena.component.html',
  styleUrls: ['../side-login/side-login.component.scss', './recuperar-clave.scss'],
})
export class OlvideContrasenaComponent {
  private readonly service = inject(RecuperarClaveService);

  readonly year = new Date().getFullYear();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** E-mail the link was requested for; shows the confirmation instead of the form. */
  readonly enviado = signal<string | null>(null);

  readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  /** The <form> needs a [formGroup] so that (ngSubmit) runs instead of a page reload. */
  readonly form = new FormGroup({ email: this.email });

  submit(): void {
    if (this.email.invalid || this.loading()) {
      this.email.markAsTouched();
      return;
    }
    const correo = this.email.value.trim();
    this.error.set(null);
    this.loading.set(true);
    this.service
      .solicitar(correo)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.enviado.set(correo),
        error: (e: HttpErrorResponse) =>
          this.error.set(mensajeError(e, 'No se pudo enviar el pedido. Intentá de nuevo.')),
      });
  }

  otraVez(): void {
    this.enviado.set(null);
  }
}
