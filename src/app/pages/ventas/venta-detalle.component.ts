import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MaterialModule } from '../../material.module';
import {
  DetalleVenta,
  Venta,
  clienteNombre,
  condicionLabel,
  numeroFactura,
  vendedorNombre,
} from '../../core/models/venta.model';
import { VentaService } from '../../core/services/venta.service';
import { BrandingService } from '../../core/branding/branding.service';
import { formatGs } from '../../core/format';

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
}
