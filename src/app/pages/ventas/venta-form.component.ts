import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { Articulo, ivaIncluido, tasaLabel } from '../../core/models/articulo.model';
import { Cliente } from '../../core/models/cliente.model';
import {
  CondicionVenta,
  Venta,
  VentaInput,
  esDeHoy,
  estaAnulada,
  numeroFactura,
} from '../../core/models/venta.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { ClienteService } from '../../core/services/cliente.service';
import { VentaService } from '../../core/services/venta.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROL_ADMIN } from '../../core/auth/permisos';
import { mensajeError } from '../../core/http-error';
import { formatGs } from '../../core/format';
import { ClienteFormDialogComponent, ClienteFormData } from '../clientes/cliente-form-dialog.component';

interface Linea {
  articulo: Articulo;
  cantidad: number;
  precio: number;
  descuento: number;
}

/** New sale (/ventas/nueva) and edit (/ventas/:id/editar). */
@Component({
  selector: 'app-venta-form',
  standalone: true,
  imports: [MaterialModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './venta-form.component.html',
  styleUrls: ['./venta-form.component.scss'],
})
export class VentaFormComponent implements OnInit {
  private readonly ventas = inject(VentaService);
  private readonly articulosService = inject(ArticuloService);
  private readonly clientesService = inject(ClienteService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly esAdmin = computed(() => this.auth.rol() === ROL_ADMIN);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Why the sale being edited cannot be changed by this user (shown instead of the form). */
  readonly bloqueo = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly errorGuardar = signal<string | null>(null);

  readonly clientes = signal<Cliente[]>([]);
  readonly articulos = signal<Articulo[]>([]);
  readonly original = signal<Venta | null>(null);

  readonly cliente = signal<Cliente | null>(null);
  readonly condicion = signal<CondicionVenta>('CON');
  readonly lineas = signal<Linea[]>([]);

  /** Text typed in the client / article search boxes. */
  readonly busquedaCliente = signal('');
  readonly busquedaArticulo = signal('');

  readonly clientesFiltrados = computed(() => {
    const q = this.normalize(this.busquedaCliente());
    const lista = this.clientes();
    const res = q
      ? lista.filter((c) => this.normalize(`${c.nombres} ${c.apellidos} ${c.ciRuc}`).includes(q))
      : lista;
    return res.slice(0, 30);
  });

  readonly articulosFiltrados = computed(() => {
    const q = this.normalize(this.busquedaArticulo());
    const lista = this.articulos();
    const res = q ? lista.filter((a) => this.normalize(`${a.nombre} ${a.descripcion ?? ''}`).includes(q)) : lista;
    return res.slice(0, 30);
  });

  readonly subtotal = computed(() => this.lineas().reduce((a, l) => a + l.cantidad * l.precio, 0));
  readonly totalDescuento = computed(() => this.lineas().reduce((a, l) => a + (l.descuento || 0), 0));
  readonly total = computed(() => this.lineas().reduce((a, l) => a + this.importe(l), 0));
  readonly iva10 = computed(() =>
    this.lineas().reduce((a, l) => a + (l.articulo.tasaIva === 10 ? ivaIncluido(this.importe(l), 10) : 0), 0)
  );
  readonly iva5 = computed(() =>
    this.lineas().reduce((a, l) => a + (l.articulo.tasaIva === 5 ? ivaIncluido(this.importe(l), 5) : 0), 0)
  );
  readonly unidades = computed(() => this.lineas().reduce((a, l) => a + l.cantidad, 0));

  /** First problem that blocks saving, or null. */
  readonly problema = computed<string | null>(() => {
    const ls = this.lineas();
    if (ls.length === 0) return 'Agregá al menos un artículo.';
    for (const l of ls) {
      const nombre = l.articulo.nombre.trim();
      if (!Number.isInteger(l.cantidad) || l.cantidad < 1) return `La cantidad de "${nombre}" tiene que ser 1 o más.`;
      if (!(l.precio >= 0)) return `El precio de "${nombre}" no es válido.`;
      if (!(l.descuento >= 0) || l.descuento > l.cantidad * l.precio)
        return `El descuento de "${nombre}" tiene que estar entre 0 y el importe de la línea.`;
    }
    if (this.condicion() === 'CRE' && !this.cliente()) return 'Para vender a crédito elegí un cliente.';
    return null;
  });

  readonly editando = computed(() => this.original() !== null);
  readonly formatGs = formatGs;
  readonly tasaLabel = tasaLabel;
  readonly numeroFactura = numeroFactura;

  private id: number | null = null;

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    this.id = raw ? Number(raw) : null;
    if (raw && (!Number.isInteger(this.id) || this.id! <= 0)) {
      this.loading.set(false);
      this.error.set('El número de factura no es válido.');
      return;
    }
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      clientes: this.clientesService.listar(),
      articulos: this.articulosService.listar(),
      venta: this.id ? this.ventas.obtener(this.id) : of(null),
    }).subscribe({
      next: ({ clientes, articulos, venta }) => {
        const porNombre = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });
        this.clientes.set(
          [...(clientes ?? [])].sort((a, b) => porNombre(`${a.apellidos} ${a.nombres}`, `${b.apellidos} ${b.nombres}`))
        );
        this.articulos.set([...(articulos ?? [])].sort((a, b) => porNombre(a.nombre, b.nombre)));
        if (this.id) {
          if (!venta) {
            this.error.set(`No existe la factura N.º ${numeroFactura(this.id)}.`);
          } else {
            this.cargarVenta(venta);
          }
        }
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 404 && this.id
            ? `No existe la factura N.º ${numeroFactura(this.id)}.`
            : e.status === 403
              ? 'Tu rol no tiene permiso para cargar ventas.'
              : 'No se pudieron cargar los datos. Verificá que el backend esté levantado.'
        );
        this.loading.set(false);
      },
    });
  }

  private cargarVenta(v: Venta): void {
    this.original.set(v);
    if (estaAnulada(v)) {
      this.bloqueo.set('Esta factura está anulada y ya no se puede editar.');
    } else if (!this.esAdmin() && !esDeHoy(v.fecha)) {
      this.bloqueo.set('Solo un Administrador puede editar facturas de días anteriores.');
    }
    this.condicion.set(v.condicionVenta);
    this.cliente.set(v.cliente ? (this.clientes().find((c) => c.id === v.cliente!.id) ?? v.cliente) : null);
    this.busquedaCliente.set(this.cliente() ? this.clienteTexto(this.cliente()!) : '');
    this.lineas.set(
      (v.detallesVenta ?? []).map((d) => ({
        articulo:
          this.articulos().find((a) => a.id === d.articulo.id) ??
          ({ ...d.articulo, precio: d.precioVenta, tasaIva: d.iva10 > 0 ? 10 : d.iva5 > 0 ? 5 : 0 } as Articulo),
        cantidad: d.cantidad,
        precio: d.precioVenta,
        descuento: d.descuento ?? 0,
      }))
    );
  }

  // --- Client ---------------------------------------------------------------------------------

  clienteTexto(c: Cliente | null): string {
    return c ? `${c.nombres.trim()} ${c.apellidos.trim()} · ${c.ciRuc}` : '';
  }

  elegirCliente(e: MatAutocompleteSelectedEvent): void {
    const c = e.option.value as Cliente;
    this.cliente.set(c);
    this.busquedaCliente.set(this.clienteTexto(c));
  }

  onBusquedaCliente(texto: string): void {
    this.busquedaCliente.set(texto);
    // Typing again un-selects the client until one is picked from the list.
    if (this.cliente() && texto !== this.clienteTexto(this.cliente())) this.cliente.set(null);
  }

  quitarCliente(): void {
    this.cliente.set(null);
    this.busquedaCliente.set('');
  }

  nuevoCliente(): void {
    this.dialog
      .open<ClienteFormDialogComponent, ClienteFormData, Cliente>(ClienteFormDialogComponent, {
        data: {},
        width: '560px',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((creado) => {
        if (!creado) return;
        this.clientes.update((l) => [creado, ...l]);
        this.cliente.set(creado);
        this.busquedaCliente.set(this.clienteTexto(creado));
      });
  }

  // --- Lines ----------------------------------------------------------------------------------

  agregarArticulo(e: MatAutocompleteSelectedEvent, input: HTMLInputElement): void {
    const a = e.option.value as Articulo;
    const existente = this.lineas().findIndex((l) => l.articulo.id === a.id);
    if (existente >= 0) {
      this.cambiar(existente, 'cantidad', this.lineas()[existente].cantidad + 1);
    } else {
      this.lineas.update((ls) => [...ls, { articulo: a, cantidad: 1, precio: Number(a.precio) || 0, descuento: 0 }]);
    }
    this.busquedaArticulo.set('');
    input.value = '';
  }

  cambiar(i: number, campo: 'cantidad' | 'precio' | 'descuento', valor: number | string | null): void {
    const n = valor === null || valor === '' ? 0 : Number(valor);
    this.lineas.update((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: Number.isFinite(n) ? n : 0 } : l)));
  }

  quitar(i: number): void {
    this.lineas.update((ls) => ls.filter((_, j) => j !== i));
  }

  importe(l: Linea): number {
    return l.cantidad * l.precio - (l.descuento || 0);
  }

  precioCambiado(l: Linea): boolean {
    return Number(l.precio) !== Number(l.articulo.precio);
  }

  // --- Save -----------------------------------------------------------------------------------

  guardar(): void {
    if (this.problema() || this.guardando() || this.bloqueo()) return;
    const body: VentaInput = {
      condicionVenta: this.condicion(),
      cliente: this.cliente() ? { id: this.cliente()!.id } : null,
      detallesVenta: this.lineas().map((l) => ({
        articulo: { id: l.articulo.id },
        cantidad: l.cantidad,
        precioVenta: l.precio,
        descuento: l.descuento || 0,
      })),
    };
    this.guardando.set(true);
    this.errorGuardar.set(null);
    const req = this.original() ? this.ventas.actualizar(this.original()!.id, body) : this.ventas.crear(body);
    req.subscribe({
      next: (v) => this.router.navigate(['/ventas', v.id], { state: { guardada: true } }),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorGuardar.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para guardar ventas.'
            : mensajeError(e, 'No se pudo guardar la venta.')
        );
      },
    });
  }

  cancelar(): void {
    this.router.navigate(this.original() ? ['/ventas', this.original()!.id] : ['/ventas']);
  }

  private normalize(s: string): string {
    return (s ?? '')
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }
}
