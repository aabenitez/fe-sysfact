import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Cliente } from '../../core/models/cliente.model';
import { ClienteInput, ClienteService } from '../../core/services/cliente.service';
import { mensajeError } from '../../core/http-error';

export interface ClienteFormData {
  /** Client to edit; omitted when creating a new one. */
  cliente?: Cliente;
}

const NO_VACIO = Validators.pattern(/\S/);
/** CI (digits, optional dots) or RUC (digits-check digit), e.g. 4558334-9 or 80012345-6. */
const CI_RUC = Validators.pattern(/^\s*[\d.]+(-\s*[\dkK])?\s*$/);
const TELEFONO = Validators.pattern(/^[\d\s()+\-.]*$/);

/** Create / edit dialog. Closes with the saved client, or undefined when cancelled. */
@Component({
  selector: 'app-cliente-form-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  templateUrl: './cliente-form-dialog.component.html',
  styleUrls: ['./cliente-form-dialog.component.scss'],
})
export class ClienteFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ClienteFormDialogComponent, Cliente>);
  private readonly service = inject(ClienteService);
  readonly data = inject<ClienteFormData>(MAT_DIALOG_DATA);

  readonly editando = !!this.data.cliente;
  readonly guardando = signal(false);
  readonly errorGuardar = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombres: [this.data.cliente?.nombres?.trim() ?? '', [Validators.required, NO_VACIO, Validators.maxLength(50)]],
    apellidos: [this.data.cliente?.apellidos?.trim() ?? '', [Validators.required, NO_VACIO, Validators.maxLength(50)]],
    ciRuc: [this.data.cliente?.ciRuc ?? '', [Validators.required, CI_RUC, Validators.maxLength(20)]],
    telefono: [this.data.cliente?.telefono ?? '', [Validators.required, NO_VACIO, TELEFONO, Validators.maxLength(20)]],
    email: [this.data.cliente?.email ?? '', [Validators.email, Validators.maxLength(100)]],
  });

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: ClienteInput = {
      nombres: v.nombres.trim(),
      apellidos: v.apellidos.trim(),
      ciRuc: v.ciRuc.replace(/\s/g, '').toUpperCase(),
      telefono: v.telefono.trim(),
      email: v.email.trim() || null,
    };

    this.guardando.set(true);
    this.errorGuardar.set(null);
    const req = this.data.cliente
      ? this.service.actualizar(this.data.cliente.id, body)
      : this.service.crear(body);
    req.subscribe({
      next: (guardado) => this.dialogRef.close(guardado),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorGuardar.set(mensajeError(e, 'No se pudo guardar el cliente.'));
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
