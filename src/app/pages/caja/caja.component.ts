import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { CajaCierre, CajaMovimiento, CajaResumen, hoyIso, textoDiferencia } from '../../core/models/caja.model';
import { formaPagoIcon, formaPagoLabel, numeroRecibo } from '../../core/models/cobro.model';
import { numeroFactura } from '../../core/models/venta.model';
import { CajaService } from '../../core/services/caja.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROL_ADMIN } from '../../core/auth/permisos';
import { formatGs } from '../../core/format';
import { mensajeError } from '../../core/http-error';
import { AnularCierreDialogComponent } from './anular-cierre-dialog.component';

const OBS_MIN = 5;
const OBS_MAX = 250;

/** Daily cash count: what came in by payment method, and closing the day against the counted cash. */
@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [MaterialModule, RouterModule, FormsModule, DatePipe],
  templateUrl: './caja.component.html',
  styleUrls: ['./caja.component.scss'],
})
export class CajaComponent implements OnInit {
  private readonly service = inject(CajaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly hoy = hoyIso();
  readonly esAdmin = computed(() => this.auth.rol() === ROL_ADMIN);

  readonly fecha = signal(this.hoy);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly resumen = signal<CajaResumen | null>(null);
  readonly aviso = signal<string | null>(null);

  // Closing form
  readonly fondo = signal<number | null>(0);
  readonly contado = signal<number | null>(null);
  readonly observacion = signal('');
  readonly guardando = signal(false);
  readonly errorCierre = signal<string | null>(null);
  readonly intento = signal(false);

  readonly formatGs = formatGs;
  readonly numeroFactura = numeroFactura;
  readonly numeroRecibo = numeroRecibo;
  readonly formaPagoLabel = formaPagoLabel;
  readonly formaPagoIcon = formaPagoIcon;
  readonly obsMax = OBS_MAX;

  readonly esHoy = computed(() => this.fecha() === this.hoy);
  readonly cierre = computed(() => this.resumen()?.cierre ?? null);
  readonly ventas = computed(() => (this.resumen()?.movimientos ?? []).filter((m) => m.tipo === 'VENTA'));
  readonly cobros = computed(() => (this.resumen()?.movimientos ?? []).filter((m) => m.tipo === 'COBRO'));
  /** Payment methods with movements; cash always shows, as it is what gets counted. */
  readonly formas = computed(() =>
    (this.resumen()?.porForma ?? []).filter((f) => f.cantidad > 0 || f.formaPago === 'EFECTIVO')
  );

  readonly esperado = computed(() => (this.fondo() ?? 0) + (this.resumen()?.efectivo ?? 0));
  readonly diferencia = computed(() => (this.contado() === null ? null : this.contado()! - this.esperado()));
  /** What is wrong with the closing form, or null when it can be sent. */
  readonly problemaCierre = computed<string | null>(() => {
    const f = this.fondo();
    const c = this.contado();
    if (f !== null && (f < 0 || !Number.isInteger(f))) return 'El fondo inicial va en guaraníes enteros, sin negativos.';
    if (c === null) return 'Ingresá el efectivo que contaste en la caja.';
    if (c < 0 || !Number.isInteger(c)) return 'El efectivo contado va en guaraníes enteros, sin negativos.';
    if (this.diferencia() !== 0 && this.observacion().trim().length < OBS_MIN)
      return 'El efectivo no coincide con el esperado: explicá la diferencia en la observación.';
    return null;
  });

  /**
   * After closing, sales or payments of that day may still change. Compares what came in now with
   * what it was when the day was closed.
   */
  readonly cambiosDespues = computed<string | null>(() => {
    const r = this.resumen();
    const c = r?.cierre;
    if (!r || !c) return null;
    const efectivoAlCerrar = c.efectivoEsperado - c.fondoInicial;
    const totalAlCerrar = c.totalVentas + c.totalCobros;
    if (efectivoAlCerrar === r.efectivo && totalAlCerrar === r.total) return null;
    return (
      `Después del cierre cambiaron los movimientos del día: ahora entraron ${formatGs(r.total)} ` +
      `(al cerrar, ${formatGs(totalAlCerrar)}) y el efectivo es ${formatGs(r.efectivo)} ` +
      `(al cerrar, ${formatGs(efectivoAlCerrar)}).`
    );
  });

  textoDiferencia(d: number): string {
    return textoDiferencia(d, formatGs);
  }

  /** The same text mid-sentence: only its first letter lowered ("faltan Gs. 5.000"). */
  diferenciaEnFrase(d: number): string {
    const t = this.textoDiferencia(d);
    return t.charAt(0).toLocaleLowerCase('es') + t.slice(1);
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const f = q.get('fecha');
      this.fecha.set(f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : this.hoy);
      this.cargar();
    });
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.resumen(this.fecha()).subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.resumen.set(null);
        this.error.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para ver la caja.'
            : mensajeError(e, 'No se pudo cargar la caja. Verificá que el backend esté levantado.')
        );
        this.loading.set(false);
      },
    });
  }

  /** Administrators can look at other days; the date goes in the URL so it can be shared. */
  cambiarFecha(f: string): void {
    if (!f || f > this.hoy) return;
    this.aviso.set(null);
    this.limpiarFormulario();
    this.router.navigate([], { relativeTo: this.route, queryParams: { fecha: f === this.hoy ? null : f } });
  }

  diaAnterior(): void {
    this.cambiarFecha(this.sumarDias(this.fecha(), -1));
  }

  diaSiguiente(): void {
    this.cambiarFecha(this.sumarDias(this.fecha(), 1));
  }

  private sumarDias(iso: string, n: number): string {
    const [a, m, d] = iso.split('-').map(Number);
    const x = new Date(a, m - 1, d + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  /** The day as a local date, for the date pipe (new Date("yyyy-MM-dd") would be UTC). */
  fechaLocal(iso: string): Date {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  usarEsperado(): void {
    this.contado.set(this.esperado());
  }

  cerrar(): void {
    this.intento.set(true);
    if (this.problemaCierre() || this.guardando()) return;
    this.guardando.set(true);
    this.errorCierre.set(null);
    const obs = this.observacion().trim();
    this.service
      .cerrar({
        fecha: this.fecha(),
        fondoInicial: this.fondo() ?? 0,
        efectivoContado: this.contado()!,
        observacion: obs || null,
      })
      .subscribe({
        next: (r) => {
          this.resumen.set(r);
          this.guardando.set(false);
          this.limpiarFormulario();
          const d = r.cierre?.diferencia ?? 0;
          this.aviso.set(`La caja quedó cerrada (${this.diferenciaEnFrase(d)}).`);
        },
        error: (e: HttpErrorResponse) => {
          this.guardando.set(false);
          this.errorCierre.set(
            e.status === 403 ? 'Tu rol no tiene permiso para cerrar la caja.' : mensajeError(e, 'No se pudo cerrar la caja.')
          );
        },
      });
  }

  anularCierre(c: CajaCierre): void {
    this.dialog
      .open(AnularCierreDialogComponent, { data: c, width: '520px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((r?: CajaResumen) => {
        if (!r) return;
        this.resumen.set(r);
        this.aviso.set('El cierre quedó anulado: la caja de ese día está abierta para cerrarla de nuevo.');
      });
  }

  imprimir(): void {
    window.print();
  }

  trackMov(m: CajaMovimiento): string {
    return m.tipo + m.id;
  }

  private limpiarFormulario(): void {
    this.fondo.set(0);
    this.contado.set(null);
    this.observacion.set('');
    this.intento.set(false);
    this.errorCierre.set(null);
  }
}
