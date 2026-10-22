import { NgModule } from '@angular/core';
import { RegisterMockService } from '@services/register/register.mock.service';
import { RegisterService } from '@services/register/register.service';
import { StepNavigator } from '@services/register/step-navigator';
import { SharedModule } from '@shared/shared.module';
import { AccountPage } from './pages/account/account.page';
import { ClinicDataPage } from './pages/clinic-data/clinic-data.page';
import { DocumentsPage } from './pages/documents/documents.page';
import { IntroPage } from './pages/intro/intro.page';
import { ProfilePage } from './pages/profile/profile.page';
import { RegisterRoutingModule } from './register-routing.module';
import { RegisterLayout } from './layout/register.layout';
import { RepresentativePage } from './pages/representative/representative.page';
import { ReviewPage } from './pages/review/review.page';
import { StatusPage } from './pages/status/status.page';
import { VerifyEmailPage } from './pages/verify-email/verify-email.page';

@NgModule({
  declarations: [
    RegisterLayout,
    IntroPage,
    AccountPage,
    VerifyEmailPage,
    ClinicDataPage,
    RepresentativePage,
    DocumentsPage,
    ProfilePage,
    ReviewPage,
    StatusPage,
  ],
  imports: [SharedModule, RegisterRoutingModule],
  providers: [
    StepNavigator,
    // Para pasar a HTTP: cambiar useClass por la implementación real.
    { provide: RegisterService, useClass: RegisterMockService },
  ],
})
export class RegisterModule {}
