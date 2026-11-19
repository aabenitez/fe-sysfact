import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { Rol } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { Usuario } from '../../core/models/usuario.model';
import { UsuarioService } from '../../core/services/usuario.service';
import { mensajeError } from '../../core/http-error';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../core/ui/confirm-dialog.component';
import { UsuarioFormData, UsuarioFormDialogComponent } from './usuario-form-dialog.component';

const ADMIN = 'Administrador';

interface UsuarioFila extends Usuario {
  nombreCompleto: string;
  /** The logged-in user. */
  esYo: boolean;
}

/** Users of the system (Administrador only). Roles are fixed: they are chosen, not edited. */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [MaterialModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['../clientes/clientes.component.scss', './usuarios.component.scss'],
})
export class UsuariosComponent implements OnInit {
  private readonly service = inject(UsuarioService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly columns = ['nombre', 'correo', 'rol', 'acciones'];
  readonly dataSource = new MatTableDataSource<UsuarioFila>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly usuarios = signal<UsuarioFila[]>([]);
  readonly roles = signal<Rol[]>([]);
  readonly visibles = signal(0);
  readonly eliminando = signal<number | null>(null);

  search = '';
  /** Role id to filter by, or '' for all. */
  rolFiltro: number | '' = '';

  readonly admins = computed(() => this.usuarios().filter((u) => u.rol?.nombre === ADMIN).length);
  /** Users with no e-mail cannot log in nor recover their password. */
  readonly sinCorreo = computed(() => this.usuarios().filter((u) => !u.correo?.trim()).length);

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator | undefined) {
    if (p) this.dataSource.paginator = p;
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (u, col) => {
      switch (col) {
        case 'correo':
          return (u.correo ?? '').toLocaleLowerCase('es');
        case 'rol':
          return (u.rol?.nombre ?? '').toLocaleLowerCase('es');
        default:
          return `${u.apellidos} ${u.nombres}`.trim().toLocaleLowerCase('es');
      }
    };

    this.dataSource.filterPredicate = (u, raw) => {
      const { text, rol } = JSON.parse(raw) as { text: string; rol: number | '' };
      if (rol !== '' && u.rol?.id !== rol) return false;
      if (!text) return true;
      return this.normalize([u.nombreCompleto, u.correo, u.rol?.nombre].join(' ')).includes(text);
    };
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    const yo = this.auth.user()?.correo?.trim().toLowerCase();
    forkJoin({ usuarios: this.service.listar(), roles: this.service.roles() }).subscribe({
      next: ({ usuarios, roles }) => {
        const filas: UsuarioFila[] = (usuarios ?? []).map((u) => {
          const nombres = (u.nombres ?? '').trim();
          const apellidos = (u.apellidos ?? '').trim();
          return {
            ...u,
            nombres,
            apellidos,
            nombreCompleto: `${nombres} ${apellidos}`.trim(),
            esYo: !!yo && u.correo?.trim().toLowerCase() === yo,
          };
        });
        this.roles.set([...(roles ?? [])].sort((a, b) => a.id - b.id));
        this.usuarios.set(filas);
        this.dataSource.data = filas;
        this.applyFilter();
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 403
            ? 'Solo un Administrador puede ver los usuarios.'
            : 'Verificá que el backend esté levantado e intentá de nuevo.'
        );
        this.loading.set(false);
      },
    });
  }

  applyFilter(): void {
    const filter = JSON.stringify({ text: this.normalize(this.search.trim()), rol: this.rolFiltro });
    this.dataSource.filter = filter;
    this.dataSource.paginator?.firstPage();
    this.visibles.set(
      this.dataSource.data.filter((u) => this.dataSource.filterPredicate(u, filter)).length
    );
  }

  limpiar(): void {
    this.search = '';
    this.rolFiltro = '';
    this.applyFilter();
  }

  cantidadPorRol(rol: Rol): number {
    return this.usuarios().filter((u) => u.rol?.id === rol.id).length;
  }

  nuevo(): void {
    this.abrirFormulario({ roles: this.roles() });
  }

  editar(u: UsuarioFila): void {
    this.abrirFormulario({ usuario: u, roles: this.roles(), esUsuarioActual: u.esYo });
  }

  /** Why a user cannot be deleted, known in advance (the backend checks it too), or null. */
  motivoNoEliminar(u: UsuarioFila): string | null {
    if (u.esYo) return 'No podés eliminar tu propio usuario';
    if (u.rol?.nombre === ADMIN && this.admins() <= 1) return 'Es el único Administrador';
    return null;
  }

  eliminar(u: UsuarioFila): void {
    const motivo = this.motivoNoEliminar(u);
    if (motivo) {
      this.aviso(`${motivo}.`, true);
      return;
    }
    const data: ConfirmDialogData = {
      titulo: 'Eliminar usuario',
      mensaje: `¿Eliminar a ${u.nombreCompleto}${u.correo ? ` (${u.correo})` : ''}? Ya no va a poder iniciar sesión. Esta acción no se puede deshacer.`,
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
            this.aviso(`Se eliminó a ${u.nombreCompleto}.`);
            this.cargar();
          },
          error: (e: HttpErrorResponse) => {
            this.eliminando.set(null);
            this.aviso(mensajeError(e, 'No se pudo eliminar el usuario.'), true);
          },
        });
      });
  }

  private abrirFormulario(data: UsuarioFormData): void {
    const antes = data.usuario;
    this.dialog
      .open(UsuarioFormDialogComponent, { data, width: '640px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((guardado?: Usuario) => {
        if (!guardado) return;
        // The session token is tied to the e-mail: after changing your own, log in again.
        if (antes && data.esUsuarioActual && guardado.correo.trim().toLowerCase() !== antes.correo.trim().toLowerCase()) {
          this.aviso('Cambiaste tu correo. Iniciá sesión de nuevo con el correo nuevo.');
          this.auth.logout();
          return;
        }
        const nombre = `${guardado.nombres} ${guardado.apellidos}`.trim();
        this.aviso(antes ? 'Se guardaron los cambios.' : `Se creó el usuario de ${nombre}.`);
        this.cargar();
      });
  }

  private aviso(texto: string, error = false): void {
    this.snack.open(texto, 'Cerrar', {
      duration: error ? 7000 : 3500,
      panelClass: error ? 'snack-error' : 'snack-ok',
    });
  }

  iniciales(u: UsuarioFila): string {
    return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase() || '?';
  }

  rolClase(u: UsuarioFila): string {
    switch (u.rol?.nombre) {
      case ADMIN:
        return 'pill pill--admin';
      case 'Cargador':
        return 'pill pill--cargador';
      default:
        return 'pill pill--off';
    }
  }

  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
