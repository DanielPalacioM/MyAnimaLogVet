import { NgModule } from '@angular/core';
import { LoginHttpService } from '@services/login/login.http.service';
import { LoginService } from '@services/login/login.service';
import { SharedModule } from '@shared/shared.module';
import { LoginRoutingModule } from './login-routing.module';
import { LoginPage } from './login.page';

@NgModule({
  declarations: [LoginPage],
  imports: [SharedModule, LoginRoutingModule],
  providers: [{ provide: LoginService, useClass: LoginHttpService }],
})
export class LoginModule {}
