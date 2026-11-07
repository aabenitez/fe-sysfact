import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from '../../material.module';
import { Articulo } from '../../core/models/articulo.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { formatGs } from '../../core/format';

@Component({
  selector: 'app-articulos',
  standalone: true,
  imports: [MaterialModule, FormsModule],
  templateUrl: './articulos.component.html',
  styleUrls: ['./articulos.component.scss'],
})
export class ArticulosComponent implements OnInit {
  private readonly service = inject(ArticuloService);

  readonly columns = ['nombre', 'unidad', 'proveedor', 'precio'];
  readonly dataSource = new MatTableDataSource<Articulo>([]);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly articulos = signal<Articulo[]>([]);
  readonly visibles = signal(0);

  search = '';
  unidad = '';

  readonly unidades = computed(() =>
    [...new Set(this.articulos().map((a) => a.unidadMedida?.nombre).filter(Boolean))].sort()
  );
  readonly precioPromedio = computed(() => {
    const list = this.articulos();
    return list.length ? list.reduce((acc, a) => acc + (a.precio ?? 0), 0) / list.length : 0;
  });

  // The table is rendered after loading, so sort and paginator are attached when they appear.
  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  readonly formatGs = formatGs;

  constructor() {
    this.dataSource.sortingDataAccessor = (a, col) => {
      switch (col) {
        case 'unidad':
          return a.unidadMedida?.nombre ?? '';
        case 'proveedor':
          return a.proveedor?.nombre ?? '';
        case 'precio':
          return a.precio ?? 0;
        default:
          return (a.nombre ?? '').toLocaleLowerCase('es');
      }
    };

    this.dataSource.filterPredicate = (a, raw) => {
      const { text, unidad } = JSON.parse(raw) as { text: string; unidad: string };
      if (unidad && a.unidadMedida?.nombre !== unidad) return false;
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
    this.applyFilter();
  }

  /** Lowercase and strip accents so that "limon" finds "Limón". */
  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
