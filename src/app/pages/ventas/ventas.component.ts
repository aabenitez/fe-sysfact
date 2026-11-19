import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from '../../material.module';
import {
  Venta,
  clienteNombre,
  condicionLabel,
  numeroFactura,
  vendedorNombre,
} from '../../core/models/venta.model';
import { VentaService } from '../../core/services/venta.service';
import { formatGs } from '../../core/format';
import { AuthService } from '../../core/auth/auth.service';
import { puedeVender } from '../../core/auth/permisos';

type Condicion = '' | 'CON' | 'CRE';
type Estado = '' | 'EMITIDA' | 'ANULADA';
type Periodo = '' | 'hoy' | '7d' | '30d' | 'mes' | 'mes-anterior' | 'anio';

interface VentaFila extends Venta {
  numero: string;
  clienteTexto: string;
  vendedorTexto: string;
  items: number;
  unidades: number;
  fechaMs: number;
  anulada: boolean;
}

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [MaterialModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './ventas.component.html',
  styleUrls: ['./ventas.component.scss'],
})
export class VentasComponent implements OnInit {
  private readonly service = inject(VentaService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly puedeVender = computed(() => puedeVender(this.auth.rol()));

  readonly columns = ['numero', 'fecha', 'cliente', 'condicion', 'items', 'total'];
  readonly dataSource = new MatTableDataSource<VentaFila>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly ventas = signal<VentaFila[]>([]);
  /** Rows that pass the current filters; the summary cards follow them. */
  readonly filtradas = signal<VentaFila[]>([]);

  search = '';
  condicion: Condicion = '';
  /** Roles that manage sales (Administrador, Cajero) see issued and cancelled ones by default; others only issued. */
  estado: Estado = this.estadoPorDefecto();
  periodo: Periodo = '';

  readonly periodos: { value: Periodo; label: string }[] = [
    { value: '', label: 'Todo el período' },
    { value: 'hoy', label: 'Hoy' },
    { value: '7d', label: 'Últimos 7 días' },
    { value: '30d', label: 'Últimos 30 días' },
    { value: 'mes', label: 'Este mes' },
    { value: 'mes-anterior', label: 'Mes anterior' },
    { value: 'anio', label: 'Este año' },
  ];

  /** Filtered sales that count: cancelled ones never add to the totals. */
  readonly vigentes = computed(() => this.filtradas().filter((v) => !v.anulada));
  readonly anuladas = computed(() => this.filtradas().length - this.vigentes().length);

  readonly totalFacturado = computed(() =>
    this.vigentes().reduce((acc, v) => acc + (v.totalFactura ?? 0), 0)
  );
  readonly ticketPromedio = computed(() =>
    this.vigentes().length ? this.totalFacturado() / this.vigentes().length : 0
  );
  readonly totalContado = computed(() =>
    this.vigentes().filter((v) => v.condicionVenta === 'CON').reduce((a, v) => a + (v.totalFactura ?? 0), 0)
  );
  readonly totalCredito = computed(() =>
    this.vigentes().filter((v) => v.condicionVenta === 'CRE').reduce((a, v) => a + (v.totalFactura ?? 0), 0)
  );
  readonly totalIva = computed(() =>
    this.vigentes().reduce((a, v) => a + (v.totalIva5 ?? 0) + (v.totalIva10 ?? 0), 0)
  );
  /** Share of cash sales, 0–100, for the split bar. */
  readonly porcentajeContado = computed(() => {
    const total = this.totalContado() + this.totalCredito();
    return total ? Math.round((this.totalContado() / total) * 100) : 0;
  });
  readonly hayFiltros = computed(() => this.filtradas().length !== this.ventas().length);

  readonly formatGs = formatGs;
  readonly condicionLabel = condicionLabel;

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (v, col) => {
      switch (col) {
        case 'numero':
          return v.id;
        case 'cliente':
          return v.clienteTexto.toLocaleLowerCase('es');
        case 'condicion':
          return v.condicionVenta ?? '';
        case 'items':
          return v.unidades;
        case 'total':
          return v.totalFactura ?? 0;
        default:
          return v.fechaMs;
      }
    };

    this.dataSource.filterPredicate = (v, raw) => {
      const { text, condicion, estado, desde, hasta } = JSON.parse(raw) as {
        text: string;
        condicion: Condicion;
        estado: Estado;
        desde: number | null;
        hasta: number | null;
      };
      if (condicion && v.condicionVenta !== condicion) return false;
      if (estado === 'ANULADA' && !v.anulada) return false;
      if (estado === 'EMITIDA' && v.anulada) return false;
      if (desde !== null && v.fechaMs < desde) return false;
      if (hasta !== null && v.fechaMs >= hasta) return false;
      if (!text) return true;
      const articulos = (v.detallesVenta ?? []).map((d) => d.articulo?.nombre ?? '').join(' ');
      const haystack = this.normalize(
        [v.numero, String(v.id), v.clienteTexto, v.cliente?.ciRuc, v.vendedorTexto, articulos].join(' ')
      );
      return haystack.includes(text);
    };
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.listar().subscribe({
      next: (list) => {
        const filas: VentaFila[] = (list ?? []).map((v) => ({
          ...v,
          numero: numeroFactura(v.id),
          clienteTexto: clienteNombre(v),
          vendedorTexto: vendedorNombre(v),
          items: v.detallesVenta?.length ?? 0,
          unidades: (v.detallesVenta ?? []).reduce((a, d) => a + (d.cantidad ?? 0), 0),
          fechaMs: new Date(v.fecha).getTime(),
          anulada: v.estado === 'ANULADA',
        }));
        this.ventas.set(filas);
        this.dataSource.data = filas;
        this.applyFilter();
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para ver las ventas.'
            : 'Verificá que el backend esté levantado e intentá de nuevo.'
        );
        this.loading.set(false);
      },
    });
  }

  applyFilter(): void {
    const [desde, hasta] = this.rango(this.periodo);
    const filter = JSON.stringify({
      text: this.normalize(this.search.trim()),
      condicion: this.condicion,
      estado: this.estado,
      desde,
      hasta,
    });
    this.dataSource.filter = filter;
    this.dataSource.paginator?.firstPage();
    this.filtradas.set(this.dataSource.data.filter((v) => this.dataSource.filterPredicate(v, filter)));
  }

  limpiar(): void {
    this.search = '';
    this.condicion = '';
    this.estado = this.estadoPorDefecto();
    this.periodo = '';
    this.applyFilter();
  }

  private estadoPorDefecto(): Estado {
    return puedeVender(this.auth.rol()) ? '' : 'EMITIDA';
  }

  nueva(): void {
    this.router.navigate(['/ventas', 'nueva']);
  }

  abrir(v: VentaFila): void {
    this.router.navigate(['/ventas', v.id]);
  }

  iniciales(v: VentaFila): string {
    if (!v.cliente) return '—';
    return `${(v.cliente.nombres ?? '').trim().charAt(0)}${(v.cliente.apellidos ?? '').trim().charAt(0)}`.toUpperCase();
  }

  /** [from, to) in epoch ms for a period, in the browser's local time. */
  private rango(p: Periodo): [number | null, number | null] {
    const now = new Date();
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const manana = new Date(hoy.getTime());
    manana.setDate(manana.getDate() + 1);
    const diasAtras = (n: number) => {
      const d = new Date(hoy.getTime());
      d.setDate(d.getDate() - (n - 1));
      return d.getTime();
    };
    switch (p) {
      case 'hoy':
        return [hoy.getTime(), manana.getTime()];
      case '7d':
        return [diasAtras(7), manana.getTime()];
      case '30d':
        return [diasAtras(30), manana.getTime()];
      case 'mes':
        return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), manana.getTime()];
      case 'mes-anterior':
        return [
          new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
          new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        ];
      case 'anio':
        return [new Date(now.getFullYear(), 0, 1).getTime(), manana.getTime()];
      default:
        return [null, null];
    }
  }

  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
