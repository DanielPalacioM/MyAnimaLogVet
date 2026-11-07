import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { AdminState } from '@services/admin/admin.state';
import { errorMessage } from '@services/api-error';
import { AdminApi, AdminClinic, ClinicStatus } from '@services/api/admin.api';
import { ConfirmData, ConfirmDialog } from '@shared/components/dialogs/confirm.dialog';
import { Chip, clinicStatusChip, formatDate, planLabel } from '../admin.format';
import { ClinicDetailData, ClinicDetailDialog } from '../dialogs/clinic-detail.dialog';
import { SuspendData, SuspendDialog } from '../dialogs/suspend.dialog';

const MODAL: MatDialogConfig = { panelClass: 'vet-dialog', backdropClass: 'vet-backdrop', autoFocus: 'first-tabbable', maxWidth: '96vw' };

type RowAction = 'SUSPEND' | 'REACTIVATE' | 'REVIEW' | null;

/** Container: "Clínicas: suspender y reactivar" (Figma 2040:753). */
@Component({
  selector: 'vet-admin-clinics-page',
  standalone: false,
  templateUrl: './clinics.page.html',
  styleUrl: './clinics.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly typed$ = new Subject<string>();

  protected readonly filters: readonly { value: ClinicStatus | null; label: string }[] = [
    { value: null, label: 'Todas' },
    { value: 'UNDER_REVIEW', label: 'En revisión' },
    { value: 'NEEDS_CORRECTION', label: 'Corrección pedida' },
    { value: 'PENDING_DOCUMENTS', label: 'Sin documentos' },
    { value: 'ACTIVE', label: 'Activas' },
    { value: 'SUSPENDED', label: 'Suspendidas' },
    { value: 'REJECTED', label: 'Rechazadas' },
  ];
  protected readonly status = signal<ClinicStatus | null>(null);
  protected readonly search = signal('');
  protected readonly items = signal<AdminClinic[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.typed$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    this.load();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.typed$.next(value);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.clinics(this.search(), this.status()).subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos cargar las clínicas.'));
        this.loading.set(false);
      },
    });
  }

  protected setStatus(value: ClinicStatus | null): void {
    if (this.status() === value) return;
    this.status.set(value);
    this.load();
  }

  protected open(c: AdminClinic): void {
    const data: ClinicDetailData = { id: c.id, name: c.name };
    this.dialog
      .open<ClinicDetailDialog, ClinicDetailData, boolean>(ClinicDetailDialog, { ...MODAL, autoFocus: 'dialog', data })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) this.load();
      });
  }

  protected chip(c: AdminClinic): Chip {
    return clinicStatusChip(c.status);
  }

  protected plan(c: AdminClinic): string {
    return planLabel(c.plan);
  }

  protected approved(c: AdminClinic): string {
    return formatDate(c.approvedAt);
  }

  /** Qué botón lleva cada fila: suspender, reactivar o ir a revisar la solicitud. */
  protected action(c: AdminClinic): RowAction {
    switch (c.status) {
      case 'ACTIVE':
        return 'SUSPEND';
      case 'SUSPENDED':
        return 'REACTIVATE';
      case 'UNDER_REVIEW':
      case 'NEEDS_CORRECTION':
        return 'REVIEW';
      default:
        return null;
    }
  }

  protected suspend(c: AdminClinic): void {
    const data: SuspendData = { id: c.id, name: c.name };
    this.dialog.open<SuspendDialog, SuspendData, boolean>(SuspendDialog, { ...MODAL, data }).afterClosed().subscribe((done) => done && this.load());
  }

  protected reactivate(c: AdminClinic): void {
    const data: ConfirmData = {
      title: `Reactivar ${c.name}`,
      message: 'La clínica vuelve a operar con normalidad y se borra el motivo de la suspensión.',
      confirmLabel: 'Reactivar',
    };
    this.dialog
      .open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, { ...MODAL, data })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.reactivate(c.id).subscribe({
          next: () => {
            this.snack.open('Clínica reactivada.', 'Cerrar', { duration: 3500 });
            this.load();
          },
          error: (e: unknown) => this.snack.open(errorMessage(e), 'Cerrar', { duration: 5000 }),
        });
      });
  }

  protected review(c: AdminClinic): void {
    void this.router.navigate(['/admin/verificaciones'], { queryParams: { clinica: c.id } });
  }

  protected run(c: AdminClinic): void {
    switch (this.action(c)) {
      case 'SUSPEND':
        return this.suspend(c);
      case 'REACTIVATE':
        return this.reactivate(c);
      case 'REVIEW':
        return this.review(c);
    }
    this.state.refresh();
  }
}
