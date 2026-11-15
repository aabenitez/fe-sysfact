import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { Articulo, UnidadMedida } from '../../core/models/articulo.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { UnidadMedidaService } from '../../core/services/unidad-medida.service';

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

  readonly columns = ['nombre', 'plural', 'articulos'];
  readonly dataSource = new MatTableDataSource<UnidadFila>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly unidades = signal<UnidadFila[]>([]);
  /** False when /articulos failed: the usage column and stats are then unknown. */
  readonly usoDisponible = signal(true);
  readonly visibles = signal(0);

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
