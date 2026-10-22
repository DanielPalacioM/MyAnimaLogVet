import { Routes } from '@angular/router';
import { authGuard } from '@auth/guards/auth.guard';

// Cada vista es un módulo que se carga bajo demanda (lazy).
export const routes: Routes = [
  { path: 'login', loadChildren: () => import('./views/login/login.module').then((m) => m.LoginModule) },
  { path: 'registro', loadChildren: () => import('./views/register/register.module').then((m) => m.RegisterModule) },
  // Panel de la clínica (Inicio, Agenda, Pacientes…): requiere sesión.
  { path: '', canActivate: [authGuard], loadChildren: () => import('./views/panel/panel.module').then((m) => m.PanelModule) },
  { path: '**', redirectTo: '' },
];
