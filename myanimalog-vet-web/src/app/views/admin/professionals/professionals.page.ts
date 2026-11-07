import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { debounceTime, Subject } from 'rxjs';
import { errorMessage } from '@services/api-error';
import { AdminApi, AdminProfessional } from '@services/api/admin.api';
import { Chip, formatDate, licenseChip, PROFESSION_LABELS } from '../admin.format';
import { ProfessionalDetailData, ProfessionalDetailDialog } from '../dialogs/professional-detail.dialog';

const MODAL: MatDialogConfig = { panelClass: 'vet-dialog', backdropClass: 'vet-backdrop', autoFocus: 'dialog', maxWidth: '96vw' };

/** Container: Profesionales de la plataforma (listado, búsqueda por nombre o tarjeta y ficha). */
@Component({
  selector: 'vet-admin-professionals-page',
  standalone: false,
  templateUrl: './professionals.page.html',
  styleUrl: './professionals.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly typed$ = new Subject<string>();

  protected readonly search = signal('');
  protected readonly verifiedOnly = signal(false);
  protected readonly items = signal<AdminProfessional[]>([]);
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

  protected setVerified(only: boolean): void {
    if (this.verifiedOnly() === only) return;
    this.verifiedOnly.set(only);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.professionals(this.search(), this.verifiedOnly()).subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos cargar los profesionales.'));
        this.loading.set(false);
      },
    });
  }

  protected chip(p: AdminProfessional): Chip {
    return licenseChip(p.licenseStatus);
  }

  protected profession(p: AdminProfessional): string {
    return PROFESSION_LABELS[p.profession]?.match(/\((\w+)\)/)?.[1] ?? p.profession;
  }

  protected clinics(p: AdminProfessional): string {
    return p.clinics.length ? p.clinics.map((c) => c.name).join(', ') : '—';
  }

  protected verified(p: AdminProfessional): string {
    return formatDate(p.verifiedAt);
  }

  protected open(p: AdminProfessional): void {
    const data: ProfessionalDetailData = { id: p.id, name: p.fullName };
    this.dialog.open<ProfessionalDetailDialog, ProfessionalDetailData>(ProfessionalDetailDialog, { ...MODAL, data });
  }
}
