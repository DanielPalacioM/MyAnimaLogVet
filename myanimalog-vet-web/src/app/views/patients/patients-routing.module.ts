import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientsPage } from './patients.page';

const routes: Routes = [{ path: '', component: PatientsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PatientsRoutingModule {}
