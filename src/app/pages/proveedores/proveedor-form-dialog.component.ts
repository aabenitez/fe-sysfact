import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Proveedor } from '../../core/models/articulo.model';
import { ProveedorInput, ProveedorService } from '../../core/services/proveedor.service';
import { mensajeError } from '../../core/http-error';

export interface ProveedorFormData {
  /** Supplier to edit; omitted when creating a new one. */
  proveedor?: Proveedor;
}

/** Create / edit dialog. Closes with the saved supplier, or undefined when cancelled. */
@Component({
  selector: 'app-proveedor-form-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  templateUrl: './proveedor-form-dialog.component.html',
  styleUrls: ['./proveedor-form-dialog.component.scss'],
})
export class ProveedorFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ProveedorFormDialogComponent, Proveedor>);
  private readonly service = inject(ProveedorService);
  readonly data = inject<ProveedorFormData>(MAT_DIALOG_DATA);

  readonly editando = !!this.data.proveedor;
  readonly guardando = signal(false);
  readonly errorGuardar = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre: [this.data.proveedor?.nombre ?? '', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    contacto: [this.data.proveedor?.contacto ?? '', Validators.maxLength(100)],
    telefono: [this.data.proveedor?.telefono ?? '', [Validators.maxLength(30), Validators.pattern(/^[\d\s()+\-.]*$/)]],
    direccion: [this.data.proveedor?.direccion ?? '', Validators.maxLength(100)],
  });

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: ProveedorInput = {
      nombre: v.nombre.trim(),
      contacto: v.contacto.trim() || null,
      telefono: v.telefono.trim() || null,
      direccion: v.direccion.trim() || null,
    };

    this.guardando.set(true);
    this.errorGuardar.set(null);
    const req = this.data.proveedor
      ? this.service.actualizar(this.data.proveedor.id, body)
      : this.service.crear(body);
    req.subscribe({
      next: (guardado) => this.dialogRef.close(guardado),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorGuardar.set(mensajeError(e, 'No se pudo guardar el proveedor.'));
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
