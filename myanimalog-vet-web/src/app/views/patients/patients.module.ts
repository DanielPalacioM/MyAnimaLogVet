import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { PatientsRoutingModule } from './patients-routing.module';
import { PatientsPage } from './patients.page';

@NgModule({
  declarations: [PatientsPage],
  imports: [SharedModule, PatientsRoutingModule],
})
export class PatientsModule {}
