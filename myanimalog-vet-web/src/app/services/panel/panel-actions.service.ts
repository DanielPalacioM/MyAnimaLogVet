import { inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, map, Observable } from 'rxjs';
import { SessionService } from '@auth/services/session.service';
import { MANAGER_ONLY_MESSAGE } from '@auth/permissions';
import { AddPatientDialog } from '@shared/components/dialogs/add-patient.dialog';
import { BlockDialog, BlockInput } from '@shared/components/dialogs/block.dialog';
import { ChangeRoleDialog } from '@shared/components/dialogs/change-role.dialog';
import { ConfirmData, ConfirmDialog } from '@shared/components/dialogs/confirm.dialog';
import { InviteColleagueDialog } from '@shared/components/dialogs/invite-colleague.dialog';
import { LinkCodeDialog } from '@shared/components/dialogs/link-code.dialog';
import { NewAppointmentData, NewAppointmentDialog } from '@shared/components/dialogs/new-appointment.dialog';
import { ProfessionalSchedulesDialog } from '@shared/components/dialogs/professional-schedules.dialog';
import { ScheduleDialog } from '@shared/components/dialogs/schedule.dialog';
import { ServiceDialog, ServiceInput } from '@shared/components/dialogs/service.dialog';
import { ClinicService, Member, MemberRole } from '../clinic/clinic.models';
import { FEATURE_MESSAGE, FEATURES, FeatureName } from '../features';

/** Marco de los modales del diseño (radio 14, fondo atenuado). */
const MODAL: MatDialogConfig = { panelClass: 'vet-dialog', backdropClass: 'vet-backdrop', autoFocus: 'first-tabbable', maxWidth: '94vw' };

/** Acciones del panel que abren diálogos y avisos (las usan todas las vistas del panel). */
@Injectable({ providedIn: 'root' })
export class PanelActionsService {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly session = inject(SessionService);

  /** Configurar la clínica es del dueño y los administradores. */
  private manager(): boolean {
    if (this.session.isManager()) return true;
    this.toast(MANAGER_ONLY_MESSAGE);
    return false;
  }

  /** Avisa que la función aún no tiene backend. Devuelve `true` si se puede seguir. */
  private available(feature: FeatureName): boolean {
    if (FEATURES[feature]) return true;
    this.toast(FEATURE_MESSAGE[feature]);
    return false;
  }

  newAppointment(data?: NewAppointmentData): void {
    if (!this.available('appointments')) return;
    this.dialog
      .open(NewAppointmentDialog, { data, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((saved) => saved && this.snack.open('Cita agendada', 'Cerrar', { duration: 3000 }));
  }

  addPatient(): void {
    if (!this.available('patients')) return;
    this.dialog.open(AddPatientDialog, { autoFocus: false });
  }

  invite(): void {
    if (!this.manager()) return;
    this.dialog.open(InviteColleagueDialog, MODAL);
  }

  /** Código QR de la clínica ("Mostrar código QR"). */
  showLinkCode(): void {
    this.dialog.open(LinkCodeDialog, MODAL);
  }

  /** Pide confirmar una acción. Emite `true` si el usuario confirma. */
  confirm(data: ConfirmData): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, { ...MODAL, data, autoFocus: 'first-tabbable' })
      .afterClosed()
      .pipe(map((ok) => ok === true));
  }

  changeRole(member: Member): Observable<MemberRole | undefined> {
    return this.dialog.open<ChangeRoleDialog, Member, MemberRole>(ChangeRoleDialog, { ...MODAL, data: member }).afterClosed();
  }

  editService(service?: ClinicService): Observable<ServiceInput | undefined> {
    if (!this.manager() || !this.available('catalog')) return EMPTY;
    return this.dialog.open<ServiceDialog, ClinicService | null, ServiceInput>(ServiceDialog, { ...MODAL, data: service ?? null }).afterClosed();
  }

  addBlock(): Observable<BlockInput | undefined> {
    if (!this.manager() || !this.available('schedule')) return EMPTY;
    return this.dialog.open<BlockDialog, void, BlockInput>(BlockDialog, MODAL).afterClosed();
  }

  editSchedule(): Observable<boolean | undefined> {
    if (!this.manager() || !this.available('schedule')) return EMPTY;
    return this.dialog.open<ScheduleDialog, void, boolean>(ScheduleDialog, MODAL).afterClosed();
  }

  professionalSchedules(): Observable<boolean | undefined> {
    if (!this.manager() || !this.available('schedule')) return EMPTY;
    return this.dialog.open<ProfessionalSchedulesDialog, void, boolean>(ProfessionalSchedulesDialog, MODAL).afterClosed();
  }

  toast(message: string): void {
    this.snack.open(message, 'Cerrar', { duration: 3000 });
  }
}
