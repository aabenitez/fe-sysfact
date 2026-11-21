import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import {
  Articulo,
  MovimientoStock,
  Proveedor,
  TIPOS_MOVIMIENTO,
  cantidadConUnidad,
  estadoStock,
} from '../../core/models/articulo.model';
import { numeroFactura } from '../../core/models/venta.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { ProveedorService } from '../../core/services/proveedor.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROL_ADMIN, ROLES_INGRESO_STOCK } from '../../core/auth/permisos';
import { mensajeError } from '../../core/http-error';
import { ArticuloThumbComponent } from '../../core/ui/articulo-thumb.component';

export interface StockDialogData {
  articulo: Articulo;
  /** Called after each saved movement, so the page behind can refresh its list. */
  alCambiar?: () => void;
}

type Modo = 'ver' | 'ingreso' | 'ajuste';

/** Stock of one article: how much there is, goods received, adjustments and the full history. */
@Component({
  selector: 'app-stock-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, ArticuloThumbComponent],
  templateUrl: './stock-dialog.component.html',
  styleUrls: ['./stock-dialog.component.scss'],
})
export class StockDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ArticuloService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<StockDialogComponent>);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  readonly data = inject<StockDialogData>(MAT_DIALOG_DATA);

  readonly articulo = this.data.articulo;
  readonly existencia = signal(this.articulo.existencia ?? 0);
  readonly estado = computed(() =>
    estadoStock({ existencia: this.existencia(), stockMinimo: this.articulo.stockMinimo })
  );

  readonly puedeIngresar = computed(() => ROLES_INGRESO_STOCK.includes(this.auth.rol()));
  readonly puedeAjustar = computed(() => this.auth.rol() === ROL_ADMIN);

  readonly modo = signal<Modo>('ver');
  readonly movimientos = signal<MovimientoStock[]>([]);
  readonly cargando = signal(true);
  readonly errorCarga = signal<string | null>(null);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly guardando = signal(false);
  readonly errorGuardar = signal<string | null>(null);

  readonly tipos = TIPOS_MOVIMIENTO;
  readonly numeroFactura = numeroFactura;

  readonly ingreso = this.fb.group({
    cantidad: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(1000000)]),
    proveedorId: this.fb.control<number | null>(this.articulo.proveedor?.id ?? null),
    motivo: this.fb.nonNullable.control('', Validators.maxLength(250)),
  });

  readonly ajuste = this.fb.group({
    existencia: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(1000000)]),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(5), Validators.maxLength(250)]),
  });

  ngOnInit(): void {
    this.cargarHistorial();
    if (this.puedeIngresar()) {
      // Suppliers are optional context for a receipt; the form works without them.
      this.proveedorService.listar().subscribe({ next: (l) => this.proveedores.set(l), error: () => {} });
    }
  }

  cargarHistorial(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.service.historialStock(this.articulo.id).subscribe({
      next: (l) => {
        this.movimientos.set(l);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.errorCarga.set(mensajeError(e, 'No se pudo cargar el historial de stock.'));
        this.cargando.set(false);
      },
    });
  }

  abrir(modo: Modo): void {
    this.errorGuardar.set(null);
    this.modo.set(modo);
    if (modo === 'ingreso') this.ingreso.reset({ cantidad: null, proveedorId: this.articulo.proveedor?.id ?? null, motivo: '' });
    if (modo === 'ajuste') this.ajuste.reset({ existencia: null, motivo: '' });
    // The panel appears after this change is rendered; then the first field gets the cursor.
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>('.panel input')?.focus(), {
      injector: this.injector,
    });
  }

  /** A sale's reason repeats its invoice link, except for edits and cancellations, which say more. */
  mostrarMotivo(m: MovimientoStock): boolean {
    return !!m.motivo && !(m.ventaId && m.motivo === 'Factura N.º ' + this.numeroFactura(m.ventaId));
  }

  /** Stock after the receipt being typed, or null while the quantity is not valid. */
  despuesDeIngreso(): number | null {
    const c = this.ingreso.controls.cantidad.value;
    return c && c > 0 ? this.existencia() + c : null;
  }

  /** Difference the adjustment would make, or null while the count is empty. */
  diferenciaAjuste(): number | null {
    const e = this.ajuste.controls.existencia.value;
    return e === null || e === undefined || e < 0 ? null : e - this.existencia();
  }

  guardarIngreso(): void {
    if (this.ingreso.invalid) {
      this.ingreso.markAllAsTouched();
      return;
    }
    const v = this.ingreso.getRawValue();
    this.enviar(
      this.service.ingresarStock(this.articulo.id, {
        cantidad: v.cantidad!,
        proveedorId: v.proveedorId ?? null,
        motivo: v.motivo.trim() || null,
      })
    );
  }

  guardarAjuste(): void {
    if (this.ajuste.invalid) {
      this.ajuste.markAllAsTouched();
      return;
    }
    if (this.diferenciaAjuste() === 0) {
      this.errorGuardar.set('La existencia contada es igual a la actual: no hay nada que ajustar.');
      return;
    }
    const v = this.ajuste.getRawValue();
    this.enviar(this.service.ajustarStock(this.articulo.id, { existencia: v.existencia!, motivo: v.motivo.trim() }));
  }

  private enviar(req: ReturnType<ArticuloService['ingresarStock']>): void {
    this.guardando.set(true);
    this.errorGuardar.set(null);
    req.subscribe({
      next: (m) => {
        this.guardando.set(false);
        this.existencia.set(m.existencia);
        this.modo.set('ver');
        this.cargarHistorial();
        this.data.alCambiar?.();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorGuardar.set(mensajeError(e, 'No se pudo guardar el movimiento de stock.'));
      },
    });
  }

  verVenta(id: number): void {
    this.dialogRef.close();
    this.router.navigate(['/ventas', id]);
  }

  cantidad(n: number): string {
    return cantidadConUnidad(n, this.articulo.unidadMedida);
  }

  /** The unit word for n ("maceta" / "macetas"). */
  unidad(n: number): string {
    const um = this.articulo.unidadMedida;
    return um ? (Math.abs(n) === 1 ? um.nombre : um.plural || um.nombre).toLocaleLowerCase('es') : '';
  }

  conSigno(n: number): string {
    return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('es-PY');
  }

  fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
