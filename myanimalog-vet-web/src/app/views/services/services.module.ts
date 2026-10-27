import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { ServicesRoutingModule } from './services-routing.module';
import { ServicesPage } from './services.page';

@NgModule({
  declarations: [ServicesPage],
  imports: [SharedModule, ServicesRoutingModule],
})
export class ServicesModule {}
