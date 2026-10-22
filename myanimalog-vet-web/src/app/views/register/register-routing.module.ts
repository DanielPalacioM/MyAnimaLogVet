import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { STATUS_PATH, stepInfo } from '@services/register/models/registration.model';
import { AccountPage } from './pages/account/account.page';
import { ClinicDataPage } from './pages/clinic-data/clinic-data.page';
import { DocumentsPage } from './pages/documents/documents.page';
import { IntroPage } from './pages/intro/intro.page';
import { ProfilePage } from './pages/profile/profile.page';
import { RegisterLayout } from './layout/register.layout';
import { statusGuard, stepGuard } from './guards/register-step.guard';
import { RepresentativePage } from './pages/representative/representative.page';
import { ReviewPage } from './pages/review/review.page';
import { StatusPage } from './pages/status/status.page';
import { VerifyEmailPage } from './pages/verify-email/verify-email.page';

const TITLE = 'MyAnimaLogVet';

/** Pasos del registro. Cada uno tiene su guard para que no se pueda saltar ninguno. */
const routes: Routes = [
  {
    path: '',
    component: RegisterLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: stepInfo('consent').path },
      { path: stepInfo('consent').path, component: IntroPage, title: `Antes de empezar · ${TITLE}`, canActivate: [stepGuard('consent')] },
      { path: stepInfo('account').path, component: AccountPage, title: `Crea tu cuenta · ${TITLE}`, canActivate: [stepGuard('account')] },
      { path: stepInfo('verify').path, component: VerifyEmailPage, title: `Verifica tu correo · ${TITLE}`, canActivate: [stepGuard('verify')] },
      { path: stepInfo('clinic').path, component: ClinicDataPage, title: `Tu clínica · ${TITLE}`, canActivate: [stepGuard('clinic')] },
      { path: stepInfo('representative').path, component: RepresentativePage, title: `Representante legal · ${TITLE}`, canActivate: [stepGuard('representative')] },
      { path: stepInfo('documents').path, component: DocumentsPage, title: `Documentos · ${TITLE}`, canActivate: [stepGuard('documents')] },
      { path: stepInfo('profile').path, component: ProfilePage, title: `Perfil profesional · ${TITLE}`, canActivate: [stepGuard('profile')] },
      { path: stepInfo('review').path, component: ReviewPage, title: `Revisa y envía · ${TITLE}`, canActivate: [stepGuard('review')] },
      { path: STATUS_PATH, component: StatusPage, title: `En revisión · ${TITLE}`, canActivate: [statusGuard] },
      { path: '**', redirectTo: '' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RegisterRoutingModule {}
