import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '@shared/shared.module';
import { ProfessionalProfilePage } from './profile.page';

const routes: Routes = [{ path: '', component: ProfessionalProfilePage }];

@NgModule({
  declarations: [ProfessionalProfilePage],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ProfileModule {}
