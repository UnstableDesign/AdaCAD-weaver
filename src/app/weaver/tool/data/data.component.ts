import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import {MatDialog, MatDialogConfig} from "@angular/material";

//things get specific
import { ConnectionModal } from '../../modal/connection/connection.modal';
//



//TODO: update selector
@Component({
  selector: 'app-data',
  templateUrl: './data.component.html',
  styleUrls: ['./data.component.scss']
})
export class DesignComponent implements OnInit {
  @Input() brush;
  @Input() favorites;
  @Output() onBrushChange: any = new EventEmitter();
  @Output() onFill: any = new EventEmitter();
  @Output() onMask: any = new EventEmitter();
  @Output() onPaste: any = new EventEmitter();
  @Output() onCopy: any = new EventEmitter();
  @Output() onClear: any = new EventEmitter();
  @Output() onViewChange: any = new EventEmitter();
  @Output() onConnectionCreate: any = new EventEmitter();
  @Output() onLabelCreate: any = new EventEmitter();

  view = 'pattern';
  copy = false;

  constructor(private dialog: MatDialog) { }

  ngOnInit() {
  }

  openConnectionDialog() {

    this.onConnectionCreate.emit();
  }

  openLabelDialog() {

    this.onLabelCreate.emit();
  }

  viewChange(e: any) {
    this.view = e.value;
    var obj: any = {};
    obj.view = e.value;

    this.onViewChange.emit(obj);
  }

  brushChange(e: any) {
    console.log(this.favorites);
    if (e.target.name) {
      this.brush = e.target.name;
    }

    var obj: any = {};
    obj.name = this.brush;
    this.onBrushChange.emit(obj);
  }

  fillEvent(e, id) {
    var obj: any = {};
    obj.id = id;
    this.onFill.emit(obj);
  }

  copyEvent(e) {
    this.onCopy.emit();
    this.copy = true;
  }

  clearEvent(e) {
    this.onClear.emit();
  }

  maskEvent(e, id) {
    var obj: any = {};
    obj.id = id;
    this.onMask.emit(obj);
  }

  pasteEvent(e, type) {
    var obj: any = {};
    obj.type = type;
    this.onPaste.emit(obj);
  }

}
