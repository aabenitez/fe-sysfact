import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { API_URL } from '../../core/api.config';
import { AuthService } from '../../core/auth/auth.service';
import { formatGs } from '../../core/format';
import { ROLES_CATALOGO } from '../../core/auth/permisos';
import { Articulo, cantidadConUnidad, estadoStock } from '../../core/models/articulo.model';
import { ArticuloThumbComponent } from '../../core/ui/articulo-thumb.component';
import { StockDialogComponent, StockDialogData } from '../articulos/stock-dialog.component';

/** How many low-stock articles the home page lists. */
const POCO_STOCK_MAX = 6;

/** Pages only the catalog roles may open (see app.routes.ts). */
const RUTAS_CATALOGO = ['/proveedores', '/unidades-de-medida', '/parametros'];

interface Venta {
  id: number;
  condicionVenta: string;
  fecha: string;
  totalFactura: number;
  estado?: string;
  cliente?: { nombres: string; apellidos: string; ciRuc?: string } | null;
}

interface Kpi {
  label: string;
  value: number | null;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'neutral' | 'accent';
  hint: string;
  /** Page the card opens when clicked (only for sections that already exist). */
  route?: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [MaterialModule, RouterModule, DatePipe, NgTemplateOutlet, ArticuloThumbComponent],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss'],
})
export class InicioComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  readonly auth = inject(AuthService);

  /** Articles at or below their minimum stock, lowest first; null when articles could not be read. */
  readonly pocoStock = signal<Articulo[] | null>(null);
  readonly pocoStockTotal = signal(0);
  readonly estadoStock = estadoStock;
  readonly cantidadConUnidad = cantidadConUnidad;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly kpis = signal<Kpi[]>([]);
  readonly ventas = signal<Venta[]>([]);
  readonly totalVendido = signal(0);

  readonly today = new Date();
  readonly greeting = computed(() => {
    const h = this.today.getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  });

  ngOnInit(): void {
    const get = <T>(path: string) =>
      this.http.get<T[]>(`${API_URL}/${path}`).pipe(catchError(() => of(null)));

    forkJoin({
      clientes: get<unknown>('clientes'),
      articulos: get<Articulo>('articulos'),
      ventas: get<Venta>('ventas'),
      unidades: get<unknown>('unidades-de-medida'),
      parametros: get<unknown>('parametros'),
      proveedores: get<unknown>('proveedores'),
    }).subscribe((r) => {
      // Cancelled sales do not count.
      const ventas = (r.ventas ?? []).filter((v) => v.estado !== 'ANULADA');
      this.loadError.set(Object.values(r).every((v) => v === null));
      this.totalVendido.set(ventas.reduce((acc, v) => acc + (v.totalFactura ?? 0), 0));
      this.ventas.set(ventas.slice(0, 5));
      this.mostrarPocoStock(r.articulos);
      const kpis: Kpi[] = [
        { label: 'Ventas', value: r.ventas ? ventas.length : null, icon: 'solar:cart-large-2-line-duotone', tone: 'primary', hint: 'facturas emitidas', route: '/ventas' },
        { label: 'Clientes', value: r.clientes?.length ?? null, icon: 'solar:users-group-rounded-line-duotone', tone: 'success', hint: 'registrados', route: '/clientes' },
        { label: 'Artículos', value: r.articulos?.length ?? null, icon: 'solar:box-line-duotone', tone: 'warning', hint: 'en catálogo', route: '/articulos' },
        { label: 'Proveedores', value: r.proveedores?.length ?? null, icon: 'solar:delivery-line-duotone', tone: 'accent', hint: 'registrados', route: '/proveedores' },
        { label: 'Unidades de medida', value: r.unidades?.length ?? null, icon: 'solar:ruler-line-duotone', tone: 'info', hint: 'configuradas', route: '/unidades-de-medida' },
        { label: 'Parámetros', value: r.parametros?.length ?? null, icon: 'solar:settings-line-duotone', tone: 'neutral', hint: 'del sistema', route: '/parametros' },
      ];
      const veCatalogo = ROLES_CATALOGO.includes(this.auth.rol());
      this.kpis.set(
        kpis.filter(
          (k) => (k.value !== null || this.loadError()) && (veCatalogo || !RUTAS_CATALOGO.includes(k.route ?? ''))
        )
      );
      this.loading.set(false);
    });
  }

  private mostrarPocoStock(articulos: Articulo[] | null): void {
    if (!articulos) {
      this.pocoStock.set(null);
      return;
    }
    const bajos = articulos
      .filter((a) => estadoStock(a) !== 'ok')
      .sort((a, b) => (a.existencia ?? 0) - (b.existencia ?? 0) || a.nombre.localeCompare(b.nombre, 'es'));
    this.pocoStockTotal.set(bajos.length);
    this.pocoStock.set(bajos.slice(0, POCO_STOCK_MAX));
  }

  verStock(a: Articulo): void {
    const data: StockDialogData = { articulo: a, alCambiar: () => this.recargarStock() };
    this.dialog.open(StockDialogComponent, { data, width: '640px', maxWidth: '95vw', autoFocus: false });
  }

  private recargarStock(): void {
    this.http
      .get<Articulo[]>(`${API_URL}/articulos`)
      .pipe(catchError(() => of(null)))
      .subscribe((l) => this.mostrarPocoStock(l));
  }

  money(value: number): string {
    return formatGs(value);
  }

  condicion(c: string): string {
    return c === 'CON' ? 'Contado' : c === 'CRE' ? 'Crédito' : c;
  }

  clienteNombre(v: Venta): string {
    return v.cliente ? `${v.cliente.nombres} ${v.cliente.apellidos}`.trim() : 'Sin cliente';
  }
}
