import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';

export interface ConfirmDialogData {
  titulo: string;
  mensaje: string;
  confirmar?: string;
  /** Red confirm button for destructive actions. */
  peligro?: boolean;
}

/** Generic yes/no dialog. Closes with true when confirmed. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MaterialModule],
  template: `
    <h2 mat-dialog-title class="title">
      @if (data.peligro) {
      <span class="icon"><i class="iconify" data-icon="solar:trash-bin-trash-line-duotone"></i></span>
      }
      {{ data.titulo }}
    </h2>
    <mat-dialog-content>
      <p class="msg">{{ data.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button
        mat-flat-button
        [color]="data.peligro ? 'warn' : 'primary'"
        [mat-dialog-close]="true"
        cdkFocusInitial
      >
        {{ data.confirmar ?? 'Aceptar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .title {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .icon {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        font-size: 20px;
        color: #d92d20;
        background: #fef3f2;
      }
      .msg {
        margin: 0;
        color: #4b5563;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
