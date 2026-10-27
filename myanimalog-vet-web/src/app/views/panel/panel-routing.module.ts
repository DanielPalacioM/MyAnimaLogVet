import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PanelLayout } from './layout/panel.layout';
import { ComingSoonPage } from './pages/coming-soon/coming-soon.page';

const soon = (path: string, title: string) => ({ path, component: ComingSoonPage, data: { title }, title: `${title} · MyAnimaLogVet` });

/** Panel: cada sección se carga bajo demanda. Las que aún no existen muestran "Pronto". */
const routes: Routes = [
  {
    path: '',
    component: PanelLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'home', redirectTo: 'inicio' },
      { path: 'inicio', title: 'Inicio · MyAnimaLogVet', loadChildren: () => import('../home/home.module').then((m) => m.HomeModule) },
      { path: 'agenda', title: 'Agenda · MyAnimaLogVet', loadChildren: () => import('../agenda/agenda.module').then((m) => m.AgendaModule) },
      { path: 'pacientes', title: 'Pacientes · MyAnimaLogVet', loadChildren: () => import('../patients/patients.module').then((m) => m.PatientsModule) },
      { path: 'clientes', title: 'Clientes · MyAnimaLogVet', loadChildren: () => import('../clients/clients.module').then((m) => m.ClientsModule) },
      soon('reportes', 'Reportes'),
      { path: 'equipo', title: 'Equipo · MyAnimaLogVet', loadChildren: () => import('../team/team.module').then((m) => m.TeamModule) },
      { path: 'servicios', title: 'Servicios y horarios · MyAnimaLogVet', loadChildren: () => import('../services/services.module').then((m) => m.ServicesModule) },
      { path: 'mi-clinica', title: 'Mi clínica · MyAnimaLogVet', loadChildren: () => import('../clinic/clinic.module').then((m) => m.ClinicModule) },
      soon('plan', 'Plan'),
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PanelRoutingModule {}
