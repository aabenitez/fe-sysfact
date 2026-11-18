import {
  Component,
  OnInit,
  ViewChild,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from '../../material.module';
import { Parametro } from '../../core/models/parametro.model';
import { ParametroService } from '../../core/services/parametro.service';
import { AuthService } from '../../core/auth/auth.service';
import { BrandingService, ImagenEmpresa } from '../../core/branding/branding.service';

type Estado = '' | 'activos' | 'inactivos';
type TipoImagen = 'logo' | 'favicon';

interface ImagenCard {
  imagen: ImagenEmpresa;
  /** Used in messages: "No se pudo guardar el logo." */
  nombre: string;
  busy: WritableSignal<boolean>;
  msg: WritableSignal<{ type: 'ok' | 'error'; text: string } | null>;
  onChange?: () => void;
}

/** Codes whose value must not be shown on screen unless the user asks for it. */
const SENSITIVE = /(password|pass|secret|token|clave|key)/i;

@Component({
  selector: 'app-parametros',
  standalone: true,
  imports: [MaterialModule, FormsModule],
  templateUrl: './parametros.component.html',
  styleUrls: ['./parametros.component.scss'],
})
export class ParametrosComponent implements OnInit {
  private readonly service = inject(ParametroService);
  private readonly auth = inject(AuthService);
  readonly branding = inject(BrandingService);

  readonly isAdmin = computed(() => this.auth.user()?.rol?.nombre === 'Administrador');

  /** The company images editable on this page: the header logo and the browser-tab favicon. */
  readonly imagenes: Record<TipoImagen, ImagenCard> = {
    logo: {
      imagen: this.branding.logo,
      nombre: 'el logo',
      busy: signal(false),
      msg: signal(null),
    },
    favicon: {
      imagen: this.branding.favicon,
      nombre: 'el favicon',
      busy: signal(false),
      msg: signal(null),
      // The browser tab only changes when the <link rel="icon"> is replaced.
      onChange: () => this.branding.applyFavicon(),
    },
  };
  readonly logo = this.imagenes.logo;
  readonly fav = this.imagenes.favicon;

  readonly columns = ['codigo', 'descripcion', 'valor', 'activo'];
  readonly dataSource = new MatTableDataSource<Parametro>([]);

  readonly loading = signal(true);
  /** null = no error; otherwise the message to show. */
  readonly error = signal<string | null>(null);
  readonly parametros = signal<Parametro[]>([]);
  readonly visibles = signal(0);
  readonly revealed = signal<ReadonlySet<number>>(new Set());

  search = '';
  estado: Estado = '';

  readonly activos = computed(() => this.parametros().filter((p) => this.isActivo(p)).length);
  readonly inactivos = computed(() => this.parametros().length - this.activos());
  readonly sensibles = computed(() => this.parametros().filter((p) => this.isSensitive(p)).length);

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (p, col) => {
      switch (col) {
        case 'activo':
          return this.isActivo(p) ? 0 : 1;
        case 'descripcion':
          return (p.descripcion ?? '').toLocaleLowerCase('es');
        case 'valor':
          return this.isSensitive(p) ? '' : (p.valor ?? '').toLocaleLowerCase('es');
        default:
          return (p.codigo ?? '').toLocaleLowerCase('es');
      }
    };

    this.dataSource.filterPredicate = (p, raw) => {
      const { text, estado } = JSON.parse(raw) as { text: string; estado: Estado };
      if (estado === 'activos' && !this.isActivo(p)) return false;
      if (estado === 'inactivos' && this.isActivo(p)) return false;
      if (!text) return true;
      // Hidden values are not searchable, so a search can't reveal a password letter by letter.
      const fields = [p.codigo, p.descripcion, this.isSensitive(p) ? '' : p.valor];
      return this.normalize(fields.join(' ')).includes(text);
    };
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.revealed.set(new Set());
    this.service.listar().subscribe({
      next: (list) => {
        this.parametros.set(list ?? []);
        this.dataSource.data = list ?? [];
        this.applyFilter();
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para ver los parámetros del sistema.'
            : 'Verificá que el backend esté levantado e intentá de nuevo.'
        );
        this.loading.set(false);
      },
    });
  }

  applyFilter(): void {
    const filter = JSON.stringify({ text: this.normalize(this.search.trim()), estado: this.estado });
    this.dataSource.filter = filter;
    this.dataSource.paginator?.firstPage();
    this.visibles.set(
      this.dataSource.data.filter((p) => this.dataSource.filterPredicate(p, filter)).length
    );
  }

  limpiar(): void {
    this.search = '';
    this.estado = '';
    this.applyFilter();
  }

  onImagenSelected(tipo: TipoImagen, input: HTMLInputElement): void {
    const card = this.imagenes[tipo];
    const file = input.files?.[0];
    input.value = ''; // allow choosing the same file again
    if (!file) return;

    const invalid = card.imagen.validate(file);
    if (invalid) {
      card.msg.set({ type: 'error', text: invalid });
      return;
    }
    this.run(card, card.imagen.upload(file), `Se actualizó ${card.nombre}.`);
  }

  restablecerImagen(tipo: TipoImagen): void {
    const card = this.imagenes[tipo];
    this.run(card, card.imagen.reset(), `Se volvió a usar ${card.nombre} predeterminado.`);
  }

  private run(card: ImagenCard, request: Observable<unknown>, ok: string): void {
    card.busy.set(true);
    card.msg.set(null);
    request.subscribe({
      next: () => {
        card.busy.set(false);
        card.msg.set({ type: 'ok', text: ok });
        card.onChange?.();
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        card.busy.set(false);
        card.msg.set({ type: 'error', text: this.uploadError(e, card.nombre) });
      },
    });
  }

  private uploadError(e: HttpErrorResponse, nombre: string): string {
    if (e.status === 403) return `Solo un Administrador puede cambiar ${nombre}.`;
    if (e.status === 413) return 'La imagen es demasiado grande.';
    if (e.status === 0) return 'No se pudo conectar con el servidor.';
    // Business rule errors come in error[0]; storage errors in mensaje.
    return e.error?.error?.[0] && e.status === 409
      ? e.error.error[0]
      : e.error?.mensaje ?? `No se pudo guardar ${nombre}.`;
  }

  isActivo(p: Parametro): boolean {
    // The column defaults to TRUE in the database.
    return p.activo !== false;
  }

  isSensitive(p: Parametro): boolean {
    return SENSITIVE.test(p.codigo ?? '');
  }

  isRevealed(p: Parametro): boolean {
    return this.revealed().has(p.id);
  }

  toggleReveal(p: Parametro): void {
    const next = new Set(this.revealed());
    next.has(p.id) ? next.delete(p.id) : next.add(p.id);
    this.revealed.set(next);
  }

  isUrlOrPath(v: string): boolean {
    return /^(https?:\/\/|[\\/])/.test(v ?? '');
  }

  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
