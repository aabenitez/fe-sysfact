import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Rol } from '../../core/auth/auth.models';
import { Usuario, UsuarioInput } from '../../core/models/usuario.model';
import { UsuarioService } from '../../core/services/usuario.service';
import { mensajeError } from '../../core/http-error';

export interface UsuarioFormData {
  /** User to edit; omitted when creating a new one. */
  usuario?: Usuario;
  roles: Rol[];
  /** True when editing the logged-in user: they cannot change their own role. */
  esUsuarioActual?: boolean;
}

const NO_VACIO = Validators.pattern(/\S/);
const MIN_CONTRASENA = 8;

/** Both password fields must match (only checked once something was typed). */
function contrasenasIguales(group: AbstractControl): ValidationErrors | null {
  const a = group.get('contrasena')?.value ?? '';
  const b = group.get('confirmar')?.value ?? '';
  return a === b ? null : { distintas: true };
}

/** Create / edit dialog. Closes with the saved user, or undefined when cancelled. */
@Component({
  selector: 'app-usuario-form-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  templateUrl: './usuario-form-dialog.component.html',
  styleUrls: ['../clientes/cliente-form-dialog.component.scss'],
  styles: ['.hint-error { color: #b42318; }'],
})
export class UsuarioFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<UsuarioFormDialogComponent, Usuario>);
  private readonly service = inject(UsuarioService);
  readonly data = inject<UsuarioFormData>(MAT_DIALOG_DATA);

  readonly editando = !!this.data.usuario;
  readonly minContrasena = MIN_CONTRASENA;
  readonly guardando = signal(false);
  readonly errorGuardar = signal<string | null>(null);
  readonly verContrasena = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      nombres: [this.data.usuario?.nombres?.trim() ?? '', [Validators.required, NO_VACIO, Validators.maxLength(100)]],
      apellidos: [this.data.usuario?.apellidos?.trim() ?? '', [Validators.required, NO_VACIO, Validators.maxLength(100)]],
      correo: [
        this.data.usuario?.correo?.trim() ?? '',
        [Validators.required, Validators.email, Validators.maxLength(100)],
      ],
      rolId: [
        { value: this.data.usuario?.rol?.id ?? (null as number | null), disabled: !!this.data.esUsuarioActual },
        Validators.required,
      ],
      // Required only when creating; when editing, empty keeps the current password.
      contrasena: [
        '',
        this.editando
          ? [Validators.minLength(MIN_CONTRASENA), Validators.maxLength(100)]
          : [Validators.required, Validators.minLength(MIN_CONTRASENA), Validators.maxLength(100)],
      ],
      confirmar: [''],
    },
    { validators: contrasenasIguales }
  );

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: UsuarioInput = {
      nombres: v.nombres.trim(),
      apellidos: v.apellidos.trim(),
      correo: v.correo.trim(),
      rol: { id: v.rolId! },
    };
    if (v.contrasena) {
      body.contrasena = v.contrasena;
    }

    this.guardando.set(true);
    this.errorGuardar.set(null);
    const req = this.data.usuario
      ? this.service.actualizar(this.data.usuario.id, body)
      : this.service.crear(body);
    req.subscribe({
      next: (guardado) => this.dialogRef.close(guardado),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorGuardar.set(mensajeError(e, 'No se pudo guardar el usuario.'));
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
