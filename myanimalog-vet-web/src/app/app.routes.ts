import { Routes } from '@angular/router';

// Cada vista es un módulo que se carga bajo demanda (lazy).
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadChildren: () => import('./views/login/login.module').then((m) => m.LoginModule) },
  { path: 'registro', loadChildren: () => import('./views/register/register.module').then((m) => m.RegisterModule) },
  { path: '**', redirectTo: 'login' },
];
