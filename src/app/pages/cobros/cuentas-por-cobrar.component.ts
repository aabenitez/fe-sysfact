import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { CuentaPorCobrar, textoVencimiento } from '../../core/models/cobro.model';
import { numeroFactura } from '../../core/models/venta.model';
import { CobroService } from '../../core/services/cobro.service';
import { formatGs } from '../../core/format';
import { CobroDialogComponent, CobroDialogData } from './cobro-dialog.component';

/** Credit sales of one client (or of sales without a client) that still owe something. */
interface Deudor {
  clave: string;
  nombre: string;
  ciRuc: string | null;
  telefono: string | null;
  cuentas: CuentaPorCobrar[];
  saldo: number;
  vencido: number;
  /** Worst days past due among its sales. */
  maxAtraso: number;
}

/** Accounts receivable: what each client still owes, oldest sales first. */
@Component({
  selector: 'app-cuentas-por-cobrar',
  standalone: true,
  imports: [MaterialModule, RouterModule, FormsModule, DatePipe],
  templateUrl: './cuentas-por-cobrar.component.html',
  styleUrls: ['./cuentas-por-cobrar.component.scss'],
})
export class CuentasPorCobrarComponent implements OnInit {
  private readonly service = inject(CobroService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly cuentas = signal<CuentaPorCobrar[]>([]);
  readonly aviso = signal<string | null>(null);

  readonly texto = signal('');
  readonly soloVencidas = signal(false);

  readonly formatGs = formatGs;
  readonly numeroFactura = numeroFactura;
  readonly textoVencimiento = textoVencimiento;

  readonly totalSaldo = computed(() => this.cuentas().reduce((a, c) => a + c.saldo, 0));
  readonly totalVencido = computed(() =>
    this.cuentas().filter((c) => c.diasAtraso > 0).reduce((a, c) => a + c.saldo, 0)
  );

  /** Clients with a balance, the most overdue first, then the largest balance. */
  readonly deudores = computed<Deudor[]>(() => {
    const m = new Map<string, Deudor>();
    for (const c of this.cuentas()) {
      const clave = c.cliente ? `c${c.cliente.id}` : 'sin';
      let d = m.get(clave);
      if (!d) {
        d = {
          clave,
          nombre: c.cliente ? `${(c.cliente.nombres ?? '').trim()} ${(c.cliente.apellidos ?? '').trim()}`.trim() : 'Sin cliente',
          ciRuc: c.cliente?.ciRuc ?? null,
          telefono: c.cliente?.telefono ?? null,
          cuentas: [],
          saldo: 0,
          vencido: 0,
          maxAtraso: 0,
        };
        m.set(clave, d);
      }
      d.cuentas.push(c);
      d.saldo += c.saldo;
      if (c.diasAtraso > 0) d.vencido += c.saldo;
      d.maxAtraso = Math.max(d.maxAtraso, c.diasAtraso);
    }
    return [...m.values()].sort((a, b) => b.maxAtraso - a.maxAtraso || b.saldo - a.saldo);
  });

  readonly filtrados = computed(() => {
    const t = this.texto().trim().toLocaleLowerCase('es');
    const vencidas = this.soloVencidas();
    return this.deudores()
      .filter((d) => !vencidas || d.vencido > 0)
      .filter(
        (d) =>
          !t ||
          d.nombre.toLocaleLowerCase('es').includes(t) ||
          (d.ciRuc ?? '').toLocaleLowerCase('es').includes(t) ||
          d.cuentas.some((c) => numeroFactura(c.ventaId).includes(t))
      );
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.pendientes().subscribe({
      next: (l) => {
        this.cuentas.set(l ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  cobrar(d: Deudor, c: CuentaPorCobrar): void {
    const data: CobroDialogData = { ventaId: c.ventaId, cliente: d.nombre, total: c.total, cobrado: c.cobrado, saldo: c.saldo };
    this.dialog
      .open(CobroDialogComponent, { data, width: '520px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((cobro) => {
        if (!cobro) return;
        const quedo = c.saldo - cobro.monto;
        this.aviso.set(
          `Se registró el cobro de ${formatGs(cobro.monto)} de la factura N.º ${numeroFactura(c.ventaId)}. ` +
            (quedo <= 0 ? 'La factura quedó pagada.' : `Queda debiendo ${formatGs(quedo)}.`)
        );
        this.cargar();
      });
  }

  limpiar(): void {
    this.texto.set('');
    this.soloVencidas.set(false);
  }
}
