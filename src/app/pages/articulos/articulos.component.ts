import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from '../../material.module';
import { Articulo, TASAS_IVA, imagenArticuloUrl, ivaIncluido, tasaLabel } from '../../core/models/articulo.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { AuthService } from '../../core/auth/auth.service';
import { formatGs } from '../../core/format';
import { mensajeError } from '../../core/http-error';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../core/ui/confirm-dialog.component';
import { ArticuloFormData, ArticuloFormDialogComponent, ArticuloGuardado } from './articulo-form-dialog.component';
import { ArticuloThumbComponent } from '../../core/ui/articulo-thumb.component';
import { verImagenArticulo } from '../../core/ui/articulo-imagen-dialog.component';

type FiltroTasa = '' | '10' | '5' | '0';
export type VistaArticulos = 'tabla' | 'cuadros';

/** Where each browser remembers the chosen view (a convenience: if storage fails, the table is used). */
const VISTA_KEY = 'sysfact.articulos.vista';

/** Sort choices for the cards view (the table sorts from its headers; both share the same MatSort). */
const ORDENES = [
  { value: 'nombre:asc', label: 'Nombre (A–Z)' },
  { value: 'nombre:desc', label: 'Nombre (Z–A)' },
  { value: 'precio:asc', label: 'Precio: menor a mayor' },
  { value: 'precio:desc', label: 'Precio: mayor a menor' },
  { value: 'proveedor:asc', label: 'Proveedor' },
] as const;

function vistaGuardada(): VistaArticulos {
  try {
    return localStorage.getItem(VISTA_KEY) === 'cuadros' ? 'cuadros' : 'tabla';
  } catch {
    return 'tabla';
  }
}

