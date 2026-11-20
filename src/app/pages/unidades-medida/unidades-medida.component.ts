import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { Articulo, UnidadMedida } from '../../core/models/articulo.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { UnidadMedidaService } from '../../core/services/unidad-medida.service';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/http-error';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../core/ui/confirm-dialog.component';
import { UnidadMedidaFormData, UnidadMedidaFormDialogComponent } from './unidad-medida-form-dialog.component';

type Uso = '' | 'en-uso' | 'sin-uso';

/** A unit plus how many articles use it (null when articles could not be loaded). */
interface UnidadFila extends UnidadMedida {
  articulos: number | null;
}

@Component({
  selector: 'app-unidades-medida',
  standalone: true,
  imports: [MaterialModule, FormsModule, RouterModule],
  templateUrl: './unidades-medida.component.html',
  styleUrls: ['./unidades-medida.component.scss'],
})
export class UnidadesMedidaComponent implements OnInit {
  private readonly service = inject(UnidadMedidaService);
  private readonly articuloService = inject(ArticuloService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  /** Only Administrators can create, edit or delete (the backend enforces it too). */
  readonly isAdmin = computed(() => this.auth.user()?.rol?.nombre === 'Administrador');
  readonly columns = computed(() =>
    ['nombre', 'plural', 'articulos'].concat(this.isAdmin() ? ['acciones'] : [])
  );
  readonly dataSource = new MatTableDataSource<UnidadFila>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly unidades = signal<UnidadFila[]>([]);
  /** False when /articulos failed: the usage column and stats are then unknown. */
  readonly usoDisponible = signal(true);
  readonly visibles = signal(0);
  /** Id of the unit being deleted, to disable its buttons meanwhile. */
  readonly eliminando = signal<number | null>(null);

  search = '';
  uso: Uso = '';

  readonly enUso = computed(() => this.unidades().filter((u) => (u.articulos ?? 0) > 0).length);
  readonly sinUso = computed(() => this.unidades().length - this.enUso());
  /** The most used unit(s); several when they tie. */
  readonly masUsada = computed(() => {
    const max = Math.max(0, ...this.unidades().map((u) => u.articulos ?? 0));
    if (max === 0) return null;
    const nombres = this.unidades()
      .filter((u) => u.articulos === max)
      .map((u) => u.nombre)
      .sort((a, b) => a.localeCompare(b, 'es'));
    const lista =
      nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
    return { nombres: lista, articulos: max, empate: nombres.length > 1 };
  });
  readonly maxArticulos = computed(() =>
    Math.max(1, ...this.unidades().map((u) => u.articulos ?? 0))
  );

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (u, col) => {
      switch (col) {
        case 'plural':
          return (u.plural ?? '').toLocaleLowerCase('es');
        case 'articulos':
          return u.articulos ?? -1;
        default:
          return (u.nombre ?? '').toLocaleLowerCase('es');
      }
    };

    this.dataSource.filterPredicate = (u, raw) => {
      const { text, uso } = JSON.parse(raw) as { text: string; uso: Uso };
      if (uso === 'en-uso' && !((u.articulos ?? 0) > 0)) return false;
      if (uso === 'sin-uso' && (u.articulos ?? 0) > 0) return false;
      if (!text) return true;
      return this.normalize(`${u.nombre} ${u.plural}`).includes(text);
    };
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      unidades: this.service.listar(),
      // Usage counts are a bonus: the page still works if articles can't be loaded.
      articulos: this.articuloService.listar().pipe(catchError(() => of(null as Articulo[] | null))),
    }).subscribe({
      next: ({ unidades, articulos }) => {
        const counts = new Map<number, number>();
        for (const a of articulos ?? []) {
          const id = a.unidadMedida?.id;
          if (id != null) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        const filas: UnidadFila[] = (unidades ?? []).map((u) => ({
          ...u,
          articulos: articulos ? counts.get(u.id) ?? 0 : null,
        }));
        this.usoDisponible.set(articulos !== null);
        this.unidades.set(filas);
        this.dataSource.data = filas;
        this.applyFilter();
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para ver las unidades de medida.'
            : 'Verificá que el backend esté levantado e intentá de nuevo.'
        );
        this.loading.set(false);
      },
    });
  }

  applyFilter(): void {
    const filter = JSON.stringify({ text: this.normalize(this.search.trim()), uso: this.uso });
    this.dataSource.filter = filter;
    this.dataSource.paginator?.firstPage();
    this.visibles.set(
      this.dataSource.data.filter((u) => this.dataSource.filterPredicate(u, filter)).length
    );
  }

  limpiar(): void {
    this.search = '';
    this.uso = '';
    this.applyFilter();
  }

  nuevo(): void {
    this.abrirFormulario({});
  }

  editar(u: UnidadFila): void {
    this.abrirFormulario({ unidad: u, articulos: u.articulos });
  }

  /** "La usan N artículos" when in use: deleting is then not offered (the backend would reject it). */
  enUsoTexto(u: UnidadFila): string | null {
    if (!u.articulos) return null;
    return u.articulos === 1 ? 'La usa 1 artículo' : `La usan ${u.articulos} artículos`;
  }

  eliminar(u: UnidadFila): void {
    const data: ConfirmDialogData = {
      titulo: 'Eliminar unidad de medida',
      mensaje: `¿Eliminar "${u.nombre}"? Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.eliminando.set(u.id);
        this.service.eliminar(u.id).subscribe({
          next: () => {
            this.eliminando.set(null);
            this.aviso(`Se eliminó "${u.nombre}".`);
            this.cargar();
          },
          error: (e: HttpErrorResponse) => {
            this.eliminando.set(null);
            this.aviso(mensajeError(e, 'No se pudo eliminar la unidad de medida.'), true);
          },
        });
      });
  }

  private abrirFormulario(data: UnidadMedidaFormData): void {
    this.dialog
      .open(UnidadMedidaFormDialogComponent, { data, width: '560px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((guardada?: UnidadMedida) => {
        if (!guardada) return;
        this.aviso(data.unidad ? 'Se guardaron los cambios.' : `Se creó "${guardada.nombre}".`);
        this.cargar();
      });
  }

  private aviso(texto: string, error = false): void {
    this.snack.open(texto, 'Cerrar', {
      duration: error ? 7000 : 3500,
      panelClass: error ? 'snack-error' : 'snack-ok',
    });
  }

  barra(u: UnidadFila): number {
    return Math.round(((u.articulos ?? 0) / this.maxArticulos()) * 100);
  }

  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
