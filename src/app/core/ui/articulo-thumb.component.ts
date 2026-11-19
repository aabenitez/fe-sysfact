import { Component, computed, input, output, signal } from '@angular/core';
import { Articulo, imagenArticuloUrl } from '../models/articulo.model';

/**
 * Small square photo of an article (the same medium-size file, scaled down by the browser).
 * Without a photo, or if it fails to load, shows the article's initial. When it has a photo it is
 * a button that emits (zoom), unless zoomable is false.
 */
@Component({
  selector: 'app-articulo-thumb',
  standalone: true,
  template: `
    @if (url() && !fallo() && !zoomable()) {
    <span class="thumb thumb--static" [style.width.px]="size()" [style.height.px]="size()">
      <img [src]="url()" alt="" loading="lazy" decoding="async" (error)="fallo.set(true)" />
    </span>
    } @else if (url() && !fallo()) {
    <button
      type="button"
      class="thumb thumb--img"
      [style.width.px]="size()"
      [style.height.px]="size()"
      (click)="$event.stopPropagation(); zoom.emit()"
      [attr.aria-label]="'Ver foto de ' + articulo().nombre"
      [title]="'Ver foto de ' + articulo().nombre"
    >
      <img [src]="url()" [alt]="articulo().nombre" loading="lazy" decoding="async" (error)="fallo.set(true)" />
    </button>
    } @else {
    <span class="thumb thumb--letter" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true">
      {{ inicial() }}
    </span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: 0 0 auto;
      }
      .thumb {
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 10px;
      }
      .thumb--static {
        border: 1px solid #e5e7eb;
        background: #f3f4f6;
      }
      .thumb--img {
        padding: 0;
        border: 1px solid #e5e7eb;
        background: #f3f4f6;
        cursor: zoom-in;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .thumb--img:hover {
        transform: scale(1.06);
        box-shadow: 0 4px 12px rgba(17, 28, 45, 0.15);
      }
      .thumb--img:focus-visible {
        outline: 2px solid #635bff;
        outline-offset: 2px;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .thumb--letter {
        font-weight: 700;
        color: #635bff;
        background: #eeedff;
      }
    `,
  ],
})
export class ArticuloThumbComponent {
  readonly articulo = input.required<Pick<Articulo, 'id' | 'nombre' | 'nombreImagen'>>();
  readonly size = input(40);
  /** False inside clickable rows (e.g. autocomplete options): just the picture, no zoom button. */
  readonly zoomable = input(true);
  readonly zoom = output<void>();

  readonly fallo = signal(false);
  readonly url = computed(() => imagenArticuloUrl(this.articulo()));
  readonly inicial = computed(() => (this.articulo().nombre ?? '?').trim().charAt(0).toUpperCase());
}
