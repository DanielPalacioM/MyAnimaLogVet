import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AddPatientDialog } from '@shared/components/dialogs/add-patient.dialog';
import { InviteColleagueDialog } from '@shared/components/dialogs/invite-colleague.dialog';
import { NewAppointmentData, NewAppointmentDialog } from '@shared/components/dialogs/new-appointment.dialog';

/** Acciones del panel que abren diálogos (las usan Inicio, Agenda y Pacientes). */
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
    this.dialog.open(InviteColleagueDialog, { autoFocus: 'first-tabbable' });
  }

  toast(message: string): void {
    this.snack.open(message, 'Cerrar', { duration: 3000 });
  }
}
