import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Cobro, formaPagoLabel } from '../../core/models/cobro.model';
import { CobroService } from '../../core/services/cobro.service';
import { formatGs } from '../../core/format';
import { mensajeError } from '../../core/http-error';
import { MOTIVO_MAX, MOTIVO_MIN } from '../ventas/anular-venta-dialog.component';

/** Asks for the reason and cancels a payment. Closes with the cancelled payment, or undefined. */
@Component({
  selector: 'app-anular-cobro-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, DatePipe],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <span class="dialog-title-icon dialog-title-icon--danger">
        <i class="iconify" data-icon="solar:close-circle-line-duotone"></i>
      </span>
      Anular cobro
    </h2>
    <mat-dialog-content>
      <p class="msg">
        El cobro de <strong>{{ gs(cobro.monto) }}</strong> ({{ forma }}, {{ cobro.fecha | date: "d/MM/y HH:mm" }})
        queda registrado como <strong>anulado</strong> y el monto vuelve al saldo de la factura. No se puede deshacer.
      </p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Motivo de la anulación</mat-label>
        <textarea matInput [formControl]="motivo" rows="3" [maxlength]="max" cdkFocusInitial placeholder="Ej.: se cargó dos veces"></textarea>
        <mat-hint align="end">{{ motivo.value.length }} / {{ max }}</mat-hint>
        @if (motivo.invalid) {
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
        Anular cobro
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
export class AnularCobroDialogComponent {
  readonly ref = inject(MatDialogRef<AnularCobroDialogComponent, Cobro>);
  readonly cobro = inject<Cobro>(MAT_DIALOG_DATA);
  private readonly service = inject(CobroService);

  readonly min = MOTIVO_MIN;
  readonly max = MOTIVO_MAX;
  readonly gs = formatGs;
  readonly forma = formaPagoLabel(this.cobro.formaPago).toLocaleLowerCase('es');

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
    this.service.anular(this.cobro.ventaId, this.cobro.id, this.motivo.value.trim()).subscribe({
      next: (c) => this.ref.close(c),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(
          e.status === 403 ? 'Tu rol no tiene permiso para anular cobros.' : mensajeError(e, 'No se pudo anular el cobro.')
        );
      },
    });
  }
}
