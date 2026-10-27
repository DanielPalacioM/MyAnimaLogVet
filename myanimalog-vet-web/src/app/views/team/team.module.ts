import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { TeamRoutingModule } from './team-routing.module';
import { TeamPage } from './team.page';

@NgModule({
  declarations: [TeamPage],
  imports: [SharedModule, TeamRoutingModule],
})
export class TeamModule {}
