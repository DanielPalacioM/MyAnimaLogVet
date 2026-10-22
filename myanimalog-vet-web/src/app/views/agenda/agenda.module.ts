import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { AgendaRoutingModule } from './agenda-routing.module';
import { AgendaPage } from './agenda.page';

@NgModule({
  declarations: [AgendaPage],
  imports: [SharedModule, AgendaRoutingModule],
})
export class AgendaModule {}
