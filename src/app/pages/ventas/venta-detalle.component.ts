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
import { ROL_ADMIN, ROLES_COBROS, puedeVender } from '../../core/auth/permisos';
import { Cobro, formaPagoIcon, formaPagoLabel, numeroRecibo } from '../../core/models/cobro.model';
import { CobroService } from '../../core/services/cobro.service';
import { CobroDialogComponent, CobroDialogData } from '../cobros/cobro-dialog.component';
import { AnularCobroDialogComponent } from '../cobros/anular-cobro-dialog.component';
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
  private readonly cobroService = inject(CobroService);

  /** Payments of a credit sale (cancelled ones included); null while loading. */
  readonly cobros = signal<Cobro[] | null>(null);
  readonly cobrosError = signal(false);
  readonly puedeCobrar = computed(() => ROLES_COBROS.includes(this.auth.rol()));
  readonly esCredito = computed(() => this.venta()?.condicionVenta === 'CRE');
  readonly saldo = computed(() => this.venta()?.saldo ?? 0);
  /** Why the sale cannot be cancelled: the general block, or payments that would be left hanging. */
  readonly bloqueoAnular = computed<string | null>(() => {
    const b = this.bloqueo();
    if (b) return b;
    const cobrado = this.venta()?.cobrado ?? 0;
    return cobrado > 0 ? `Tiene cobros por ${formatGs(cobrado)}: anulá primero los cobros.` : null;
  });
  readonly formaPagoLabel = formaPagoLabel;
  readonly formaPagoIcon = formaPagoIcon;
  readonly numeroRecibo = numeroRecibo;

  readonly historial = signal<Auditoria[] | null>(null);
  readonly historialError = signal(false);
  /** Shown once after saving or cancelling. */
  readonly aviso = signal<string | null>(null);
  /** Payment just registered, to offer printing its receipt from the notice. */
  readonly avisoCobroId = signal<number | null>(null);

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
        if (v?.condicionVenta === 'CRE') this.cargarCobros(v.id);
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

  cargarCobros(id: number): void {
    this.cobrosError.set(false);
    this.cobroService.porVenta(id).subscribe({
      next: (l) => this.cobros.set(l ?? []),
      error: () => {
        this.cobros.set(null);
        this.cobrosError.set(true);
      },
    });
  }

  /** A cashier may only cancel payments of today, like sales. */
  puedeAnularCobro(c: Cobro): boolean {
    return this.puedeCobrar() && c.estado === 'VIGENTE' && (this.auth.rol() === ROL_ADMIN || esDeHoy(c.fecha));
  }

  registrarCobro(): void {
    const v = this.venta();
    if (!v || this.saldo() <= 0) return;
    const data: CobroDialogData = {
      ventaId: v.id,
      cliente: clienteNombre(v),
      total: v.totalFactura,
      cobrado: v.cobrado ?? 0,
      saldo: this.saldo(),
    };
    this.dialog
      .open(CobroDialogComponent, { data, width: '520px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((c) => {
        if (!c) return;
        const quedo = this.saldo() - c.monto;
        this.avisoCobroId.set(c.id);
        this.aviso.set(
          `Se registró el cobro de ${formatGs(c.monto)}. ` +
            (quedo <= 0 ? 'La factura quedó pagada.' : `Queda debiendo ${formatGs(quedo)}.`)
        );
        this.recargarCobro(v.id);
      });
  }

  anularCobro(c: Cobro): void {
    if (!this.puedeAnularCobro(c)) return;
    this.dialog
      .open(AnularCobroDialogComponent, { data: c, width: '520px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((anulado) => {
        if (!anulado) return;
        this.avisoCobroId.set(null);
        this.aviso.set(`El cobro de ${formatGs(anulado.monto)} quedó anulado y volvió al saldo.`);
        this.recargarCobro(c.ventaId);
      });
  }

  /** After a payment changes: the sale's balance and its list of payments. */
  private recargarCobro(id: number): void {
    this.service.obtener(id).subscribe({ next: (v) => v && this.venta.set(v) });
    this.cargarCobros(id);
  }

  editar(): void {
    const v = this.venta();
    if (v && !this.bloqueo()) this.router.navigate(['/ventas', v.id, 'editar']);
  }

  anular(): void {
    const v = this.venta();
    if (!v || this.bloqueoAnular()) return;
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
