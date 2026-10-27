import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { ClinicRoutingModule } from './clinic-routing.module';
import { ClinicPage } from './clinic.page';

@NgModule({
  declarations: [ClinicPage],
  imports: [SharedModule, ClinicRoutingModule],
})
export class ClinicModule {}
