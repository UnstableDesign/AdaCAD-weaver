import { Component, OnInit, Input } from '@angular/core';
import { Bounds, Point } from '../../../core/model/datatypes';
import { TreeService } from '../../provider/tree.service';

@Component({
  selector: 'app-connection',
  templateUrl: './connection.component.html',
  styleUrls: ['./connection.component.scss']
})
export class ConnectionComponent implements OnInit {


  @Input() id: number;
  @Input() scale: number;


  from: number; 
  to: number; 
  b_from: Bounds;
  b_to: Bounds;
  disable_drag:boolean = true;
  orientation: boolean = true;
  

  bounds: Bounds = {
    topleft: {x: 0, y:0},
    width: 0,
    height:0
  };

  canvas: HTMLCanvasElement;
  cx: any;


  constructor(private tree: TreeService) { 


  }

  ngOnInit() {
  }

  ngAfterViewInit(){


    this.canvas = <HTMLCanvasElement> document.getElementById("cxn-"+this.id.toString());
    this.cx = this.canvas.getContext("2d");

    this.b_from = this.tree.getComponent(this.from).bounds;
    this.b_to = this.tree.getComponent(this.to).bounds;

    this.calculateBounds();
    this.drawConnection();
  }

  disableDrag(){
    this.disable_drag = true;
  }

  enableDrag(){
    this.disable_drag = false;
  }

  // setBounds(to:Bounds, from:Bounds){
  //   console.log("setting bounds", to, from);
  //   this.to = to;
  //   this.from = from;
  //   this.calculateBounds();
  //   this.drawConnection();
  // }

  setPosition(pos: Point){
    // console.log("called set position");
    // this.bounds.topleft = pos;
  }


  updatePositionAndSize(id: number, topleft: Point, width: number, height: number){    
  
    //this block of code works when we assume the pointer is at the top right corner of a subdraft directly connected to this component
    console.log("updating again", id);
    this.orientation = true;

    if(id == this.from){
      if(topleft.x < this.b_to.topleft.x) this.orientation = !this.orientation;
      if(topleft.y < this.b_to.topleft.y) this.orientation = !this.orientation;
      this.bounds.topleft = {x: Math.min(topleft.x, this.b_to.topleft.x), y: Math.min(topleft.y+height, this.b_to.topleft.y)};
      this.bounds.width = Math.max(topleft.x, this.b_to.topleft.x) - this.bounds.topleft.x;
      this.bounds.height = Math.max(topleft.y, this.b_to.topleft.y) - this.bounds.topleft.y;
       
    }else if(id == this.to){
      if(topleft.x < this.b_from.topleft.x) this.orientation = !this.orientation;
      if(topleft.y < this.b_from.topleft.y) this.orientation = !this.orientation;
      this.bounds.topleft = {x: Math.min(topleft.x, this.b_from.topleft.x), y: Math.min(topleft.y, this.b_from.topleft.y)};
      this.bounds.width = Math.max(topleft.x, this.b_from.topleft.x) - this.bounds.topleft.x;
      this.bounds.height = Math.max(topleft.y, this.b_from.topleft.y) - this.bounds.topleft.y;
    }

    if(this.bounds.width < 4) this.bounds.width = 4;
    if(this.bounds.height < 4) this.bounds.height = 4;
  
    this.drawConnection();
  }


  /** there is an error here that topleft never resets or redraws but otherwiseit works */
  calculateBounds(){
    
    let p1: Point;
    let p2: Point;
    let bottomright: Point = {x:0, y:0};

    p1 = {x: this.b_from.topleft.x, y: this.b_from.topleft.y};
    p1.y += this.b_from.height;
    p2 =  {x: this.b_to.topleft.x, y: this.b_to.topleft.y}

    this.orientation = true;
    
    if(p2.x < p1.x) this.orientation = !this.orientation;
    if(p2.y < p1.y) this.orientation = !this.orientation;

    bottomright.x = Math.max(p1.x, p2.x);
    bottomright.y = Math.max(p1.y, p2.y);

    this.bounds.topleft.x = Math.min(p1.x, p2.x);
    this.bounds.topleft.y = Math.min(p1.y, p2.y);
    this.bounds.width = bottomright.x - this.bounds.topleft.x + 2; //add two so a line is drawn when horiz or vert
    this.bounds.height = bottomright.y - this.bounds.topleft.y + 2;
    console.log("Bounds", this.bounds.topleft);
  }

  drawConnection(){

    console.log("called draw connection");
    //make the canvas big enough to encase the point, starting from the topleft of the view
    this.canvas.width = this.bounds.width;
    this.canvas.height = this.bounds.height;


    this.cx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.cx.beginPath();
    this.cx.strokeStyle = "#ff4081";
    this.cx.setLineDash([this.scale, 2]);
    this.cx.lineWidth = 2;
    // this.cx.strokeRect(0,0, this.bounds.width, this.bounds.height);
    if(this.orientation){
      this.cx.moveTo(0, 0);
      this.cx.lineTo(this.bounds.width, this.bounds.height);
    }else{
      this.cx.moveTo(0, this.bounds.height);
      this.cx.lineTo(this.bounds.width, 0);
    }
    this.cx.stroke();
  }

  rescale(scale:number){
    this.scale = scale;
    this.drawConnection();
  }


}
