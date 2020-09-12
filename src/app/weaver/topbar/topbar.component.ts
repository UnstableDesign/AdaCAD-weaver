import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent implements OnInit {
  
  @Output() onSave: any = new EventEmitter();
  @Output() onUndo: any = new EventEmitter();
  @Output() onRedo: any = new EventEmitter();

  @Input() undoItem;
  @Input() redoItem;

  @ViewChild('bmpLink', {static: true}) bmpLink: any;
  @ViewChild('adaLink', {static: true}) adaLink: any;
  downloadBmp: ElementRef;
  downloadAda: ElementRef;

  constructor() { }

  ngOnInit() {
    this.downloadBmp = this.bmpLink._elementRef;
    this.downloadAda = this.adaLink._elementRef;
  }

  public saveAsBmp(e: any) {
    var obj: any = {
      downloadLink: this.downloadBmp,
      type: "bmp"
    }
    console.log(obj);
  	this.onSave.emit(obj);
  }

  public saveAsAda(e: any) {
    var obj: any = {
      downloadLink: this.downloadAda,
      type: "ada"
    }
    console.log(obj);
    this.onSave.emit(obj);
  }

  undoClicked(e:any) {
    this.onUndo.emit();
  }

  redoClicked(e:any) {
    this.onRedo.emit();
  }

}