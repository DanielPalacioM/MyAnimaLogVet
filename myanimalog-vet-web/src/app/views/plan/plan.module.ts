import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '@shared/shared.module';
import { PlanPage } from './plan.page';

const routes: Routes = [{ path: '', component: PlanPage }];

@NgModule({
  declarations: [PlanPage],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class PlanModule {}
