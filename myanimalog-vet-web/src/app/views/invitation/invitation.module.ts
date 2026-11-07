import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '@shared/shared.module';
import { InvitationPage } from './invitation.page';

const routes: Routes = [{ path: '', component: InvitationPage }];

@NgModule({
  declarations: [InvitationPage],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class InvitationModule {}
