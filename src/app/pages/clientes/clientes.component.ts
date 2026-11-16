import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { Cliente, VentaResumen } from '../../core/models/cliente.model';
import { ClienteService } from '../../core/services/cliente.service';
import { AuthService } from '../../core/auth/auth.service';
import { formatGs } from '../../core/format';
import { mensajeError } from '../../core/http-error';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../core/ui/confirm-dialog.component';
import { ClienteFormData, ClienteFormDialogComponent } from './cliente-form-dialog.component';

type Filtro = '' | 'con-compras' | 'sin-compras' | 'sin-email';

/** A client plus their purchases (compras is null when sales could not be loaded). */
interface ClienteFila extends Cliente {
  nombreCompleto: string;
  compras: number | null;
  totalComprado: number;
  ultimaCompra: string | null;
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [MaterialModule, FormsModule, DatePipe],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss'],
})
export class ClientesComponent implements OnInit {
  private readonly service = inject(ClienteService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  /** Only Administrators can create, edit or delete (the backend enforces it too). */
  readonly isAdmin = computed(() => this.auth.user()?.rol?.nombre === 'Administrador');
  readonly columns = computed(() =>
    ['nombre', 'ciRuc', 'contacto', 'compras'].concat(this.isAdmin() ? ['acciones'] : [])
  );
  readonly eliminando = signal<number | null>(null);
  readonly dataSource = new MatTableDataSource<ClienteFila>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly clientes = signal<ClienteFila[]>([]);
  /** False when /ventas failed: purchase columns and stats are then unknown. */
  readonly ventasDisponibles = signal(true);
  readonly visibles = signal(0);

  search = '';
  filtro: Filtro = '';

  readonly conCompras = computed(() => this.clientes().filter((c) => (c.compras ?? 0) > 0).length);
  readonly sinEmail = computed(() => this.clientes().filter((c) => !c.email?.trim()).length);
  readonly mejorCliente = computed(() => {
    const top = [...this.clientes()].sort((a, b) => b.totalComprado - a.totalComprado)[0];
    return top && top.totalComprado > 0 ? top : null;
  });

  readonly formatGs = formatGs;

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (c, col) => {
      switch (col) {
        case 'ciRuc':
          return c.ciRuc ?? '';
        case 'contacto':
          return (c.email ?? '').toLocaleLowerCase('es');
        case 'compras':
          return c.totalComprado;
        default:
          // Sort by surname, then first names.
          return `${c.apellidos} ${c.nombres}`.trim().toLocaleLowerCase('es');
      }
    };

    this.dataSource.filterPredicate = (c, raw) => {
      const { text, filtro } = JSON.parse(raw) as { text: string; filtro: Filtro };
      if (filtro === 'con-compras' && !((c.compras ?? 0) > 0)) return false;
      if (filtro === 'sin-compras' && (c.compras ?? 0) > 0) return false;
      if (filtro === 'sin-email' && c.email?.trim()) return false;
      if (!text) return true;
      const haystack = this.normalize(
        [c.nombreCompleto, c.ciRuc, c.email, c.telefono].join(' ')
      );
      // Also match phone and CI/RUC numbers typed without spaces, dots or dashes.
      const digits = text.replace(/\D/g, '');
      return (
        haystack.includes(text) ||
        (digits.length >= 3 && `${c.ciRuc}${c.telefono}`.replace(/\D/g, '').includes(digits))
      );
    };
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      clientes: this.service.listar(),
      // Purchase info is a bonus: the list still works if sales can't be loaded.
      ventas: this.service.ventas().pipe(catchError(() => of(null as VentaResumen[] | null))),
    }).subscribe({
      next: ({ clientes, ventas }) => {
        const porCliente = new Map<number, { n: number; total: number; ultima: string | null }>();
        for (const v of ventas ?? []) {
          const id = v.cliente?.id;
          if (id == null) continue;
          const acc = porCliente.get(id) ?? { n: 0, total: 0, ultima: null };
          acc.n += 1;
          acc.total += v.totalFactura ?? 0;
          if (!acc.ultima || v.fecha > acc.ultima) acc.ultima = v.fecha;
          porCliente.set(id, acc);
        }
        const filas: ClienteFila[] = (clientes ?? []).map((c) => {
          const nombres = (c.nombres ?? '').trim();
          const apellidos = (c.apellidos ?? '').trim();
          const compras = porCliente.get(c.id);
          return {
            ...c,
            nombres,
            apellidos,
            nombreCompleto: `${nombres} ${apellidos}`.trim(),
            compras: ventas ? compras?.n ?? 0 : null,
            totalComprado: compras?.total ?? 0,
            ultimaCompra: compras?.ultima ?? null,
          };
        });
        this.ventasDisponibles.set(ventas !== null);
        this.clientes.set(filas);
        this.dataSource.data = filas;
        this.applyFilter();
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para ver los clientes.'
            : 'Verificá que el backend esté levantado e intentá de nuevo.'
        );
        this.loading.set(false);
      },
    });
  }

  applyFilter(): void {
    const filter = JSON.stringify({ text: this.normalize(this.search.trim()), filtro: this.filtro });
    this.dataSource.filter = filter;
    this.dataSource.paginator?.firstPage();
    this.visibles.set(
      this.dataSource.data.filter((c) => this.dataSource.filterPredicate(c, filter)).length
    );
  }

  limpiar(): void {
    this.search = '';
    this.filtro = '';
    this.applyFilter();
  }

  nuevo(): void {
    this.abrirFormulario({});
  }

  editar(c: ClienteFila): void {
    this.abrirFormulario({ cliente: c });
  }

  eliminar(c: ClienteFila): void {
    if ((c.compras ?? 0) > 0) {
      // Known in advance: the backend would reject it (the sales keep referring to the client).
      this.aviso(
        `${c.nombreCompleto} tiene ${c.compras} ${c.compras === 1 ? 'venta registrada' : 'ventas registradas'} ` +
          'y no se puede eliminar.',
        true
      );
      return;
    }
    const data: ConfirmDialogData = {
      titulo: 'Eliminar cliente',
      mensaje: `¿Eliminar a ${c.nombreCompleto} (CI/RUC ${c.ciRuc})? Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.eliminando.set(c.id);
        this.service.eliminar(c.id).subscribe({
          next: () => {
            this.eliminando.set(null);
            this.aviso(`Se eliminó a ${c.nombreCompleto}.`);
            this.cargar();
          },
          error: (e: HttpErrorResponse) => {
            this.eliminando.set(null);
            this.aviso(mensajeError(e, 'No se pudo eliminar el cliente.'), true);
          },
        });
      });
  }

  private abrirFormulario(data: ClienteFormData): void {
    this.dialog
      .open(ClienteFormDialogComponent, { data, width: '600px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((guardado?: Cliente) => {
        if (!guardado) return;
        const nombre = `${guardado.nombres} ${guardado.apellidos}`.trim();
        this.aviso(data.cliente ? 'Se guardaron los cambios.' : `Se registró a ${nombre}.`);
        this.cargar();
      });
  }

  private aviso(texto: string, error = false): void {
    this.snack.open(texto, 'Cerrar', {
      duration: error ? 7000 : 3500,
      panelClass: error ? 'snack-error' : 'snack-ok',
    });
  }

  iniciales(c: ClienteFila): string {
    const a = c.nombres.charAt(0);
    const b = c.apellidos.charAt(0);
    return `${a}${b}`.toUpperCase() || '?';
  }

  /** tel: link with only the digits (and a leading + if present). */
  telHref(tel: string): string {
    return `tel:${tel.trim().startsWith('+') ? '+' : ''}${tel.replace(/\D/g, '')}`;
  }

  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
