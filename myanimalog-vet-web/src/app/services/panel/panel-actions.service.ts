import { inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { map, Observable } from 'rxjs';
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

/** Marco de los modales del diseño (radio 14, fondo atenuado). */
const MODAL: MatDialogConfig = { panelClass: 'vet-dialog', backdropClass: 'vet-backdrop', autoFocus: 'first-tabbable', maxWidth: '94vw' };

/** Acciones del panel que abren diálogos y avisos (las usan todas las vistas del panel). */
@Injectable({ providedIn: 'root' })
export class PanelActionsService {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  newAppointment(data?: NewAppointmentData): void {
    this.dialog
      .open(NewAppointmentDialog, { data, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((saved) => saved && this.snack.open('Cita agendada', 'Cerrar', { duration: 3000 }));
  }

  addPatient(): void {
    this.dialog.open(AddPatientDialog, { autoFocus: false });
  }

  invite(): void {
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
    return this.dialog.open<ServiceDialog, ClinicService | null, ServiceInput>(ServiceDialog, { ...MODAL, data: service ?? null }).afterClosed();
  }

  addBlock(): Observable<BlockInput | undefined> {
    return this.dialog.open<BlockDialog, void, BlockInput>(BlockDialog, MODAL).afterClosed();
  }

  editSchedule(): Observable<boolean | undefined> {
    return this.dialog.open<ScheduleDialog, void, boolean>(ScheduleDialog, MODAL).afterClosed();
  }

  professionalSchedules(): Observable<boolean | undefined> {
    return this.dialog.open<ProfessionalSchedulesDialog, void, boolean>(ProfessionalSchedulesDialog, MODAL).afterClosed();
  }

  toast(message: string): void {
    this.snack.open(message, 'Cerrar', { duration: 3000 });
  }
}
