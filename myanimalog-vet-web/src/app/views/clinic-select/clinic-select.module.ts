import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '@shared/shared.module';
import { ClinicSelectPage } from './clinic-select.page';

const routes: Routes = [{ path: '', component: ClinicSelectPage }];

@NgModule({
  declarations: [ClinicSelectPage],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ClinicSelectModule {}
