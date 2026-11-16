import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { Articulo, Proveedor } from '../../core/models/articulo.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { ProveedorService } from '../../core/services/proveedor.service';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/http-error';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../core/ui/confirm-dialog.component';
import { ProveedorFormData, ProveedorFormDialogComponent } from './proveedor-form-dialog.component';

type Filtro = '' | 'con-articulos' | 'sin-articulos' | 'sin-contacto';

/** A supplier plus how many articles it provides (null when articles could not be loaded). */
interface ProveedorFila extends Proveedor {
  articulos: number | null;
  nombresArticulos: string[];
}

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [MaterialModule, FormsModule, RouterModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.scss'],
})
export class ProveedoresComponent implements OnInit {
  private readonly service = inject(ProveedorService);
  private readonly articuloService = inject(ArticuloService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  /** Only Administrators can create, edit or delete (the backend enforces it too). */
  readonly isAdmin = computed(() => this.auth.user()?.rol?.nombre === 'Administrador');
  readonly columns = computed(() =>
    ['nombre', 'contacto', 'articulos'].concat(this.isAdmin() ? ['acciones'] : [])
  );
  readonly dataSource = new MatTableDataSource<ProveedorFila>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly proveedores = signal<ProveedorFila[]>([]);
  readonly articulosDisponibles = signal(true);
  readonly visibles = signal(0);
  readonly eliminando = signal<number | null>(null);

  search = '';
  filtro: Filtro = '';

  readonly conArticulos = computed(() => this.proveedores().filter((p) => (p.articulos ?? 0) > 0).length);
  readonly sinContacto = computed(
    () => this.proveedores().filter((p) => !p.contacto && !p.telefono).length
  );
  readonly principal = computed(() => {
    const top = [...this.proveedores()].sort((a, b) => (b.articulos ?? 0) - (a.articulos ?? 0))[0];
    return top && (top.articulos ?? 0) > 0 ? top : null;
  });

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (p, col) => {
      switch (col) {
        case 'contacto':
          return (p.contacto ?? '').toLocaleLowerCase('es');
        case 'articulos':
          return p.articulos ?? -1;
        default:
          return (p.nombre ?? '').toLocaleLowerCase('es');
      }
    };

    this.dataSource.filterPredicate = (p, raw) => {
      const { text, filtro } = JSON.parse(raw) as { text: string; filtro: Filtro };
      if (filtro === 'con-articulos' && !((p.articulos ?? 0) > 0)) return false;
      if (filtro === 'sin-articulos' && (p.articulos ?? 0) > 0) return false;
      if (filtro === 'sin-contacto' && (p.contacto || p.telefono)) return false;
      if (!text) return true;
      const haystack = this.normalize(
        [p.nombre, p.contacto, p.telefono, p.direccion, ...p.nombresArticulos].join(' ')
      );
      const digits = text.replace(/\D/g, '');
      return (
        haystack.includes(text) ||
        (digits.length >= 3 && (p.telefono ?? '').replace(/\D/g, '').includes(digits))
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
      proveedores: this.service.listar(),
      // Article counts are a bonus: the list still works if articles can't be loaded.
      articulos: this.articuloService.listar().pipe(catchError(() => of(null as Articulo[] | null))),
    }).subscribe({
      next: ({ proveedores, articulos }) => {
        const porProveedor = new Map<number, string[]>();
        for (const a of articulos ?? []) {
          const id = a.proveedor?.id;
          if (id == null) continue;
          porProveedor.set(id, [...(porProveedor.get(id) ?? []), a.nombre]);
        }
        const filas: ProveedorFila[] = (proveedores ?? []).map((p) => {
          const nombres = (porProveedor.get(p.id) ?? []).sort((a, b) => a.localeCompare(b, 'es'));
          return { ...p, articulos: articulos ? nombres.length : null, nombresArticulos: nombres };
        });
        this.articulosDisponibles.set(articulos !== null);
        this.proveedores.set(filas);
        this.dataSource.data = filas;
        this.applyFilter();
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para ver los proveedores.'
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
      this.dataSource.data.filter((p) => this.dataSource.filterPredicate(p, filter)).length
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

  editar(p: ProveedorFila): void {
    this.abrirFormulario({ proveedor: p });
  }

  eliminar(p: ProveedorFila): void {
    if ((p.articulos ?? 0) > 0) {
      // Known in advance: the backend would reject it.
      this.aviso(
        `"${p.nombre}" tiene ${p.articulos} ${p.articulos === 1 ? 'artículo' : 'artículos'}. ` +
          'Asigná esos artículos a otro proveedor antes de eliminarlo.',
        true
      );
      return;
    }
    const data: ConfirmDialogData = {
      titulo: 'Eliminar proveedor',
      mensaje: `¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.eliminando.set(p.id);
        this.service.eliminar(p.id).subscribe({
          next: () => {
            this.eliminando.set(null);
            this.aviso(`Se eliminó "${p.nombre}".`);
            this.cargar();
          },
          error: (e: HttpErrorResponse) => {
            this.eliminando.set(null);
            this.aviso(mensajeError(e, 'No se pudo eliminar el proveedor.'), true);
          },
        });
      });
  }

  iniciales(p: Proveedor): string {
    const palabras = p.nombre.trim().split(/\s+/);
    return (palabras[0].charAt(0) + (palabras[1]?.charAt(0) ?? '')).toUpperCase();
  }

  telHref(tel: string): string {
    return `tel:${tel.trim().startsWith('+') ? '+' : ''}${tel.replace(/\D/g, '')}`;
  }

  private abrirFormulario(data: ProveedorFormData): void {
    this.dialog
      .open(ProveedorFormDialogComponent, { data, width: '560px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((guardado?: Proveedor) => {
        if (!guardado) return;
        this.aviso(data.proveedor ? 'Se guardaron los cambios.' : `Se creó "${guardado.nombre}".`);
        this.cargar();
      });
  }

  private aviso(texto: string, error = false): void {
    this.snack.open(texto, 'Cerrar', {
      duration: error ? 7000 : 3500,
      panelClass: error ? 'snack-error' : 'snack-ok',
    });
  }

  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
