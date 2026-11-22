import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Cobro, FORMAS_PAGO, FormaPago } from '../../core/models/cobro.model';
import { numeroFactura } from '../../core/models/venta.model';
import { CobroService } from '../../core/services/cobro.service';
import { formatGs } from '../../core/format';
import { mensajeError } from '../../core/http-error';

export interface CobroDialogData {
  ventaId: number;
  cliente: string;
  total: number;
  cobrado: number;
  saldo: number;
}

/** Registers a payment for a credit sale. Closes with the new payment, or undefined. */
@Component({
  selector: 'app-cobro-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <span class="dialog-title-icon"><i class="iconify" data-icon="solar:wallet-money-line-duotone"></i></span>
      Registrar cobro
    </h2>
    <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <mat-dialog-content>
        <div class="resumen">
          <div class="resumen-head">
            <strong>Factura N.º {{ numero }}</strong>
            <span class="muted">{{ data.cliente }}</span>
          </div>
          <div class="resumen-nums">
            <div><span class="muted">Total</span><span>{{ gs(data.total) }}</span></div>
            <div><span class="muted">Cobrado</span><span>{{ gs(data.cobrado) }}</span></div>
            <div class="saldo"><span>Saldo</span><strong>{{ gs(data.saldo) }}</strong></div>
          </div>
        </div>

        <mat-form-field appearance="outline" class="full" subscriptSizing="dynamic">
          <mat-label>Monto que paga (Gs.)</mat-label>
          <input matInput type="number" formControlName="monto" min="1" [max]="data.saldo" step="1" inputmode="numeric" />
          <button mat-button matSuffix type="button" class="todo" (click)="todoElSaldo()">Todo el saldo</button>
          @if (form.controls.monto.valid && quedaria() !== null) {
          <mat-hint>{{ quedaria() === 0 ? 'La factura queda pagada.' : 'Queda debiendo ' + gs(quedaria()!) }}</mat-hint>
          }
          @if (form.controls.monto.hasError('max')) {
          <mat-error>No puede superar el saldo ({{ gs(data.saldo) }}).</mat-error>
          } @else if (form.controls.monto.hasError('pattern')) {
          <mat-error>En guaraníes, sin decimales.</mat-error>
          } @else if (form.controls.monto.invalid) {
          <mat-error>Ingresá un monto mayor que cero.</mat-error>
          }
        </mat-form-field>

        <div class="formas" role="radiogroup" aria-label="Forma de pago">
          @for (f of formas; track f.value) {
          <button
            type="button"
            class="forma"
            role="radio"
            [attr.aria-checked]="form.controls.formaPago.value === f.value"
            [class.forma--on]="form.controls.formaPago.value === f.value"
            (click)="form.controls.formaPago.setValue(f.value)"
          >
            <i class="iconify" [attr.data-icon]="f.icon"></i>
            {{ f.label }}
          </button>
          }
        </div>

        <mat-form-field appearance="outline" class="full" subscriptSizing="dynamic">
          <mat-label>Referencia (opcional)</mat-label>
          <input matInput formControlName="referencia" maxlength="100" autocomplete="off" placeholder="Ej.: N.º de transferencia o de recibo" />
        </mat-form-field>

        @if (error()) {
        <div class="alert" role="alert">{{ error() }}</div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="ref.close()" [disabled]="guardando()">Cancelar</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="guardando()">
          @if (guardando()) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
          }
          Registrar cobro
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [
    `
      .full {
        width: 100%;
      }
      .muted {
        color: #707a82;
      }
      .resumen {
        margin-bottom: 16px;
        padding: 12px 14px;
        border: 1px solid #e0e6eb;
        border-radius: 12px;
        background: #fafbfc;
      }
      .resumen-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 10px;
        margin-bottom: 8px;
        color: #111c2d;
      }
      .resumen-nums {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        font-size: 13px;
        div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
      }
      .saldo {
        color: #b54708;
        strong {
          font-size: 16px;
        }
      }
      .todo {
        margin-right: 4px;
      }
      .formas {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 14px 0 16px;
      }
      .forma {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        border: 1px solid #e0e6eb;
        border-radius: 999px;
        background: #fff;
        font: inherit;
        font-size: 13px;
        color: #344054;
        cursor: pointer;
        &:hover {
          background: #f5f6ff;
        }
        &:focus-visible {
          outline: 2px solid #635bff;
          outline-offset: 2px;
        }
      }
      .forma--on {
        border-color: #635bff;
        background: rgba(99, 91, 255, 0.1);
        color: #4b44d6;
        font-weight: 600;
      }
      .alert {
        margin-top: 8px;
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
      @media (max-width: 479px) {
        .resumen-nums {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class CobroDialogComponent {
  readonly ref = inject(MatDialogRef<CobroDialogComponent, Cobro>);
  readonly data = inject<CobroDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(CobroService);
  private readonly fb = inject(FormBuilder);

  readonly numero = numeroFactura(this.data.ventaId);
  readonly formas = FORMAS_PAGO;
  readonly gs = formatGs;

  readonly form = this.fb.group({
    monto: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(this.data.saldo),
      Validators.pattern(/^\d+$/),
    ]),
    formaPago: this.fb.nonNullable.control<FormaPago>('EFECTIVO'),
    referencia: this.fb.nonNullable.control('', Validators.maxLength(100)),
  });

  private readonly monto = toSignal(this.form.controls.monto.valueChanges, { initialValue: null });
  /** Balance after this payment, or null while the amount is empty. */
  readonly quedaria = computed(() => {
    const m = this.monto();
    return m && m > 0 ? this.data.saldo - m : null;
  });

  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  todoElSaldo(): void {
    this.form.controls.monto.setValue(this.data.saldo);
    this.form.controls.monto.markAsTouched();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.error.set(null);
    this.service
      .registrar(this.data.ventaId, { monto: v.monto!, formaPago: v.formaPago, referencia: v.referencia.trim() || null })
      .subscribe({
        next: (c) => this.ref.close(c),
        error: (e: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(
            e.status === 403 ? 'Tu rol no tiene permiso para registrar cobros.' : mensajeError(e, 'No se pudo registrar el cobro.')
          );
        },
      });
  }
}
