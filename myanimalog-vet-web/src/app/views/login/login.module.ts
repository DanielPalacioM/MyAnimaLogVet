import { NgModule } from '@angular/core';
import { LoginMockService } from '@services/login/login.mock.service';
import { LoginService } from '@services/login/login.service';
import { SharedModule } from '@shared/shared.module';
import { LoginRoutingModule } from './login-routing.module';
import { LoginPage } from './login.page';

@NgModule({
  declarations: [LoginPage],
  imports: [SharedModule, LoginRoutingModule],
  // Para pasar a HTTP: cambiar useClass por la implementación real.
  providers: [{ provide: LoginService, useClass: LoginMockService }],
})
export class LoginModule {}
