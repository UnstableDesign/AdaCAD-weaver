import { Component, OnInit, Inject } from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material";

@Component({
  selector: 'app-data-modal',
  templateUrl: './data.modal.html',
  styleUrls: ['./data.modal.scss']
})
export class DataModal {
	//data can go here
  constructor(private dialogRef: MatDialogRef<DataModal>) {

  }

}
