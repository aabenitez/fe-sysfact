import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { UnidadMedida } from '../../core/models/articulo.model';
import { UnidadMedidaInput, UnidadMedidaService } from '../../core/services/unidad-medida.service';
import { mensajeError } from '../../core/http-error';

export interface UnidadMedidaFormData {
  /** Unit to edit; omitted when creating a new one. */
  unidad?: UnidadMedida;
  /** How many articles use it (shown as a warning when editing). */
  articulos?: number | null;
}

const ACENTOS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

/**
 * Spanish plural of the first word, as a suggestion the user can change:
 * "Maceta" → "Macetas", "Cajón" → "Cajones", "Lápiz" → "Lápices", "Bolsa de tierra" → "Bolsas de tierra".
 */
export function sugerirPlural(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (!limpio) return '';
  const [primera, ...resto] = limpio.split(' ');
  const mayus = primera.length > 1 && primera === primera.toUpperCase();
  const fin = (s: string) => (mayus ? s.toUpperCase() : s);
  let plural: string;
  if (/[aeiouáéíóú]$/i.test(primera)) {
    plural = primera + fin('s'); // "Maceta" → "Macetas", "Ají" → "Ajís"
  } else if (/z$/i.test(primera)) {
    plural = primera.slice(0, -1) + fin('ces');
  } else if (/[sx]$/i.test(primera) && primera.length > 3 && !/[áéíóú][sx]$/i.test(primera)) {
    plural = primera; // "Lunes", "Tórax": same in plural
  } else {
    // Consonant: add "es"; a stressed last syllable ending in n/s loses its accent ("Cajón" → "Cajones").
    const sinAcento = primera.replace(/([áéíóú])([ns])$/i, (_, v: string, c: string) => {
      const base = ACENTOS[v.toLowerCase()] ?? v;
      return (v === v.toUpperCase() ? base.toUpperCase() : base) + c;
    });
    plural = sinAcento + fin('es');
  }
  return [plural, ...resto].join(' ');
}

/** Create / edit dialog. Closes with the saved unit, or undefined when cancelled. */
@Component({
  selector: 'app-unidad-medida-form-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  templateUrl: './unidad-medida-form-dialog.component.html',
  styleUrls: ['../proveedores/proveedor-form-dialog.component.scss'],
  styles: [
    `
      .note {
        margin: 4px 0 8px;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
        color: #b54708;
        background: #fffaeb;
        border: 1px solid #fedf89;
      }
    `,
  ],
})
export class UnidadMedidaFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<UnidadMedidaFormDialogComponent, UnidadMedida>);
  private readonly service = inject(UnidadMedidaService);
  readonly data = inject<UnidadMedidaFormData>(MAT_DIALOG_DATA);

  readonly editando = !!this.data.unidad;
  readonly guardando = signal(false);
  readonly errorGuardar = signal<string | null>(null);
  /** Once the user types a plural (or when editing), the name no longer rewrites it. */
  private pluralManual = this.editando;

  readonly form = this.fb.nonNullable.group({
    nombre: [this.data.unidad?.nombre ?? '', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    plural: [this.data.unidad?.plural ?? '', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
  });

  constructor() {
    this.form.controls.nombre.valueChanges.pipe(takeUntilDestroyed()).subscribe((nombre) => {
      if (!this.pluralManual) {
        this.form.controls.plural.setValue(sugerirPlural(nombre), { emitEvent: false });
      }
    });
  }

  /** Typing in the plural keeps it; clearing it lets the suggestion come back. */
  pluralEditado(valor: string): void {
    this.pluralManual = valor.trim() !== '';
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: UnidadMedidaInput = {
      nombre: v.nombre.trim().replace(/\s+/g, ' '),
      plural: v.plural.trim().replace(/\s+/g, ' '),
    };

    this.guardando.set(true);
    this.errorGuardar.set(null);
    const req = this.data.unidad ? this.service.actualizar(this.data.unidad.id, body) : this.service.crear(body);
    req.subscribe({
      next: (guardada) => this.dialogRef.close(guardada),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorGuardar.set(mensajeError(e, 'No se pudo guardar la unidad de medida.'));
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
