import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { Venta, clienteNombre, numeroFactura } from '../../core/models/venta.model';
import { Cobro, formaPagoLabel, numeroRecibo } from '../../core/models/cobro.model';
import { VentaService } from '../../core/services/venta.service';
import { CobroService } from '../../core/services/cobro.service';
import { BrandingService } from '../../core/branding/branding.service';
import { formatGs } from '../../core/format';
import { numeroALetras } from '../../core/numero-letras';

/** Printable receipt of one payment of a credit sale (/ventas/:id/cobros/:cobroId/recibo). */
@Component({
  selector: 'app-recibo',
  standalone: true,
  imports: [MaterialModule, RouterModule, DatePipe],
  templateUrl: './recibo.component.html',
  styleUrls: ['./recibo.component.scss'],
})
export class ReciboComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ventas = inject(VentaService);
  private readonly cobros = inject(CobroService);
  readonly branding = inject(BrandingService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly venta = signal<Venta | null>(null);
  readonly cobro = signal<Cobro | null>(null);
  /** Valid payments of the sale, to work out the balance before and after this one. */
  private readonly todos = signal<Cobro[]>([]);

  readonly formatGs = formatGs;
  readonly numeroFactura = numeroFactura;
  readonly numeroRecibo = numeroRecibo;
  readonly clienteNombre = clienteNombre;
  readonly formaPagoLabel = formaPagoLabel;

  readonly anulado = computed(() => this.cobro()?.estado === 'ANULADO');
  /** What was owed just before this payment: the total minus the valid payments registered earlier. */
  readonly saldoAnterior = computed(() => {
    const v = this.venta();
    const c = this.cobro();
    if (!v || !c) return 0;
    const antes = this.todos()
      .filter((x) => x.estado === 'VIGENTE' && x.id < c.id)
      .reduce((a, x) => a + x.monto, 0);
    return Math.max(0, v.totalFactura - antes);
  });
  readonly saldoDespues = computed(() => Math.max(0, this.saldoAnterior() - (this.cobro()?.monto ?? 0)));
  /** "quince mil", capitalised where it starts a sentence in the template. */
  readonly montoEnLetras = computed(() => numeroALetras(this.cobro()?.monto ?? 0));

  ngOnInit(): void {
    const ventaId = Number(this.route.snapshot.paramMap.get('id'));
    const cobroId = Number(this.route.snapshot.paramMap.get('cobroId'));
    if (!(ventaId > 0) || !(cobroId > 0)) {
      this.loading.set(false);
      this.error.set('El recibo pedido no es válido.');
      return;
    }
    forkJoin({ venta: this.ventas.obtener(ventaId), cobros: this.cobros.porVenta(ventaId) }).subscribe({
      next: ({ venta, cobros }) => {
        const c = (cobros ?? []).find((x) => x.id === cobroId) ?? null;
        this.venta.set(venta);
        this.todos.set(cobros ?? []);
        this.cobro.set(c);
        if (!venta || !c) this.error.set(`No existe el recibo N.º ${numeroRecibo(cobroId)} de esa factura.`);
        this.loading.set(false);
        // Opened from "Imprimir recibo": print as soon as it is on screen.
        if (venta && c && this.route.snapshot.queryParamMap.get('imprimir') === '1') {
          setTimeout(() => window.print(), 400);
        }
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 404
            ? `No existe la factura N.º ${numeroFactura(ventaId)}.`
            : 'No se pudo cargar el recibo. Verificá que el backend esté levantado.'
        );
        this.loading.set(false);
      },
    });
  }

  imprimir(): void {
    window.print();
  }

  mayuscula(s: string): string {
    return s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
  }
}
