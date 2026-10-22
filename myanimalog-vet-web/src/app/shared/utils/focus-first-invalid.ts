/** Lleva el foco al primer control inválido de un formulario (tras `markAllAsTouched`). */
export function focusFirstInvalid(root: HTMLElement): void {
  // Espera a que Angular pinte las clases `ng-invalid` y los mensajes de error.
  setTimeout(() => {
    const target = root.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid, vet-choice-cards.ng-invalid button[role="radio"]');
    target?.focus();
  });
}
