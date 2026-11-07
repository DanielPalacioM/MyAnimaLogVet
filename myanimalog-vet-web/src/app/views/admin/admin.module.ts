import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '@shared/shared.module';
import { ClinicsPage } from './clinics/clinics.page';
import { AdminLayout } from './layout/admin.layout';
import { ProfessionalsPage } from './professionals/professionals.page';
import { VerificationsPage } from './verifications/verifications.page';

const TITLE = 'MyAnimaLogVet';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'verificaciones' },
      { path: 'verificaciones', component: VerificationsPage, title: `Verificaciones · ${TITLE}` },
      { path: 'clinicas', component: ClinicsPage, title: `Clínicas · ${TITLE}` },
      { path: 'profesionales', component: ProfessionalsPage, title: `Profesionales · ${TITLE}` },
      { path: '**', redirectTo: 'verificaciones' },
    ],
  },
];

@NgModule({
  declarations: [AdminLayout, VerificationsPage, ClinicsPage, ProfessionalsPage],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class AdminModule {}
