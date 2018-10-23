import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import {MatDialog, MatDialogConfig} from "@angular/material";


import { DataModal } from '../../modal/data/data.modal';
import { Layer } from '../../../core/model/layer';

@Component({
  selector: 'app-data',
  templateUrl: './data.component.html',
  styleUrls: ['./data.component.scss']
})


export class DataComponent implements OnInit {
  @Input() file1;
  @Input() file2;
  @Output() onColorChange: any = new EventEmitter();
  selected = 0;

  constructor(private dialog: MatDialog) { }

  ngOnInit() {
  }

  colorChange(e) {
    this.onColorChange.emit();
  }

}
