import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Articulo, imagenArticuloUrl, tasaLabel } from '../models/articulo.model';
import { formatGs } from '../format';

type ArticuloZoom = Pick<Articulo, 'id' | 'nombre' | 'nombreImagen'> & Partial<Articulo>;

/** Opens the photo of an article large, with its name, price and description. */
export function verImagenArticulo(dialog: MatDialog, articulo: ArticuloZoom): void {
  if (!imagenArticuloUrl(articulo)) return;
  dialog.open(ArticuloImagenDialogComponent, {
    data: articulo,
    maxWidth: '94vw',
    maxHeight: '94vh',
    panelClass: 'articulo-zoom-panel',
    autoFocus: 'dialog',
  });
}

@Component({
  selector: 'app-articulo-imagen-dialog',
  standalone: true,
  imports: [MaterialModule],
  template: `
    <div class="zoom">
      <button mat-icon-button class="close" (click)="ref.close()" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
      <div class="photo" [class.photo--loading]="cargando()">
        @if (cargando()) {
        <mat-spinner diameter="32"></mat-spinner>
        }
        <img [src]="url" [alt]="a.nombre" (load)="cargando.set(false)" (error)="cargando.set(false)" />
      </div>
      <div class="info">
        <h2>{{ a.nombre }}</h2>
        <div class="meta">
          @if (a.precio !== undefined && a.precio !== null) {
          <span class="price">{{ formatGs(a.precio) }}</span>
          }
          @if (a.tasaIva !== undefined && a.tasaIva !== null) {
          <span class="pill">IVA {{ tasaLabel(a.tasaIva) }}</span>
          }
          @if (a.unidadMedida?.nombre) {
          <span class="pill">{{ a.unidadMedida?.nombre }}</span>
          }
        </div>
        @if (a.descripcion) {
        <p>{{ a.descripcion }}</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .zoom {
        position: relative;
        display: flex;
        flex-direction: column;
        width: min(760px, 94vw);
        max-height: 94vh;
        background: #fff;
      }
      .close {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 1;
        color: #fff;
        background: rgba(17, 28, 45, 0.45);
      }
      .photo {
        display: grid;
        place-items: center;
        min-height: 200px;
        background: #f3f4f6;
      }
      .photo img {
        display: block;
        max-width: 100%;
        max-height: calc(94vh - 150px);
        object-fit: contain;
      }
      .photo--loading img {
        visibility: hidden;
        height: 0;
      }
      .info {
        padding: 16px 20px 20px;
      }
      h2 {
        margin: 0 0 8px;
        font-size: 20px;
        font-weight: 700;
        color: #111c2d;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .price {
        font-size: 18px;
        font-weight: 800;
        color: #111c2d;
      }
      .pill {
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        color: #635bff;
        background: #eeedff;
      }
      p {
        margin: 10px 0 0;
        color: #4b5563;
        white-space: pre-line;
      }
    `,
  ],
})
export class ArticuloImagenDialogComponent {
  readonly ref = inject(MatDialogRef<ArticuloImagenDialogComponent>);
  readonly a = inject<ArticuloZoom>(MAT_DIALOG_DATA);
  readonly url = imagenArticuloUrl(this.a)!;
  readonly cargando = signal(true);
  readonly formatGs = formatGs;
  readonly tasaLabel = tasaLabel;
}
