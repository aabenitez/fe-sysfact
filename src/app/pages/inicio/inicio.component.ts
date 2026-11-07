import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { API_URL } from '../../core/api.config';
import { AuthService } from '../../core/auth/auth.service';

interface Venta {
  id: number;
  condicionVenta: string;
  fecha: string;
  totalFactura: number;
  cliente?: { nombres: string; apellidos: string; ciRuc?: string } | null;
}

interface Kpi {
  label: string;
  value: number | null;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'info';
  hint: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [MaterialModule, RouterModule, DatePipe],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss'],
})
export class InicioComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);

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

  private readonly gs = new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  });

  ngOnInit(): void {
    const get = <T>(path: string) =>
      this.http.get<T[]>(`${API_URL}/${path}`).pipe(catchError(() => of(null)));

    forkJoin({
      clientes: get<unknown>('clientes'),
      articulos: get<unknown>('articulos'),
      ventas: get<Venta>('ventas'),
      unidades: get<unknown>('unidades-de-medida'),
    }).subscribe((r) => {
      const ventas = r.ventas ?? [];
      this.loadError.set(Object.values(r).every((v) => v === null));
      this.totalVendido.set(ventas.reduce((acc, v) => acc + (v.totalFactura ?? 0), 0));
      this.ventas.set(ventas.slice(0, 5));
      this.kpis.set([
        { label: 'Ventas', value: r.ventas?.length ?? null, icon: 'solar:cart-large-2-line-duotone', tone: 'primary', hint: 'facturas emitidas' },
        { label: 'Clientes', value: r.clientes?.length ?? null, icon: 'solar:users-group-rounded-line-duotone', tone: 'success', hint: 'registrados' },
        { label: 'Artículos', value: r.articulos?.length ?? null, icon: 'solar:box-line-duotone', tone: 'warning', hint: 'en catálogo' },
        { label: 'Unidades de medida', value: r.unidades?.length ?? null, icon: 'solar:ruler-line-duotone', tone: 'info', hint: 'configuradas' },
      ]);
      this.loading.set(false);
    });
  }

  money(value: number): string {
    return this.gs.format(value ?? 0);
  }

  condicion(c: string): string {
    return c === 'CON' ? 'Contado' : c === 'CRE' ? 'Crédito' : c;
  }

  clienteNombre(v: Venta): string {
    return v.cliente ? `${v.cliente.nombres} ${v.cliente.apellidos}`.trim() : 'Sin cliente';
  }
}
