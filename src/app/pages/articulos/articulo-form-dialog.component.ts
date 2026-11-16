import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from '../../material.module';
import { API_URL } from '../../core/api.config';
import {
  Articulo,
  ArticuloInput,
  Proveedor,
  TASAS_IVA,
  TasaIva,
  UnidadMedida,
  ivaIncluido,
} from '../../core/models/articulo.model';
import { ArticuloService } from '../../core/services/articulo.service';
import { ProveedorService } from '../../core/services/proveedor.service';
import { UnidadMedidaService } from '../../core/services/unidad-medida.service';
import { mensajeError } from '../../core/http-error';
import { formatGs } from '../../core/format';

export interface ArticuloFormData {
  /** Article to edit; omitted when creating a new one. */
  articulo?: Articulo;
}

/** Create / edit dialog. Closes with the saved article, or undefined when cancelled. */
@Component({
  selector: 'app-articulo-form-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  templateUrl: './articulo-form-dialog.component.html',
  styleUrls: ['./articulo-form-dialog.component.scss'],
})
export class ArticuloFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject(MatDialogRef<ArticuloFormDialogComponent, Articulo>);
  private readonly articuloService = inject(ArticuloService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly unidadService = inject(UnidadMedidaService);
  readonly data = inject<ArticuloFormData>(MAT_DIALOG_DATA);

  readonly editando = !!this.data.articulo;
  readonly tasas = TASAS_IVA;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly errorCarga = signal<string | null>(null);
  readonly errorGuardar = signal<string | null>(null);
  readonly unidades = signal<UnidadMedida[]>([]);
  readonly proveedores = signal<Proveedor[]>([]);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    descripcion: [''],
    precio: [null as number | null, [Validators.required, Validators.min(0)]],
    tasaIva: [10 as TasaIva, Validators.required],
    unidadMedidaId: [null as number | null, Validators.required],
    proveedorId: [null as number | null, Validators.required],
  });

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  /** IVA included in the price, shown under the price field. */
  readonly ivaPreview = computed(() => {
    const v = this.valores();
    const precio = Number(v.precio);
    if (!precio || precio < 0) return null;
    return ivaIncluido(precio, v.tasaIva ?? 10);
  });

  readonly formatGs = formatGs;

  ngOnInit(): void {
    const a = this.data.articulo;
    if (a) {
      this.form.patchValue({
        nombre: a.nombre,
        descripcion: a.descripcion ?? '',
        precio: a.precio,
        tasaIva: a.tasaIva ?? 10,
        unidadMedidaId: a.unidadMedida?.id ?? null,
        proveedorId: a.proveedor?.id ?? null,
      });
    }

    forkJoin({
      unidades: this.unidadService.listar(),
      proveedores: this.proveedorService.listar(),
      // Default rate for new articles; falls back to 10 % if it can't be read.
      tasaGeneral: this.editando
        ? of(null)
        : this.http
            .get<{ valor: string } | null>(`${API_URL}/parametros/impuesto.iva.general`)
            .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ unidades, proveedores, tasaGeneral }) => {
        this.unidades.set(unidades ?? []);
        this.proveedores.set(proveedores ?? []);
        const t = Number(tasaGeneral?.valor);
        if (!this.editando && (t === 10 || t === 5 || t === 0)) {
          this.form.controls.tasaIva.setValue(t as TasaIva);
        }
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.errorCarga.set(mensajeError(e, 'No se pudieron cargar las unidades de medida y los proveedores.'));
        this.cargando.set(false);
      },
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: ArticuloInput = {
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() || null,
      precio: Math.round(Number(v.precio)),
      tasaIva: v.tasaIva,
      unidadMedida: { id: v.unidadMedidaId! },
      proveedor: { id: v.proveedorId! },
      // Keep the image the article already had (images are not edited here yet).
      nombreImagen: this.data.articulo?.nombreImagen ?? null,
    };

    this.guardando.set(true);
    this.errorGuardar.set(null);
    const req = this.data.articulo
      ? this.articuloService.actualizar(this.data.articulo.id, body)
      : this.articuloService.crear(body);
    req.subscribe({
      next: (guardado) => this.dialogRef.close(guardado ?? ({} as Articulo)),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorGuardar.set(mensajeError(e, 'No se pudo guardar el artículo.'));
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
