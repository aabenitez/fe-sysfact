import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Venta, numeroFactura } from '../../core/models/venta.model';
import { VentaService } from '../../core/services/venta.service';
import { mensajeError } from '../../core/http-error';
import { formatGs } from '../../core/format';

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 250;

/** Asks for the reason and cancels the sale. Closes with the cancelled sale, or undefined. */
@Component({
  selector: 'app-anular-venta-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <span class="dialog-title-icon dialog-title-icon--danger">
        <i class="iconify" data-icon="solar:close-circle-line-duotone"></i>
      </span>
      Anular factura N.º {{ numero }}
    </h2>
    <mat-dialog-content>
      <p class="msg">
        La factura de <strong>{{ total }}</strong> queda registrada como <strong>anulada</strong>: no se borra, no
        suma en los totales y el stock de sus artículos se devuelve. No se puede deshacer.
      </p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Motivo de la anulación</mat-label>
        <textarea
          matInput
          [formControl]="motivo"
          rows="3"
          [maxlength]="max"
          cdkFocusInitial
          placeholder="Ej.: el cliente devolvió la compra"
        ></textarea>
        <mat-hint align="end">{{ motivo.value.length }} / {{ max }}</mat-hint>
        @if (motivo.hasError('required') || motivo.hasError('minlength') || motivo.hasError('pattern')) {
        <mat-error>Escribí el motivo (al menos {{ min }} caracteres).</mat-error>
        }
      </mat-form-field>
      @if (error()) {
      <div class="alert" role="alert">{{ error() }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close()" [disabled]="guardando()">Cancelar</button>
      <button mat-flat-button color="warn" type="button" (click)="anular()" [disabled]="guardando()">
        @if (guardando()) {
        <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        }
        Anular factura
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .msg {
        margin: 0 0 16px;
        color: #4b5563;
      }
      .full {
        width: 100%;
      }
      .alert {
        margin: 4px 0 8px;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
        color: #b42318;
        background: #fef3f2;
        border: 1px solid #fecdca;
      }
      .btn-spinner {
        display: inline-block;
        margin-right: 8px;
        vertical-align: middle;
      }
    `,
  ],
})
export class AnularVentaDialogComponent {
  readonly ref = inject(MatDialogRef<AnularVentaDialogComponent, Venta>);
  private readonly venta = inject<Venta>(MAT_DIALOG_DATA);
  private readonly service = inject(VentaService);

  readonly min = MOTIVO_MIN;
  readonly max = MOTIVO_MAX;
  readonly numero = numeroFactura(this.venta.id);
  readonly total = formatGs(this.venta.totalFactura);

  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(MOTIVO_MIN), Validators.pattern(/\S/)],
  });
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  anular(): void {
    if (this.motivo.invalid || this.motivo.value.trim().length < MOTIVO_MIN) {
      this.motivo.setErrors({ minlength: true });
      this.motivo.markAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.service.anular(this.venta.id, this.motivo.value.trim()).subscribe({
      next: (v) => this.ref.close(v),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(
          e.status === 403 ? 'Tu rol no tiene permiso para anular ventas.' : mensajeError(e, 'No se pudo anular la factura.')
        );
      },
    });
  }
}
