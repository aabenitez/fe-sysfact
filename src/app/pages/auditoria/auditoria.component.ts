import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  readonly acciones = ACCIONES;
  readonly entidades = ENTIDADES;
  readonly accionLabel = accionLabel;
  readonly accionIcon = accionIcon;
  readonly limite = LIMITE;

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

  json(datos: unknown): string {
    return datos === null || datos === undefined ? '—' : JSON.stringify(datos, null, 2);
  }

  private isoDia(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}
