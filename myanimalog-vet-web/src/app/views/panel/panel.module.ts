import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { PanelLayout } from './layout/panel.layout';
import { ComingSoonPage } from './pages/coming-soon/coming-soon.page';
import { PanelRoutingModule } from './panel-routing.module';

@NgModule({
  declarations: [PanelLayout, ComingSoonPage],
  imports: [SharedModule, PanelRoutingModule],
})
export class PanelModule {}
