import { inject, Injectable, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminApi } from '../api/admin.api';

/** Lo que comparten las pantallas de administración: cuántas clínicas esperan revisión (insignia del menú). */
@Injectable({ providedIn: 'root' })
export class AdminState {
  private readonly api = inject(AdminApi);

  readonly pendingClinics = signal(0);

  refresh(): void {
    this.api
      .queue('UNDER_REVIEW', 'CLINIC')
      .pipe(catchError(() => of(null)))
      .subscribe((q) => {
        // Si el backend no manda los conteos, se cuenta la lista (ya viene filtrada por estado y por clínicas).
        if (q) this.pendingClinics.set(q.counts?.UNDER_REVIEW ?? q.items.length);
      });
  }
}
