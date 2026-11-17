import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '@shared/shared.module';
import { HistoryPage } from './history.page';

const routes: Routes = [{ path: '', component: HistoryPage }];

@NgModule({
  declarations: [HistoryPage],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class HistoryModule {}
