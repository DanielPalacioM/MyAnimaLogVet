import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsPage } from './clients.page';

@NgModule({
  declarations: [ClientsPage],
  imports: [SharedModule, ClientsRoutingModule],
})
export class ClientsModule {}
