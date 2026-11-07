import { Routes } from '@angular/router';
import { authGuard, clinicGuard, platformAdminGuard } from '@auth/guards/auth.guard';

// Cada vista es un módulo que se carga bajo demanda (lazy).
export const routes: Routes = [
  { path: 'login', loadChildren: () => import('./views/login/login.module').then((m) => m.LoginModule) },
  { path: 'registro', loadChildren: () => import('./views/register/register.module').then((m) => m.RegisterModule) },
  // Con sesión pero sin clínica elegida: elegir clínica y aceptar invitaciones de equipo.
  { path: 'elegir-clinica', canActivate: [authGuard], title: 'Elige tu clínica · MyAnimaLogVet', loadChildren: () => import('./views/clinic-select/clinic-select.module').then((m) => m.ClinicSelectModule) },
  { path: 'invitacion', canActivate: [authGuard], title: 'Invitación · MyAnimaLogVet', loadChildren: () => import('./views/invitation/invitation.module').then((m) => m.InvitationModule) },
  // Administración de la plataforma (solo equipo MyAnimaLog): revisión de verificaciones y clínicas.
  { path: 'admin', canActivate: [authGuard, platformAdminGuard], loadChildren: () => import('./views/admin/admin.module').then((m) => m.AdminModule) },
  // Panel de la clínica (Inicio, Agenda, Pacientes…): requiere sesión y una clínica elegida.
  { path: '', canActivate: [authGuard, clinicGuard], loadChildren: () => import('./views/panel/panel.module').then((m) => m.PanelModule) },
  { path: '**', redirectTo: '' },
];
