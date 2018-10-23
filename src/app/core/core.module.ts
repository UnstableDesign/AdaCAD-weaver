import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';


import { WeaveDirective } from './directives/weave.directive';
import { PatternService } from './provider/pattern.service';
import { UploadService } from './uploads/upload.service';
import { FilterPipe } from './pipe/filter.pipe';
import { UploadFormComponent } from './uploads/upload-form/upload-form.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [WeaveDirective, FilterPipe, UploadFormComponent],
  providers: [PatternService, UploadService],
  exports: [WeaveDirective, FilterPipe, UploadFormComponent]
})
export class CoreModule { }
