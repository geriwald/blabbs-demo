import { Routes } from '@angular/router';
import { ModulationComponent } from './games/modulation.component';

export const routes: Routes = [
  { path: 'modulation', component: ModulationComponent },
  { path: '', redirectTo: 'modulation', pathMatch: 'full' },
];
