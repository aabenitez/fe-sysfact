import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import {
  DetalleVenta,
  Venta,
  clienteNombre,
  condicionLabel,
  esDeHoy,
  estaAnulada,
  numeroFactura,
  vendedorNombre,
} from '../../core/models/venta.model';
import { VentaService } from '../../core/services/venta.service';
import { BrandingService } from '../../core/branding/branding.service';
import { formatGs } from '../../core/format';
import { AuthService } from '../../core/auth/auth.service';
import { ROL_ADMIN, puedeVender } from '../../core/auth/permisos';
import { Auditoria, accionIcon, accionLabel } from '../../core/models/auditoria.model';
import { AnularVentaDialogComponent } from './anular-venta-dialog.component';

@Component({
  selector: 'app-venta-detalle',
  standalone: true,
  imports: [MaterialModule, RouterModule, DatePipe],
  templateUrl: './venta-detalle.component.html',
  styleUrls: ['./venta-detalle.component.scss'],
})
export class VentaDetalleComponent implements OnInit {
  private readonly service = inject(VentaService);
  private readonly route = inject(ActivatedRoute);
  readonly branding = inject(BrandingService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly historial = signal<Auditoria[] | null>(null);
  readonly historialError = signal(false);
  /** Shown once after saving or cancelling. */
  readonly aviso = signal<string | null>(null);

  readonly anulada = computed(() => estaAnulada(this.venta()));
  readonly puedeVender = computed(() => puedeVender(this.auth.rol()));
  /** Why this user cannot edit or cancel this sale (null = can). */
  readonly bloqueo = computed<string | null>(() => {
    const v = this.venta();
    if (!v) return null;
    if (estaAnulada(v)) return 'La factura está anulada.';
    if (this.auth.rol() !== ROL_ADMIN && !esDeHoy(v.fecha))
      return 'Solo un Administrador puede modificar facturas de días anteriores.';
    return null;
  });
  readonly accionLabel = accionLabel;
  readonly accionIcon = accionIcon;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly venta = signal<Venta | null>(null);

  readonly lineas = computed(() => this.venta()?.detallesVenta ?? []);
  /** Sum of quantity × unit price, before discounts. */
  readonly subtotal = computed(() =>
    this.lineas().reduce((a, d) => a + (d.cantidad ?? 0) * (d.precioVenta ?? 0), 0)
  );
  readonly totalIva = computed(() => (this.venta()?.totalIva5 ?? 0) + (this.venta()?.totalIva10 ?? 0));

  readonly formatGs = formatGs;
  readonly condicionLabel = condicionLabel;
  readonly numeroFactura = numeroFactura;
  readonly clienteNombre = clienteNombre;
  readonly vendedorNombre = vendedorNombre;

  ngOnInit(): void {
    if (history.state?.guardada) this.aviso.set('La factura se guardó correctamente.');
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isInteger(id) || id <= 0) {
        this.loading.set(false);
        this.error.set('El número de factura no es válido.');
        return;
      }
      this.cargar(id);
    });
  }

  cargar(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.obtener(id).subscribe({
      next: (v) => {
        this.venta.set(v);
        if (!v) this.error.set(`No existe la factura N.º ${numeroFactura(id)}.`);
        this.loading.set(false);
        if (v) this.cargarHistorial(v.id);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 404
            ? `No existe la factura N.º ${numeroFactura(id)}.`
            : e.status === 403
              ? 'Tu rol no tiene permiso para ver las ventas.'
              : 'No se pudo cargar la factura. Verificá que el backend esté levantado.'
        );
        this.loading.set(false);
      },
    });
  }

  reintentar(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id > 0) this.cargar(id);
  }

  importe(d: DetalleVenta): number {
    return (d.cantidad ?? 0) * (d.precioVenta ?? 0) - (d.descuento ?? 0);
  }

  /** Tax rate of a line, from which tax amount the backend filled in. */
  tasa(d: DetalleVenta): '10 %' | '5 %' | 'Exenta' {
    if ((d.iva10 ?? 0) > 0) return '10 %';
    if ((d.iva5 ?? 0) > 0) return '5 %';
    return 'Exenta';
  }

  imprimir(): void {
    window.print();
  }

  cargarHistorial(id: number): void {
    this.historialError.set(false);
    this.service.historial(id).subscribe({
      next: (h) => this.historial.set(h ?? []),
      error: () => {
        this.historial.set(null);
        this.historialError.set(true);
      },
    });
  }

  editar(): void {
    const v = this.venta();
    if (v && !this.bloqueo()) this.router.navigate(['/ventas', v.id, 'editar']);
  }

  anular(): void {
    const v = this.venta();
    if (!v || this.bloqueo()) return;
    this.dialog
      .open<AnularVentaDialogComponent, Venta, Venta>(AnularVentaDialogComponent, {
        data: v,
        width: '520px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((anulada) => {
        if (!anulada) return;
        this.venta.set(anulada);
        this.aviso.set(`La factura N.º ${numeroFactura(anulada.id)} quedó anulada.`);
        this.cargarHistorial(anulada.id);
      });
  }
}
