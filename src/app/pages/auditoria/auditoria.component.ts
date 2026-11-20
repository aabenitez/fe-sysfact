import { Component, Injector, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../material.module';
import {
  ACCIONES,
  Auditoria,
  ENTIDADES,
  accionIcon,
  accionLabel,
} from '../../core/models/auditoria.model';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { Usuario } from '../../core/models/usuario.model';
import { numeroFactura } from '../../core/models/venta.model';
import { CambioDiff, LineaDiff, ResultadoDiff, diffJson, lineasJson } from '../../core/json-diff';

const LIMITE = 500;

/** Audit log: who created, edited, cancelled or deleted sales and clients (administrators only). */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [MaterialModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './auditoria.component.html',
  styleUrls: ['./auditoria.component.scss'],
})
export class AuditoriaComponent implements OnInit {
  private readonly service = inject(AuditoriaService);
  private readonly usuariosService = inject(UsuarioService);
  private readonly injector = inject(Injector);

  readonly acciones = ACCIONES;
  readonly entidades = ENTIDADES;
  readonly accionLabel = accionLabel;
  readonly accionIcon = accionIcon;
  readonly limite = LIMITE;
  readonly numeroFactura = numeroFactura;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly registros = signal<Auditoria[]>([]);
  readonly usuarios = signal<Usuario[]>([]);
  /** Ids of the expanded rows (showing the data before / after). */
  readonly abiertos = signal<Set<number>>(new Set());

  entidad = '';
  accion = '';
  usuarioId: number | '' = '';
  desde = this.isoDia(-29);
  hasta = this.isoDia(0);

  readonly porAccion = computed(() => {
    const cuenta: Record<string, number> = {};
    for (const r of this.registros()) cuenta[r.accion] = (cuenta[r.accion] ?? 0) + 1;
    return cuenta;
  });

  ngOnInit(): void {
    this.usuariosService.listar().subscribe({
      next: (u) =>
        this.usuarios.set(
          [...(u ?? [])].sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es'))
        ),
      error: () => this.usuarios.set([]),
    });
    this.buscar();
  }

  buscar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.abiertos.set(new Set());
    this.service
      .buscar({
        entidad: this.entidad,
        accion: this.accion,
        usuarioId: this.usuarioId === '' ? null : this.usuarioId,
        desde: this.desde,
        hasta: this.hasta,
        limite: LIMITE,
      })
      .subscribe({
        next: (r) => {
          this.registros.set(r ?? []);
          this.loading.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.error.set(
            e.status === 403
              ? 'Solo un Administrador puede ver la auditoría.'
              : 'No se pudo cargar la auditoría. Verificá que el backend esté levantado.'
          );
          this.loading.set(false);
        },
      });
  }

  limpiar(): void {
    this.entidad = '';
    this.accion = '';
    this.usuarioId = '';
    this.desde = this.isoDia(-29);
    this.hasta = this.isoDia(0);
    this.buscar();
  }

  toggle(r: Auditoria): void {
    this.abiertos.update((s) => {
      const n = new Set(s);
      n.has(r.id) ? n.delete(r.id) : n.add(r.id);
      return n;
    });
    if (this.abiertos().has(r.id)) {
      afterNextRender(() => this.irAlPrimerCambio(r.id), { injector: this.injector });
    }
  }

  /** Scrolls each before/after pane to its first highlighted line. */
  private irAlPrimerCambio(id: number): void {
    document.querySelectorAll<HTMLElement>(`[data-entry="${id}"] .code`).forEach((code) => {
      const ln = code.querySelector<HTMLElement>('.ln--modificado, .ln--agregado, .ln--quitado');
      if (ln) code.scrollTop = Math.max(0, ln.offsetTop - code.offsetTop - 40);
    });
  }

  registro(r: Auditoria): string {
    if (r.entidad === 'VENTA') return `Factura N.º ${numeroFactura(r.entidadId ?? 0)}`;
    if (r.entidad === 'CLIENTE') return `Cliente #${r.entidadId}`;
    return `${r.entidad} #${r.entidadId}`;
  }

  /** Router link of the record, when it still has a page. */
  enlace(r: Auditoria): unknown[] | null {
    return r.entidad === 'VENTA' && r.entidadId ? ['/ventas', r.entidadId] : null;
  }

  private readonly diffs = new Map<number, ResultadoDiff>();

  /**
   * Before/after of an entry, line by line, with what changed marked. When one side is missing
   * (created or deleted records) there is nothing to compare: the other side is shown plain.
   */
  diff(r: Auditoria): ResultadoDiff {
    let d = this.diffs.get(r.id);
    if (!d) {
      const hayAntes = r.datosAntes !== null && r.datosAntes !== undefined;
      const hayDespues = r.datosDespues !== null && r.datosDespues !== undefined;
      d =
        hayAntes && hayDespues
          ? diffJson(r.datosAntes, r.datosDespues)
          : {
              cambios: [],
              antes: hayAntes ? lineasJson(r.datosAntes) : [],
              despues: hayDespues ? lineasJson(r.datosDespues) : [],
            };
      this.diffs.set(r.id, d);
    }
    return d;
  }

  readonly tipoLabel: Record<CambioDiff['tipo'], string> = {
    modificado: 'Modificado',
    agregado: 'Agregado',
    quitado: 'Quitado',
  };

  /** Indentation of a printed JSON line, in characters. */
  sangria(l: LineaDiff): string {
    return `${l.nivel * 2}ch`;
  }

  private isoDia(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}
