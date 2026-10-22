import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthShell } from './components/auth-shell/auth-shell.component';
import { ChoiceCards } from './components/choice-cards/choice-cards.component';
import { DocumentCard } from './components/document-card/document-card.component';
import { VetField } from './components/form-field/form-field.component';
import { InfoNote } from './components/info-note/info-note.component';
import { LoginForm } from './components/login-form/login-form.component';
import { OtpInput } from './components/otp-input/otp-input.component';
import { StepFrame } from './components/step-frame/step-frame.component';

const COMPONENTS = [AuthShell, ChoiceCards, DocumentCard, InfoNote, LoginForm, OtpInput, StepFrame, VetField];
const MODULES = [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule];

/**
 * Módulo compartido: lo que cualquier vista necesita importar.
 * Los componentes reutilizables viven en `shared/components/` (standalone) y se exportan desde aquí.
 */
@NgModule({
  imports: [...MODULES, ...COMPONENTS],
  exports: [...MODULES, ...COMPONENTS],
})
export class SharedModule {}