@Component({
  selector: 'app-articulos',
  standalone: true,
  imports: [MaterialModule, FormsModule, ArticuloThumbComponent],
  templateUrl: './articulos.component.html',
  styleUrls: ['./articulos.component.scss'],
})
export class ArticulosComponent implements OnInit {
  private readonly service = inject(ArticuloService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  /** Only Administrators can create, edit or delete (the backend enforces it too). */
  readonly isAdmin = computed(() => this.auth.user()?.rol?.nombre === 'Administrador');
  readonly columns = computed(() =>
    ['nombre', 'unidad', 'proveedor', 'iva', 'precio'].concat(this.isAdmin() ? ['acciones'] : [])
  );
  readonly dataSource = new MatTableDataSource<Articulo>([]);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly articulos = signal<Articulo[]>([]);
  readonly visibles = signal(0);
  /** Id of the article being deleted, to disable its buttons meanwhile. */
  readonly eliminando = signal<number | null>(null);

  search = '';
  unidad = '';
  tasa: FiltroTasa = '';
  readonly tasas = TASAS_IVA;

  readonly unidades = computed(() =>
    [...new Set(this.articulos().map((a) => a.unidadMedida?.nombre).filter(Boolean))].sort()
  );
  readonly precioPromedio = computed(() => {
    const list = this.articulos();
    return list.length ? list.reduce((acc, a) => acc + (a.precio ?? 0), 0) / list.length : 0;
  });

  /** Table or cards. The table stays in the page while hidden, so sort and paging carry over. */
  readonly vista = signal<VistaArticulos>(vistaGuardada());
  /** The current page (filtered, sorted, paged), for the cards view. */
  readonly pagina = toSignal(this.dataSource.connect(), { initialValue: [] as Articulo[] });
  readonly ordenes = ORDENES;
  readonly orden = signal<string>('nombre:asc');
  /** Articles whose photo failed to load in the cards view (they show the initial instead). */
  readonly fotosFallidas = signal<ReadonlySet<number>>(new Set());

  private readonly destroyRef = inject(DestroyRef);
  private matSort?: MatSort;

  // The table is rendered after loading, so sort and paginator are attached when they appear.
  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (!sort || sort === this.matSort) return;
    this.matSort = sort;
    this.dataSource.sort = sort;
    this.orden.set(`${sort.active}:${sort.direction || 'asc'}`);
    sort.sortChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s) => this.orden.set(`${s.active}:${s.direction || 'asc'}`));
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  readonly formatGs = formatGs;
  readonly tasaLabel = tasaLabel;
  readonly ivaIncluido = ivaIncluido;

  constructor() {
    this.dataSource.sortingDataAccessor = (a, col) => {
      switch (col) {
        case 'unidad':
          return a.unidadMedida?.nombre ?? '';
        case 'proveedor':
          return a.proveedor?.nombre ?? '';
        case 'iva':
          return a.tasaIva ?? 0;
        case 'precio':
          return a.precio ?? 0;
        default:
          return (a.nombre ?? '').toLocaleLowerCase('es');
      }
    };

    this.dataSource.filterPredicate = (a, raw) => {
      const { text, unidad, tasa } = JSON.parse(raw) as { text: string; unidad: string; tasa: FiltroTasa };
      if (unidad && a.unidadMedida?.nombre !== unidad) return false;
      if (tasa !== '' && String(a.tasaIva) !== tasa) return false;
      if (!text) return true;
      const haystack = this.normalize(
        [a.nombre, a.descripcion, a.proveedor?.nombre, a.unidadMedida?.nombre].join(' ')
      );
      return haystack.includes(text);
    };
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.listar().subscribe({
      next: (list) => {
        this.articulos.set(list);
        this.dataSource.data = list;
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  applyFilter(): void {
    const filter = JSON.stringify({
      text: this.normalize(this.search.trim()),
      unidad: this.unidad,
      tasa: this.tasa,
    });
    this.dataSource.filter = filter;
    this.dataSource.paginator?.firstPage();
    // Counted directly: filteredData is only refreshed once the table is connected.
    this.visibles.set(
      this.dataSource.data.filter((a) => this.dataSource.filterPredicate(a, filter)).length
    );
  }

  limpiar(): void {
    this.search = '';
    this.unidad = '';
    this.tasa = '';
    this.applyFilter();
  }

  cambiarVista(v: VistaArticulos): void {
    this.vista.set(v);
    try {
      localStorage.setItem(VISTA_KEY, v);
    } catch {
      /* private mode or blocked storage: the choice just isn't remembered */
    }
  }

  /** Sort from the cards view; the table headers show the same order. */
  ordenar(valor: string): void {
    const sort = this.matSort;
    if (!sort) return;
    const [active, direction] = valor.split(':') as [string, 'asc' | 'desc'];
    sort.active = active;
    sort.direction = direction;
    sort.sortChange.emit({ active, direction });
  }

  fotoFallo(id: number): void {
    this.fotosFallidas.update((s) => new Set(s).add(id));
  }

  readonly imagenUrl = (a: Articulo): string | null =>
    this.fotosFallidas().has(a.id) ? null : imagenArticuloUrl(a);

  inicial(a: Articulo): string {
    return (a.nombre ?? '?').trim().charAt(0).toUpperCase();
  }

  nuevo(): void {
    this.abrirFormulario({});
  }

  /** Opens the photo large (only articles that have one). */
  verImagen(a: Articulo): void {
    verImagenArticulo(this.dialog, a);
  }

  editar(a: Articulo): void {
    this.abrirFormulario({ articulo: a });
  }

  eliminar(a: Articulo): void {
    const data: ConfirmDialogData = {
      titulo: 'Eliminar artículo',
      mensaje: `¿Eliminar "${a.nombre}"? Esta acción no se puede deshacer. Si el artículo ya figura en alguna venta, no se podrá eliminar.`,
      confirmar: 'Eliminar',
      peligro: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.eliminando.set(a.id);
        this.service.eliminar(a.id).subscribe({
          next: () => {
            this.eliminando.set(null);
            this.aviso(`Se eliminó "${a.nombre}".`);
            this.cargar();
          },
          error: (e: HttpErrorResponse) => {
            this.eliminando.set(null);
            this.aviso(mensajeError(e, 'No se pudo eliminar el artículo.'), true);
          },
        });
      });
  }

  private abrirFormulario(data: ArticuloFormData): void {
    this.dialog
      .open(ArticuloFormDialogComponent, { data, width: '640px', maxWidth: '95vw', autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((guardado?: ArticuloGuardado) => {
        if (!guardado) return;
        if (guardado.avisoImagen) {
          this.aviso(guardado.avisoImagen, true);
        } else {
          this.aviso(data.articulo ? 'Se guardaron los cambios.' : `Se creó "${guardado.nombre}".`);
        }
        this.cargar();
      });
  }

  private aviso(texto: string, error = false): void {
    this.snack.open(texto, 'Cerrar', {
      duration: error ? 7000 : 3500,
      panelClass: error ? 'snack-error' : 'snack-ok',
    });
  }

  /** Lowercase and strip accents so that "limon" finds "Limón". */
  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
